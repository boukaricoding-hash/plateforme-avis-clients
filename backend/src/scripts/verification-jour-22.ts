import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { hash } from "bcryptjs";
import { app } from "../app";
import { prisma } from "../configuration/base-de-donnees";

// ------------------------------------------------------------
// Verification du jour 22 (back-office DTS) : npx tsx src/scripts/verification-jour-22.ts
// ------------------------------------------------------------
// Demarre le vrai serveur sur un port libre, se connecte avec le compte administrateur du seed
// (SEED_ADMIN_EMAIL et SEED_ADMIN_MOT_DE_PASSE de backend/.env) et deroule tout le parcours :
// secteurs, creation d'une organisation par secteur (modele clone), invitation du premier responsable
// avec l'e-mail lu dans Mailpit, acces refuses, suspension, QR code, reactivation.
// Chaque point affiche une coche ou une croix. A la fin, tout ce qui a ete cree est supprime,
// sauf l'e-mail dans Mailpit (pour le voir sur http://localhost:8025).
// Prerequis : base demarree, seed lance, Mailpit demarre (docker compose --profile dev up -d mailpit).

const suffixe = randomBytes(4).toString("hex");
const URL_MAILPIT = process.env["MAILPIT_URL"] ?? "http://localhost:8025";
const MESSAGE_SANTE = "Ne mentionnez aucune information médicale personnelle.";
const MOT_DE_PASSE_RESPONSABLE = "Verification-Jour22-2026";
const SECTEURS_ATTENDUS = ["restauration", "sante", "education", "agroalimentaire", "evenement", "general"];

type Corps = Record<string, any>;
type Reponse = { statut: number; corps: Corps };

// Un petit navigateur : il garde le cookie de session entre les requetes.
class Navigateur {
  private base: string;
  private cookies = new Map<string, string>();

  constructor(base: string) {
    this.base = base;
  }

  async appeler(methode: "GET" | "POST" | "PATCH", chemin: string, corps?: Corps): Promise<Reponse> {
    const entetes: Record<string, string> = {};
    if (corps !== undefined) {
      entetes["Content-Type"] = "application/json";
    }
    const cookie = [...this.cookies].map(([nom, valeur]) => nom + "=" + valeur).join("; ");
    if (cookie !== "") {
      entetes["Cookie"] = cookie;
    }

    const reponse = await fetch(this.base + chemin, {
      method: methode,
      headers: entetes,
      ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
    });

    for (const ligne of reponse.headers.getSetCookie()) {
      const paire = ligne.split(";")[0] ?? "";
      const egal = paire.indexOf("=");
      if (egal > 0) {
        const nom = paire.slice(0, egal);
        const valeur = paire.slice(egal + 1);
        if (valeur === "") {
          this.cookies.delete(nom);
        } else {
          this.cookies.set(nom, valeur);
        }
      }
    }

    const texte = await reponse.text();
    let json: Corps = {};
    try {
      json = texte === "" ? {} : (JSON.parse(texte) as Corps);
    } catch {
      json = {};
    }
    return { statut: reponse.status, corps: json };
  }
}

let reussis = 0;
const echecs: string[] = [];

function verifier(condition: boolean, libelle: string, detail?: string): boolean {
  if (condition) {
    reussis += 1;
    console.log("  ✓ " + libelle);
  } else {
    echecs.push(libelle);
    console.log("  ✗ " + libelle + (detail ? "  ->  " + detail : ""));
  }
  return condition;
}

function titre(texte: string): void {
  console.log("\n" + texte);
}

function info(texte: string): void {
  console.log("      " + texte);
}

function resume(reponse: Reponse): string {
  return "statut " + String(reponse.statut) + " " + JSON.stringify(reponse.corps).slice(0, 160);
}

function attendre(millisecondes: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, millisecondes));
}

// Cherche dans Mailpit l'e-mail envoye a cette adresse (plusieurs essais : l'envoi prend un instant).
async function chercherEmail(adresse: string): Promise<{ sujet: string; texte: string } | null> {
  for (let essai = 0; essai < 12; essai += 1) {
    try {
      const liste = await fetch(URL_MAILPIT + "/api/v1/messages?limit=50");
      if (liste.ok) {
        const donnees = (await liste.json()) as {
          messages?: { ID: string; Subject: string; To?: { Address: string }[] }[];
        };
        const trouve = (donnees.messages ?? []).find((message) =>
          (message.To ?? []).some((destinataire) => destinataire.Address.toLowerCase() === adresse),
        );
        if (trouve) {
          const detail = await fetch(URL_MAILPIT + "/api/v1/message/" + trouve.ID);
          const message = (await detail.json()) as { Text?: string };
          return { sujet: trouve.Subject, texte: message.Text ?? "" };
        }
      }
    } catch {
      // Mailpit injoignable : on reessaie, puis on abandonne
    }
    await attendre(1000);
  }
  return null;
}

async function main(base: string, organisationIds: string[]): Promise<void> {
  const emailAdmin = process.env["SEED_ADMIN_EMAIL"];
  const motDePasseAdmin = process.env["SEED_ADMIN_MOT_DE_PASSE"];
  if (!emailAdmin || !motDePasseAdmin) {
    console.error("SEED_ADMIN_EMAIL et SEED_ADMIN_MOT_DE_PASSE doivent être dans backend/.env.");
    echecs.push("variables SEED_ADMIN_* absentes");
    return;
  }

  // ----------------------------------------------------------
  titre("1. Connexion de l'administrateur DTS");
  const admin = new Navigateur(base);
  const connexionAdmin = await admin.appeler("POST", "/api/v1/auth/login", {
    email: emailAdmin,
    mot_de_passe: motDePasseAdmin,
    se_souvenir: false,
  });
  if (!verifier(connexionAdmin.statut === 200, "connexion de l'administrateur (200)", resume(connexionAdmin))) {
    return;
  }
  const moiAdmin = await admin.appeler("GET", "/api/v1/auth/me");
  verifier(moiAdmin.corps["utilisateur"]?.role === "ADMINISTRATEUR", "le compte a bien le rôle ADMINISTRATEUR", resume(moiAdmin));

  // ----------------------------------------------------------
  titre("2. Les 6 secteurs du seed");
  const secteurs = await admin.appeler("GET", "/api/v1/admin/secteurs");
  const codes = ((secteurs.corps["secteurs"] ?? []) as { code: string }[]).map((secteur) => secteur.code);
  verifier(secteurs.statut === 200, "liste des secteurs (200)", resume(secteurs));
  verifier(
    SECTEURS_ATTENDUS.every((code) => codes.includes(code)),
    "restauration, santé, éducation, agroalimentaire, événement et général sont là",
    "trouvés : " + codes.join(", "),
  );
  const secteurSante = ((secteurs.corps["secteurs"] ?? []) as { id: string; code: string }[]).find(
    (secteur) => secteur.code === "sante",
  );

  // ----------------------------------------------------------
  titre("3. Une organisation par secteur : le modèle du secteur est copié en brouillon");
  let santeId = "";
  for (const code of SECTEURS_ATTENDUS) {
    const secteur = ((secteurs.corps["secteurs"] ?? []) as { id: string; code: string }[]).find((ligne) => ligne.code === code);
    if (!secteur) {
      verifier(false, "secteur " + code + " introuvable");
      continue;
    }
    const estSante = code === "sante";
    const creation = await admin.appeler("POST", "/api/v1/admin/organisations", {
      nom: "VERIF-J22-" + code + "-" + suffixe,
      secteur_id: secteur.id,
      ...(estSante ? { couleur_principale: "#0f766e", statut: "ACTIF" } : {}),
    });
    const organisationId = creation.corps["organisation"]?.id as string | undefined;
    if (organisationId) {
      organisationIds.push(organisationId);
    }
    if (!verifier(creation.statut === 201 && organisationId !== undefined, "création de l'organisation " + code + " (201)", resume(creation))) {
      continue;
    }
    if (estSante && organisationId) {
      santeId = organisationId;
    }

    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: creation.corps["questionnaire_id"] as string },
      select: {
        organisation_id: true,
        est_modele: true,
        statut: true,
        message_accueil: true,
        versions: { select: { numero: true, _count: { select: { questions: true } } } },
      },
    });
    const nombreQuestions = questionnaire?.versions[0]?._count.questions ?? 0;
    verifier(
      questionnaire?.organisation_id === organisationId &&
        questionnaire?.est_modele === false &&
        questionnaire?.statut === "BROUILLON" &&
        questionnaire?.versions.length === 1 &&
        nombreQuestions > 0,
      "  modèle copié dans l'organisation, en brouillon, version 1 avec " + String(nombreQuestions) + " questions",
    );

    if (estSante) {
      const accueil = questionnaire?.message_accueil as { fr?: string; en?: string } | null | undefined;
      verifier(
        creation.corps["organisation"]?.statut === "ACTIF" && creation.corps["organisation"]?.couleur_principale === "#0f766e",
        "  statut ACTIF et couleur #0f766e pris en compte",
      );
      verifier(
        typeof accueil?.fr === "string" && accueil.fr.includes(MESSAGE_SANTE),
        "  l'avertissement santé est dans le message d'accueil français",
      );
      verifier(typeof accueil?.en === "string" && accueil.en.length > 0, "  le message d'accueil anglais existe");
      info("Message d'accueil santé (fr) : " + String(accueil?.fr ?? ""));
    }
    if (code === "restauration") {
      const organisation = creation.corps["organisation"] ?? {};
      verifier(
        organisation.statut === "ESSAI" && organisation.pays === "TG" && organisation.fuseau_horaire === "Africa/Lome" && organisation.langue_defaut === "fr",
        "  valeurs par défaut : essai, TG, Africa/Lome, français",
        JSON.stringify(organisation),
      );
    }
  }
  if (santeId === "") {
    console.log("\nL'organisation santé n'a pas été créée : la suite est impossible.");
    return;
  }

  // ----------------------------------------------------------
  titre("4. Invitation du premier responsable (e-mail lu dans Mailpit)");
  const emailResponsable = "verif-j22-" + suffixe + "@exemple.tg";
  const invitation = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/inviter-responsable", {
    email: emailResponsable,
  });
  verifier(invitation.statut === 201, "invitation créée (201)", resume(invitation));
  verifier(invitation.corps["email_envoye"] === true, "le serveur dit que l'e-mail est parti", resume(invitation));
  verifier(
    invitation.corps["invitation"]?.role === "RESPONSABLE" && (invitation.corps["invitation"]?.sites ?? []).length === 0,
    "invitation au rôle Responsable, sans site",
  );

  const courrier = await chercherEmail(emailResponsable);
  const jeton = courrier ? /jeton=([\w-]+)/.exec(courrier.texte)?.[1] : undefined;
  verifier(
    courrier !== null,
    "l'e-mail est arrivé dans Mailpit",
    "Mailpit ne répond pas sur " + URL_MAILPIT + " : docker compose --profile dev up -d mailpit",
  );
  if (courrier) {
    info("Sujet : " + courrier.sujet);
    info("À ouvrir sur " + URL_MAILPIT + " : le message pour " + emailResponsable);
  }
  verifier(jeton !== undefined, "l'e-mail contient le lien d'invitation (jeton)");

  const visiteur = new Navigateur(base);
  const responsable = new Navigateur(base);
  if (jeton) {
    const verification = await visiteur.appeler("GET", "/api/v1/invitations/verifier?jeton=" + encodeURIComponent(jeton));
    verifier(verification.statut === 200, "le lien d'invitation est valide (200)", resume(verification));
    const acceptation = await visiteur.appeler("POST", "/api/v1/invitations/accepter", {
      jeton,
      nom: "Premier Responsable",
      mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    });
    verifier(acceptation.statut === 201, "le premier responsable accepte et crée son compte (201)", resume(acceptation));
    const reutilisation = await visiteur.appeler("POST", "/api/v1/invitations/accepter", {
      jeton,
      nom: "Autre",
      mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    });
    verifier(reutilisation.statut !== 201, "le lien ne marche qu'une fois", resume(reutilisation));
  } else {
    // Sans e-mail, on cree le compte directement pour pouvoir verifier la suite.
    await prisma.utilisateur.create({
      data: {
        email: emailResponsable,
        mot_de_passe_hash: await hash(MOT_DE_PASSE_RESPONSABLE, 4),
        nom: "Premier Responsable",
        role: "RESPONSABLE",
        organisation_id: santeId,
      },
    });
    info("Compte créé directement (sans l'e-mail) pour continuer les vérifications.");
  }

  const connexionResponsable = await responsable.appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionResponsable.statut === 200, "le premier responsable se connecte (200)", resume(connexionResponsable));
  const moiResponsable = await responsable.appeler("GET", "/api/v1/auth/me");
  verifier(
    moiResponsable.corps["utilisateur"]?.role === "RESPONSABLE" &&
      moiResponsable.corps["utilisateur"]?.organisation?.nom === "VERIF-J22-sante-" + suffixe,
    "il est Responsable de l'organisation santé",
    resume(moiResponsable),
  );

  const second = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/inviter-responsable", {
    email: "verif-j22-deuxieme-" + suffixe + "@exemple.tg",
  });
  verifier(second.statut === 409 && second.corps["code"] === "RESPONSABLE_EXISTANT", "un second premier responsable est refusé (409)", resume(second));

  // ----------------------------------------------------------
  titre("5. Accès réservés à l'administrateur DTS");
  const refusResponsableOrg = await responsable.appeler("GET", "/api/v1/admin/organisations");
  const refusResponsableSect = await responsable.appeler("GET", "/api/v1/admin/secteurs");
  verifier(
    refusResponsableOrg.statut === 403 && refusResponsableOrg.corps["code"] === "ACCES_REFUSE",
    "un Responsable reçoit 403 sur /admin/organisations",
    resume(refusResponsableOrg),
  );
  verifier(refusResponsableSect.statut === 403, "un Responsable reçoit 403 sur /admin/secteurs", resume(refusResponsableSect));
  const refusVisiteur = await new Navigateur(base).appeler("GET", "/api/v1/admin/organisations");
  verifier(refusVisiteur.statut === 401, "un visiteur sans connexion reçoit 401", resume(refusVisiteur));

  // ----------------------------------------------------------
  titre("6. Lecture, liste et modification d'une organisation");
  const lecture = await admin.appeler("GET", "/api/v1/admin/organisations/" + santeId);
  verifier(lecture.statut === 200 && lecture.corps["organisation"]?.secteur?.code === "sante", "lecture de l'organisation santé (200)", resume(lecture));
  const liste = await admin.appeler("GET", "/api/v1/admin/organisations?q=VERIF-J22-&limite=100");
  const nombreListe = ((liste.corps["organisations"] ?? []) as unknown[]).length;
  verifier(liste.statut === 200 && nombreListe === 6, "la recherche VERIF-J22- trouve les 6 organisations de ce test", "trouvées : " + String(nombreListe));
  const modification = await admin.appeler("PATCH", "/api/v1/admin/organisations/" + santeId, {
    nom: "VERIF-J22-sante-" + suffixe + " (modifiée)",
    langue_defaut: "en",
  });
  verifier(
    modification.statut === 200 && modification.corps["organisation"]?.langue_defaut === "en",
    "modification du nom et de la langue (200)",
    resume(modification),
  );
  const refusStatut = await admin.appeler("PATCH", "/api/v1/admin/organisations/" + santeId, { statut: "SUSPENDU" });
  verifier(refusStatut.statut === 400, "le statut ne se change pas par PATCH (400)", resume(refusStatut));
  const inconnue = await admin.appeler("GET", "/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000");
  verifier(inconnue.statut === 404, "une organisation inconnue donne 404", resume(inconnue));

  // ----------------------------------------------------------
  titre("7. Suspension : connexion, session et QR code bloqués, puis réactivation");
  const site = await prisma.site.create({
    data: { organisation_id: santeId, nom: "Site vérification " + suffixe },
    select: { id: true },
  });
  const codeQr = randomBytes(9).toString("base64url");
  const point = await prisma.pointContact.create({
    data: { organisation_id: santeId, site_id: site.id, nom: "Table vérification", type: "table", code_public: codeQr },
    select: { id: true },
  });

  const qrAvant = await new Navigateur(base).appeler("GET", "/api/v1/public/q/" + codeQr);
  verifier(qrAvant.statut === 409 && qrAvant.corps["code"] === "QUESTIONNAIRE_INACTIF", "avant : le QR code répond « questionnaire non disponible » (le modèle est un brouillon)", resume(qrAvant));

  const suspension = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/suspendre");
  verifier(suspension.statut === 200 && suspension.corps["organisation"]?.statut === "SUSPENDU", "suspension (200, statut SUSPENDU)", resume(suspension));
  const deuxSuspensions = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/suspendre");
  verifier(deuxSuspensions.statut === 409 && deuxSuspensions.corps["code"] === "DEJA_SUSPENDUE", "suspendre deux fois est refusé (409)", resume(deuxSuspensions));

  const sessionSuspendue = await responsable.appeler("GET", "/api/v1/auth/me");
  verifier(sessionSuspendue.statut === 401 && sessionSuspendue.corps["code"] === "ORGANISATION_SUSPENDUE", "la session en cours du responsable est refusée (401)", resume(sessionSuspendue));
  const connexionSuspendue = await new Navigateur(base).appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionSuspendue.statut === 403 && connexionSuspendue.corps["code"] === "ORGANISATION_SUSPENDUE", "une nouvelle connexion est refusée (403)", resume(connexionSuspendue));
  const qrSuspendu = await new Navigateur(base).appeler("GET", "/api/v1/public/q/" + codeQr);
  verifier(qrSuspendu.statut === 403 && qrSuspendu.corps["code"] === "ORGANISATION_SUSPENDUE", "le QR code répond « organisation suspendue » (403)", resume(qrSuspendu));
  verifier((await prisma.scan.count({ where: { point_contact_id: point.id } })) === 0, "le scan du QR suspendu n'est pas compté");

  const reactivation = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/reactiver");
  verifier(reactivation.statut === 200 && reactivation.corps["organisation"]?.statut === "ACTIF", "réactivation (200, statut ACTIF)", resume(reactivation));
  const deuxReactivations = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/reactiver");
  verifier(deuxReactivations.statut === 409 && deuxReactivations.corps["code"] === "PAS_SUSPENDUE", "réactiver une organisation active est refusé (409)", resume(deuxReactivations));
  const connexionRetour = await new Navigateur(base).appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionRetour.statut === 200, "le responsable peut se reconnecter (200)", resume(connexionRetour));
  const qrApres = await new Navigateur(base).appeler("GET", "/api/v1/public/q/" + codeQr);
  verifier(qrApres.statut === 409 && qrApres.corps["code"] === "QUESTIONNAIRE_INACTIF", "après : le QR code n'est plus bloqué par la suspension", resume(qrApres));

  // ----------------------------------------------------------
  titre("8. Lecture d'un secteur et de ses questionnaires types");
  if (secteurSante) {
    const unSecteur = await admin.appeler("GET", "/api/v1/admin/secteurs/" + secteurSante.id);
    verifier(unSecteur.statut === 200 && unSecteur.corps["secteur"]?.code === "sante", "lecture du secteur santé (200)", resume(unSecteur));
    const modeles = await admin.appeler("GET", "/api/v1/admin/secteurs/" + secteurSante.id + "/questionnaires-types");
    const nombreModeles = ((modeles.corps["questionnaires_types"] ?? []) as unknown[]).length;
    verifier(modeles.statut === 200 && nombreModeles >= 1, "le secteur santé a son questionnaire type (" + String(nombreModeles) + ")", resume(modeles));
  } else {
    verifier(false, "secteur santé introuvable");
  }

  await admin.appeler("POST", "/api/v1/auth/logout");
}

// Supprime tout ce que ce script a cree (meme ordre que le nettoyage des tests).
async function nettoyer(organisationIds: string[]): Promise<void> {
  if (organisationIds.length === 0) {
    return;
  }
  const comptes = await prisma.utilisateur.findMany({
    where: { organisation_id: { in: organisationIds } },
    select: { id: true },
  });
  const utilisateurIds = comptes.map((compte) => compte.id);

  await prisma.auditLog.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.jetonInvitation.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.scan.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.question.deleteMany({
    where: { version: { questionnaire: { organisation_id: { in: organisationIds } } } },
  });
  await prisma.questionnaireVersion.deleteMany({
    where: { questionnaire: { organisation_id: { in: organisationIds } } },
  });
  await prisma.questionnaire.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateurSite.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
}

async function lancer(): Promise<void> {
  const serveur = app.listen(0);
  await new Promise<void>((resoudre) => serveur.once("listening", () => resoudre()));
  const port = (serveur.address() as AddressInfo).port;
  console.log("Vérification du jour 22 (serveur de test sur le port " + String(port) + ")");

  const organisationIds: string[] = [];
  try {
    await main("http://127.0.0.1:" + String(port), organisationIds);
  } catch (erreur) {
    console.error("\nErreur inattendue :", erreur);
    echecs.push("erreur inattendue");
  } finally {
    try {
      await nettoyer(organisationIds);
      console.log("\nNettoyage : les " + String(organisationIds.length) + " organisations de test et leurs comptes sont supprimés.");
    } catch (erreur) {
      console.error("\nNettoyage impossible :", erreur);
      echecs.push("nettoyage impossible");
    }
    serveur.close();
    await prisma.$disconnect();
  }

  console.log("\n" + (echecs.length === 0 ? "✓ Tout est bon : " : "✗ À corriger : ") + String(reussis) + " vérifications réussies, " + String(echecs.length) + " échec(s).");
  for (const echec of echecs) {
    console.log("  - " + echec);
  }
  process.exit(echecs.length === 0 ? 0 : 1);
}

void lancer();