import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { app } from "../app";
import { prisma } from "../configuration/base-de-donnees";

// ------------------------------------------------------------
// Verification du jour 23 (ecrans E17 et E18) : npx tsx src/scripts/verification-jour-23.ts
// ------------------------------------------------------------
// Les ecrans appellent les routes admin du jour 22 : ce script deroule donc, par l'API, exactement ce que
// font les ecrans E17 et E18 et chronometre le scenario 13 (organisation sante operationnelle en moins de 15 min) :
//   A. nouveau secteur cree et modifie sans toucher au code, avec ses themes (E18)
//   B. organisation de ce secteur sans questionnaire type (message clair, creation quand meme possible)
//   C. scenario 13 : organisation sante, invitation (e-mail dans Mailpit), compte, site, tables 1 a 40
//   D. acces reserves a l'administrateur, liste et filtres de E17
//   E. suspension puis reactivation (connexion et QR code)
// Prerequis : base demarree, seed lance, Mailpit demarre (docker compose --profile dev up -d mailpit).
// A la fin, tout ce qui a ete cree est supprime (sauf l'e-mail dans Mailpit).

const suffixe = randomBytes(4).toString("hex");
const URL_MAILPIT = process.env["MAILPIT_URL"] ?? "http://localhost:8025";
const MOT_DE_PASSE_RESPONSABLE = "Verification-Jour23-2026";
const LIMITE_SCENARIO_13_SECONDES = 15 * 60;

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

async function main(base: string, organisationIds: string[], secteurIds: string[]): Promise<void> {
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

  // ----------------------------------------------------------
  titre("2. Écran E18 : un nouveau secteur sans toucher au code");
  const codeSecteur = "verif_j23_" + suffixe;
  const creationSecteur = await admin.appeler("POST", "/api/v1/admin/secteurs", {
    code: codeSecteur,
    nom_fr: "Secteur vérification " + suffixe,
    nom_en: "Verification sector " + suffixe,
    vocabulaire: { point_contact: "atelier" },
    indicateurs_suggeres: ["nps", "note_moyenne"],
  });
  const secteurId = creationSecteur.corps["secteur"]?.id as string | undefined;
  if (secteurId) {
    secteurIds.push(secteurId);
  }
  if (!verifier(creationSecteur.statut === 201 && secteurId !== undefined, "création du secteur (201)", resume(creationSecteur))) {
    return;
  }
  const doublon = await admin.appeler("POST", "/api/v1/admin/secteurs", {
    code: codeSecteur,
    nom_fr: "Autre",
    nom_en: "Other",
    vocabulaire: { point_contact: "atelier" },
  });
  verifier(doublon.statut === 409, "un second secteur avec le même code est refusé (409)", resume(doublon));
  const sansMot = await admin.appeler("POST", "/api/v1/admin/secteurs", {
    code: codeSecteur + "_b",
    nom_fr: "Sans mot",
    nom_en: "No word",
    vocabulaire: { chambre: "chambre" },
  });
  verifier(sansMot.statut === 400, "un vocabulaire sans le mot point_contact est refusé (400)", resume(sansMot));

  const modification = await admin.appeler("PATCH", "/api/v1/admin/secteurs/" + secteurId, {
    nom_fr: "Secteur vérification modifié " + suffixe,
    vocabulaire: { point_contact: "atelier", salle: "salle" },
  });
  verifier(
    modification.statut === 200 && modification.corps["secteur"]?.nom_fr === "Secteur vérification modifié " + suffixe,
    "modification du nom et du vocabulaire (200)",
    resume(modification),
  );
  const changementCode = await admin.appeler("PATCH", "/api/v1/admin/secteurs/" + secteurId, { code: "autre_code" });
  verifier(changementCode.statut === 400, "le code d'un secteur ne change pas (400)", resume(changementCode));

  const theme1 = await admin.appeler("POST", "/api/v1/admin/secteurs/" + secteurId + "/themes", {
    code: "accueil",
    libelle_fr: "Accueil",
    libelle_en: "Welcome",
    ordre: 1,
  });
  const theme2 = await admin.appeler("POST", "/api/v1/admin/secteurs/" + secteurId + "/themes", {
    code: "qualite",
    libelle_fr: "Qualité",
    libelle_en: "Quality",
    ordre: 2,
  });
  verifier(theme1.statut === 201 && theme2.statut === 201, "deux thèmes ajoutés (201)", resume(theme1) + " / " + resume(theme2));
  const themeDoublon = await admin.appeler("POST", "/api/v1/admin/secteurs/" + secteurId + "/themes", {
    code: "accueil",
    libelle_fr: "Accueil bis",
    libelle_en: "Welcome bis",
  });
  verifier(themeDoublon.statut === 409, "un thème avec le même code est refusé (409)", resume(themeDoublon));
  const themeId = theme1.corps["theme"]?.id as string | undefined;
  if (themeId) {
    const themeModifie = await admin.appeler("PATCH", "/api/v1/admin/secteurs/" + secteurId + "/themes/" + themeId, {
      libelle_fr: "Accueil modifié",
    });
    verifier(themeModifie.statut === 200 && themeModifie.corps["theme"]?.libelle_fr === "Accueil modifié", "modification d'un thème (200)", resume(themeModifie));
  }
  const fiche = await admin.appeler("GET", "/api/v1/admin/secteurs/" + secteurId);
  verifier(
    fiche.statut === 200 && ((fiche.corps["secteur"]?.themes ?? []) as unknown[]).length === 2,
    "la fiche du secteur montre ses 2 thèmes",
    resume(fiche),
  );
  const listeSecteurs = await admin.appeler("GET", "/api/v1/admin/secteurs");
  verifier(
    ((listeSecteurs.corps["secteurs"] ?? []) as { code: string }[]).some((secteur) => secteur.code === codeSecteur),
    "le nouveau secteur apparaît dans la liste (E18)",
  );
  const modelesVides = await admin.appeler("GET", "/api/v1/admin/secteurs/" + secteurId + "/questionnaires-types");
  verifier(
    modelesVides.statut === 200 && ((modelesVides.corps["questionnaires_types"] ?? []) as unknown[]).length === 0,
    "le nouveau secteur n'a aucun questionnaire type (l'écran affiche le message clair)",
    resume(modelesVides),
  );

  // ----------------------------------------------------------
  titre("3. Écran E17 : organisation du nouveau secteur, même sans questionnaire type");
  const creationNouveau = await admin.appeler("POST", "/api/v1/admin/organisations", {
    nom: "VERIF-J23-nouveau-" + suffixe,
    secteur_id: secteurId,
  });
  const nouveauId = creationNouveau.corps["organisation"]?.id as string | undefined;
  if (nouveauId) {
    organisationIds.push(nouveauId);
  }
  verifier(
    creationNouveau.statut === 201 && nouveauId !== undefined && creationNouveau.corps["questionnaire_id"] === null,
    "création de l'organisation (201), sans questionnaire copié",
    resume(creationNouveau),
  );

  // ----------------------------------------------------------
  titre("4. Scénario 13 : organisation santé opérationnelle en moins de 15 minutes");
  const secteurs = await admin.appeler("GET", "/api/v1/admin/secteurs");
  const secteurSante = ((secteurs.corps["secteurs"] ?? []) as { id: string; code: string }[]).find((secteur) => secteur.code === "sante");
  if (!verifier(secteurSante !== undefined, "le secteur santé existe (seed lancé)")) {
    return;
  }
  const debut = Date.now();
  const creation = await admin.appeler("POST", "/api/v1/admin/organisations", {
    nom: "VERIF-J23-sante-" + suffixe,
    secteur_id: secteurSante?.id,
    statut: "ACTIF",
  });
  const santeId = creation.corps["organisation"]?.id as string | undefined;
  if (santeId) {
    organisationIds.push(santeId);
  }
  if (!verifier(creation.statut === 201 && santeId !== undefined, "création de l'organisation santé (201)", resume(creation))) {
    return;
  }
  const emailResponsable = "verif-j23-" + suffixe + "@exemple.tg";
  const invitation = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/inviter-responsable", {
    email: emailResponsable,
  });
  verifier(invitation.statut === 201 && invitation.corps["email_envoye"] === true, "invitation du premier responsable envoyée (201)", resume(invitation));

  const courrier = await chercherEmail(emailResponsable);
  const jeton = courrier ? /jeton=([\w-]+)/.exec(courrier.texte)?.[1] : undefined;
  verifier(courrier !== null, "l'e-mail est arrivé dans Mailpit", "Mailpit ne répond pas sur " + URL_MAILPIT + " : docker compose --profile dev up -d mailpit");
  verifier(jeton !== undefined, "l'e-mail contient le lien d'invitation");
  if (!jeton) {
    return;
  }
  const visiteur = new Navigateur(base);
  const acceptation = await visiteur.appeler("POST", "/api/v1/invitations/accepter", {
    jeton,
    nom: "Premier Responsable",
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
  });
  verifier(acceptation.statut === 201, "le responsable accepte l'invitation (201)", resume(acceptation));

  const responsable = new Navigateur(base);
  const connexionResponsable = await responsable.appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionResponsable.statut === 200, "le responsable se connecte (200)", resume(connexionResponsable));

  // Ecran E12 : le responsable cree son site puis ses tables 1 a 40 en un clic.
  const creationSite = await responsable.appeler("POST", "/api/v1/sites", { nom: "Site vérification " + suffixe });
  const siteId = creationSite.corps["site"]?.id as string | undefined;
  verifier(creationSite.statut === 201 && siteId !== undefined, "le responsable crée son site (201)", resume(creationSite));
  if (siteId) {
    const masse = await responsable.appeler("POST", "/api/v1/points-contact/masse", {
      site_id: siteId,
      prefixe: "Table",
      type: "table",
      debut: 1,
      fin: 40,
    });
    verifier(masse.statut === 201 && masse.corps["crees"] === 40, "tables 1 à 40 créées en un coup (201)", resume(masse));
  }
  const secondes = Math.round((Date.now() - debut) / 1000);
  verifier(
    secondes < LIMITE_SCENARIO_13_SECONDES,
    "organisation santé prête en " + String(secondes) + " s par l'API (limite : 15 minutes)",
  );
  info("Le temps réel du scénario 13 se note à la main dans les écrans E17, Mailpit puis E12.");
  const nombrePoints = santeId ? await prisma.pointContact.count({ where: { organisation_id: santeId } }) : 0;
  verifier(nombrePoints === 40, "40 points de contact en base pour cette organisation", "trouvés : " + String(nombrePoints));

  // ----------------------------------------------------------
  titre("5. Accès réservés à l'administrateur DTS");
  const refusOrganisations = await responsable.appeler("GET", "/api/v1/admin/organisations");
  const refusSecteurs = await responsable.appeler("GET", "/api/v1/admin/secteurs");
  const refusCreationSecteur = await responsable.appeler("POST", "/api/v1/admin/secteurs", {
    code: "pirate_" + suffixe,
    nom_fr: "Pirate",
    nom_en: "Pirate",
    vocabulaire: { point_contact: "table" },
  });
  verifier(refusOrganisations.statut === 403, "un Responsable reçoit 403 sur /admin/organisations", resume(refusOrganisations));
  verifier(refusSecteurs.statut === 403, "un Responsable reçoit 403 sur /admin/secteurs", resume(refusSecteurs));
  verifier(refusCreationSecteur.statut === 403, "un Responsable ne peut pas créer de secteur (403)", resume(refusCreationSecteur));
  const refusVisiteur = await new Navigateur(base).appeler("GET", "/api/v1/admin/secteurs");
  verifier(refusVisiteur.statut === 401, "un visiteur sans connexion reçoit 401", resume(refusVisiteur));
  const moiAdmin = await admin.appeler("GET", "/api/v1/auth/me");
  verifier(moiAdmin.corps["utilisateur"]?.role === "ADMINISTRATEUR", "le compte admin est bien ADMINISTRATEUR (le menu E17 et E18 lui est réservé)");

  // ----------------------------------------------------------
  titre("6. Liste de l'écran E17 : recherche et filtre de statut");
  const liste = await admin.appeler("GET", "/api/v1/admin/organisations?q=VERIF-J23-&limite=100");
  const nombreListe = ((liste.corps["organisations"] ?? []) as unknown[]).length;
  verifier(liste.statut === 200 && nombreListe === 2, "la recherche VERIF-J23- trouve les 2 organisations de ce test", "trouvées : " + String(nombreListe));

  // ----------------------------------------------------------
  titre("7. Suspension et réactivation (confirmations de l'écran E17)");
  const point = santeId ? await prisma.pointContact.findFirst({ where: { organisation_id: santeId }, select: { code_public: true } }) : null;
  const suspension = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/suspendre");
  verifier(suspension.statut === 200 && suspension.corps["organisation"]?.statut === "SUSPENDU", "suspension (200, SUSPENDU)", resume(suspension));
  const listeSuspendues = await admin.appeler("GET", "/api/v1/admin/organisations?q=VERIF-J23-&statut=SUSPENDU&limite=100");
  verifier(((listeSuspendues.corps["organisations"] ?? []) as unknown[]).length === 1, "le filtre SUSPENDU ne montre que l'organisation suspendue");
  const connexionRefusee = await new Navigateur(base).appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionRefusee.statut === 403 && connexionRefusee.corps["code"] === "ORGANISATION_SUSPENDUE", "la connexion du responsable est refusée (403)", resume(connexionRefusee));
  if (point) {
    const qr = await new Navigateur(base).appeler("GET", "/api/v1/public/q/" + point.code_public);
    verifier(qr.statut === 403 && qr.corps["code"] === "ORGANISATION_SUSPENDUE", "le QR code répond « organisation suspendue » (403)", resume(qr));
  }
  const reactivation = await admin.appeler("POST", "/api/v1/admin/organisations/" + santeId + "/reactiver");
  verifier(reactivation.statut === 200 && reactivation.corps["organisation"]?.statut === "ACTIF", "réactivation (200, ACTIF)", resume(reactivation));
  const connexionRetour = await new Navigateur(base).appeler("POST", "/api/v1/auth/login", {
    email: emailResponsable,
    mot_de_passe: MOT_DE_PASSE_RESPONSABLE,
    se_souvenir: false,
  });
  verifier(connexionRetour.statut === 200, "le responsable se reconnecte (200)", resume(connexionRetour));

  await admin.appeler("POST", "/api/v1/auth/logout");
}

// Supprime tout ce que ce script a cree.
async function nettoyer(organisationIds: string[], secteurIds: string[]): Promise<void> {
  if (organisationIds.length > 0) {
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
  if (secteurIds.length > 0) {
    await prisma.theme.deleteMany({ where: { secteur_id: { in: secteurIds } } });
    await prisma.secteur.deleteMany({ where: { id: { in: secteurIds } } });
  }
}

async function lancer(): Promise<void> {
  const serveur = app.listen(0);
  await new Promise<void>((resoudre) => serveur.once("listening", () => resoudre()));
  const port = (serveur.address() as AddressInfo).port;
  console.log("Vérification du jour 23 (serveur de test sur le port " + String(port) + ")");

  const organisationIds: string[] = [];
  const secteurIds: string[] = [];
  try {
    await main("http://127.0.0.1:" + String(port), organisationIds, secteurIds);
  } catch (erreur) {
    console.error("\nErreur inattendue :", erreur);
    echecs.push("erreur inattendue");
  } finally {
    try {
      await nettoyer(organisationIds, secteurIds);
      console.log("\nNettoyage : " + String(organisationIds.length) + " organisations, " + String(secteurIds.length) + " secteur de test et leurs comptes sont supprimés.");
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