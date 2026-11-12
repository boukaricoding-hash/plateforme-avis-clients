import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import type { EmailAEnvoyer } from "../../src/utilitaires/envoi-email";

// Les e-mails ne partent pas vraiment : on les garde en memoire pour lire le lien d'invitation.
const { emailsEnvoyes } = vi.hoisted(() => ({ emailsEnvoyes: [] as EmailAEnvoyer[] }));

vi.mock("../../src/utilitaires/envoi-email", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/utilitaires/envoi-email")>();
  return {
    ...original,
    envoyerEmail: vi.fn(async (email: EmailAEnvoyer) => {
      emailsEnvoyes.push(email);
      return true;
    }),
  };
});

import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Jour 22 : back-office DTS, routes /api/v1/admin/organisations.
// - creation (avec clonage du modele du secteur), lecture, liste, modification ;
// - invitation du premier responsable, puis acceptation et connexion ;
// - suspension : connexion refusee, session en cours refusee, QR code bloque ; reactivation.
// Les controles d'acces (visiteur, Responsable) sont dans isolation-admin.test.ts.
// Prerequis : le seed a ete lance (secteurs et modeles sectoriels).
// Attention : la connexion est limitee a 10 essais par minute.
// Ce fichier en fait 6 : il ne faut pas en ajouter sans en retirer.
// Toutes les organisations et tous les comptes de test sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Admin-Orgs-2026";
const MOT_DE_PASSE_RESPONSABLE = "Premier-Responsable-2026";
const MESSAGE_SANTE = "Ne mentionnez aucune information médicale personnelle.";

type Agent = ReturnType<typeof request.agent>;

let agentAdmin: Agent;
let adminId: string;
let motDePasseHash: string;

// Organisations creees par l'API (nettoyees a la fin)
const organisationIds: string[] = [];

// Organisation sante (creee par le test de creation), puis organisation essai
let santeId = "";
let essaiId = "";

// Organisation de la suspension : un responsable connecte, un site, un QR code
let suspId = "";
let suspResponsableEmail = "";
let suspCode = "";
let suspPointId = "";
let agentResponsableSusp: Agent;

function adresse(etiquette: string): string {
  return etiquette + "-" + suffixe + "@test-admin-orgs.local";
}

function nomOrganisation(etiquette: string): string {
  return "TEST-ADMIN-" + etiquette + "-" + suffixe;
}

async function connecterAgent(email: string, motDePasse: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: motDePasse, se_souvenir: false })
    .expect(200);
  return agent;
}

async function secteurId(code: string): Promise<string> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code }, select: { id: true } });
  return secteur.id;
}

// Cree une organisation par l'API et la note pour le nettoyage.
async function creerParApi(corps: Record<string, unknown>) {
  const reponse = await agentAdmin.post("/api/v1/admin/organisations").send(corps);
  const id = reponse.body?.organisation?.id;
  if (typeof id === "string") {
    organisationIds.push(id);
  }
  return reponse;
}

async function compterAudit(organisationId: string, action: string): Promise<number> {
  return prisma.auditLog.count({ where: { organisation_id: organisationId, action } });
}

// Lit le jeton dans le dernier e-mail envoye a cette adresse.
function lireJeton(email: string): string {
  const courrier = [...emailsEnvoyes].reverse().find((message) => message.a === email);
  if (!courrier) {
    throw new Error("Aucun e-mail intercepte pour " + email);
  }
  const jeton = /jeton=([\w-]+)/.exec(courrier.texte)?.[1];
  if (!jeton) {
    throw new Error("Aucun jeton dans l'e-mail");
  }
  return jeton;
}

beforeAll(async () => {
  // Limites hautes : les tests ne doivent pas se bloquer eux-memes.
  process.env["LIMITE_INVITATION_VERIFICATION_MAX"] = "1000";
  process.env["LIMITE_INVITATION_ACCEPTATION_MAX"] = "1000";

  motDePasseHash = await hash(MOT_DE_PASSE, 4);

  // Le compte Administrateur DTS : role ADMINISTRATEUR, aucune organisation.
  const admin = await prisma.utilisateur.create({
    data: {
      email: adresse("admin"),
      mot_de_passe_hash: motDePasseHash,
      nom: "Admin test organisations",
      role: "ADMINISTRATEUR",
    },
    select: { id: true },
  });
  adminId = admin.id;
  agentAdmin = await connecterAgent(adresse("admin"), MOT_DE_PASSE);

  // Organisation de la suspension : creee par l'API, avec un responsable, un site et un QR code.
  const creation = await creerParApi({
    nom: nomOrganisation("SUSPENSION"),
    secteur_id: await secteurId("restauration"),
    statut: "ACTIF",
  });
  expect(creation.status).toBe(201);
  suspId = creation.body.organisation.id as string;

  suspResponsableEmail = adresse("responsable-susp");
  await prisma.utilisateur.create({
    data: {
      email: suspResponsableEmail,
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable suspension",
      role: "RESPONSABLE",
      organisation_id: suspId,
    },
  });
  const site = await prisma.site.create({
    data: { organisation_id: suspId, nom: "Site suspension " + suffixe },
    select: { id: true },
  });
  suspCode = randomBytes(9).toString("base64url");
  const point = await prisma.pointContact.create({
    data: {
      organisation_id: suspId,
      site_id: site.id,
      nom: "Table suspension",
      type: "table",
      code_public: suspCode,
    },
    select: { id: true },
  });
  suspPointId = point.id;
  agentResponsableSusp = await connecterAgent(suspResponsableEmail, MOT_DE_PASSE);
}, 60000);

afterAll(async () => {
  delete process.env["LIMITE_INVITATION_VERIFICATION_MAX"];
  delete process.env["LIMITE_INVITATION_ACCEPTATION_MAX"];

  if (organisationIds.length > 0) {
    const comptes = await prisma.utilisateur.findMany({
      where: { organisation_id: { in: organisationIds } },
      select: { id: true },
    });
    const utilisateurIds = [...comptes.map((compte) => compte.id), ...(adminId ? [adminId] : [])];

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { organisation_id: { in: organisationIds } },
          { utilisateur_id: { in: utilisateurIds } },
        ],
      },
    });
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
  } else if (adminId) {
    await prisma.auditLog.deleteMany({ where: { utilisateur_id: adminId } });
    await prisma.session.deleteMany({ where: { utilisateur_id: adminId } });
    await prisma.utilisateur.deleteMany({ where: { id: adminId } });
  }
  await prisma.$disconnect();
}, 60000);

// ------------------------------------------------------------
// Creation
// ------------------------------------------------------------

describe("admin organisations : creation", () => {
  it("cree une organisation sante et clone le modele du secteur en brouillon", async () => {
    const reponse = await creerParApi({
      nom: nomOrganisation("SANTE"),
      secteur_id: await secteurId("sante"),
      couleur_principale: "#0f766e",
      pays: "tg",
      statut: "ACTIF",
    });
    expect(reponse.status).toBe(201);

    const organisation = reponse.body.organisation;
    santeId = organisation.id as string;
    expect(organisation.nom).toBe(nomOrganisation("SANTE"));
    expect(organisation.statut).toBe("ACTIF");
    expect(organisation.secteur.code).toBe("sante");
    expect(organisation.couleur_principale).toBe("#0f766e");
    expect(organisation.pays).toBe("TG");
    expect(organisation.fuseau_horaire).toBe("Africa/Lome");
    expect(organisation.langue_defaut).toBe("fr");
    // Rien d'interne ne sort de l'API
    expect(organisation).not.toHaveProperty("supprime_le");
    expect(organisation).not.toHaveProperty("seuil_alerte_note");

    // Le modele sante est copie dans l'organisation, en brouillon, avec l'avertissement
    expect(typeof reponse.body.questionnaire_id).toBe("string");
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: reponse.body.questionnaire_id as string },
      select: {
        organisation_id: true,
        est_modele: true,
        statut: true,
        message_accueil: true,
        versions: { select: { numero: true, _count: { select: { questions: true } } } },
      },
    });
    expect(questionnaire.organisation_id).toBe(santeId);
    expect(questionnaire.est_modele).toBe(false);
    expect(questionnaire.statut).toBe("BROUILLON");
    expect(questionnaire.versions).toHaveLength(1);
    expect(questionnaire.versions[0]?.numero).toBe(1);
    expect(questionnaire.versions[0]?._count.questions).toBe(7);
    const accueil = questionnaire.message_accueil as { fr: string; en: string };
    expect(accueil.fr).toContain(MESSAGE_SANTE);

    expect(await compterAudit(santeId, "ORGANISATION_CREEE")).toBe(1);
  });

  it("applique les valeurs par defaut : statut essai, Togo, Africa/Lome, francais", async () => {
    const reponse = await creerParApi({
      nom: nomOrganisation("ESSAI"),
      secteur_id: await secteurId("general"),
    });
    expect(reponse.status).toBe(201);
    essaiId = reponse.body.organisation.id as string;
    expect(reponse.body.organisation.statut).toBe("ESSAI");
    expect(reponse.body.organisation.pays).toBe("TG");
    expect(reponse.body.organisation.fuseau_horaire).toBe("Africa/Lome");
    expect(reponse.body.organisation.langue_defaut).toBe("fr");
    expect(reponse.body.organisation.couleur_principale).toBeNull();
    expect(typeof reponse.body.questionnaire_id).toBe("string");
  });

  it("refuse un secteur inconnu et les donnees invalides, sans rien creer", async () => {
    const secteurSante = await secteurId("sante");
    const nom = "REFUSE-" + suffixe;

    const inconnu = await agentAdmin
      .post("/api/v1/admin/organisations")
      .send({ nom, secteur_id: "00000000-0000-4000-8000-000000000000" });
    expect(inconnu.status).toBe(400);
    expect(inconnu.body.code).toBe("SECTEUR_INVALIDE");

    const invalides: Record<string, unknown>[] = [
      { secteur_id: secteurSante },
      { nom: "A", secteur_id: secteurSante },
      { nom, secteur_id: "pas-un-uuid" },
      { nom, secteur_id: secteurSante, couleur_principale: "rouge" },
      { nom, secteur_id: secteurSante, fuseau_horaire: "Mars/Base" },
      { nom, secteur_id: secteurSante, statut: "SUSPENDU" },
      { nom, secteur_id: secteurSante, langue_defaut: "de" },
      // Le logo ne s'envoie pas a la creation (ecran E14) : tout champ inconnu est refuse
      { nom, secteur_id: secteurSante, logo_url: "https://exemple.local/logo.png" },
    ];
    for (const corps of invalides) {
      const reponse = await agentAdmin.post("/api/v1/admin/organisations").send(corps);
      expect(reponse.status).toBe(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
    }

    expect(await prisma.organisation.count({ where: { nom } })).toBe(0);
  });
});

// ------------------------------------------------------------
// Lecture, liste et modification
// ------------------------------------------------------------

describe("admin organisations : lecture, liste et modification", () => {
  it("lit une organisation et refuse un identifiant inconnu ou mal forme", async () => {
    const lecture = await agentAdmin.get("/api/v1/admin/organisations/" + santeId).expect(200);
    expect(lecture.body.organisation.id).toBe(santeId);
    expect(lecture.body.organisation.secteur.code).toBe("sante");

    const inconnue = await agentAdmin
      .get("/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000")
      .expect(404);
    expect(inconnue.body.code).toBe("NON_TROUVE");

    const malFormee = await agentAdmin.get("/api/v1/admin/organisations/abc").expect(400);
    expect(malFormee.body.code).toBe("DONNEES_INVALIDES");
  });

  it("liste avec recherche, filtre de statut et pagination", async () => {
    const liste = await agentAdmin.get("/api/v1/admin/organisations?q=" + suffixe).expect(200);
    const ids = (liste.body.organisations as { id: string }[]).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([santeId, essaiId, suspId]));
    expect(liste.body.pagination.total).toBe(3);
    expect(liste.body.pagination.page).toBe(1);

    // Filtre de statut : seule l'organisation d'essai
    const essais = await agentAdmin
      .get("/api/v1/admin/organisations?statut=ESSAI&q=" + suffixe)
      .expect(200);
    expect((essais.body.organisations as { id: string }[]).map((o) => o.id)).toEqual([essaiId]);

    // Pagination : une organisation par page, trois pages
    const page = await agentAdmin
      .get("/api/v1/admin/organisations?limite=1&page=2&q=" + suffixe)
      .expect(200);
    expect(page.body.organisations).toHaveLength(1);
    expect(page.body.pagination.pages).toBe(3);

    await agentAdmin.get("/api/v1/admin/organisations?limite=0").expect(400);
    await agentAdmin.get("/api/v1/admin/organisations?statut=BIDON").expect(400);
  });

  it("modifie le nom, la couleur et la langue, et refuse le secteur et le statut", async () => {
    const modifiee = await agentAdmin
      .patch("/api/v1/admin/organisations/" + essaiId)
      .send({ nom: nomOrganisation("ESSAI-MODIFIE"), couleur_principale: "#1d4ed8", langue_defaut: "en" })
      .expect(200);
    expect(modifiee.body.organisation.nom).toBe(nomOrganisation("ESSAI-MODIFIE"));
    expect(modifiee.body.organisation.couleur_principale).toBe("#1d4ed8");
    expect(modifiee.body.organisation.langue_defaut).toBe("en");
    expect(modifiee.body.organisation.statut).toBe("ESSAI");
    expect(await compterAudit(essaiId, "ORGANISATION_MODIFIEE")).toBe(1);

    // La couleur peut etre retiree
    const sansCouleur = await agentAdmin
      .patch("/api/v1/admin/organisations/" + essaiId)
      .send({ couleur_principale: null })
      .expect(200);
    expect(sansCouleur.body.organisation.couleur_principale).toBeNull();

    // Corps vide, secteur et statut : refuses, rien ne change
    await agentAdmin.patch("/api/v1/admin/organisations/" + essaiId).send({}).expect(400);
    await agentAdmin
      .patch("/api/v1/admin/organisations/" + essaiId)
      .send({ secteur_id: await secteurId("sante") })
      .expect(400);
    await agentAdmin
      .patch("/api/v1/admin/organisations/" + essaiId)
      .send({ statut: "SUSPENDU" })
      .expect(400);
    const enBase = await prisma.organisation.findUniqueOrThrow({
      where: { id: essaiId },
      select: { statut: true, secteur: { select: { code: true } } },
    });
    expect(enBase.statut).toBe("ESSAI");
    expect(enBase.secteur.code).toBe("general");

    await agentAdmin
      .patch("/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000")
      .send({ nom: "Inconnue" })
      .expect(404);
  });
});

// ------------------------------------------------------------
// Premier responsable
// ------------------------------------------------------------

describe("admin organisations : premier responsable", () => {
  const emailResponsable = adresse("premier-responsable");

  it("refuse une adresse invalide et une organisation inconnue", async () => {
    const invalide = await agentAdmin
      .post("/api/v1/admin/organisations/" + santeId + "/inviter-responsable")
      .send({ email: "pas-une-adresse" })
      .expect(400);
    expect(invalide.body.code).toBe("DONNEES_INVALIDES");

    // Le role ne se choisit pas : tout champ en plus est refuse
    await agentAdmin
      .post("/api/v1/admin/organisations/" + santeId + "/inviter-responsable")
      .send({ email: emailResponsable, role: "ADMINISTRATEUR" })
      .expect(400);

    await agentAdmin
      .post("/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000/inviter-responsable")
      .send({ email: emailResponsable })
      .expect(404);
  });

  it("invite le premier responsable (role Responsable, sans site) et peut renvoyer le lien", async () => {
    const reponse = await agentAdmin
      .post("/api/v1/admin/organisations/" + santeId + "/inviter-responsable")
      .send({ email: emailResponsable.toUpperCase() })
      .expect(201);
    expect(reponse.body.email_envoye).toBe(true);
    expect(reponse.body.invitation.email).toBe(emailResponsable);
    expect(reponse.body.invitation.role).toBe("RESPONSABLE");
    expect(reponse.body.invitation.sites).toEqual([]);

    const lignes = await prisma.jetonInvitation.findMany({
      where: { organisation_id: santeId, email: emailResponsable },
      select: { role: true, site_ids: true, utilise_le: true },
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.role).toBe("RESPONSABLE");
    expect(lignes[0]?.site_ids).toEqual([]);
    expect(await compterAudit(santeId, "PREMIER_RESPONSABLE_INVITE")).toBe(1);

    // Renvoi : une deuxieme demande donne un nouveau lien, l'ancien ne marche plus
    const ancienJeton = lireJeton(emailResponsable);
    await agentAdmin
      .post("/api/v1/admin/organisations/" + santeId + "/inviter-responsable")
      .send({ email: emailResponsable })
      .expect(201);
    const nouveauJeton = lireJeton(emailResponsable);
    expect(nouveauJeton).not.toBe(ancienJeton);
    const ancien = await request(app).get(
      "/api/v1/invitations/verifier?jeton=" + encodeURIComponent(ancienJeton),
    );
    expect(ancien.status).not.toBe(200);
    await request(app)
      .get("/api/v1/invitations/verifier?jeton=" + encodeURIComponent(nouveauJeton))
      .expect(200);
  });

  it("le premier responsable accepte, se connecte, puis l'organisation refuse un second premier responsable", async () => {
    const jeton = lireJeton(emailResponsable);
    await request(app)
      .post("/api/v1/invitations/accepter")
      .send({ jeton, nom: "Premier Responsable", mot_de_passe: MOT_DE_PASSE_RESPONSABLE })
      .expect(201);

    const compte = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: emailResponsable },
      select: { role: true, actif: true, organisation_id: true },
    });
    expect(compte.role).toBe("RESPONSABLE");
    expect(compte.actif).toBe(true);
    expect(compte.organisation_id).toBe(santeId);

    const agent = await connecterAgent(emailResponsable, MOT_DE_PASSE_RESPONSABLE);
    const moi = await agent.get("/api/v1/auth/me").expect(200);
    expect(moi.body.utilisateur.email).toBe(emailResponsable);

    // L'organisation a maintenant un responsable actif : les suivants sont invites par lui
    const second = await agentAdmin
      .post("/api/v1/admin/organisations/" + santeId + "/inviter-responsable")
      .send({ email: adresse("deuxieme") })
      .expect(409);
    expect(second.body.code).toBe("RESPONSABLE_EXISTANT");
  });
});

// ------------------------------------------------------------
// Suspension et reactivation
// ------------------------------------------------------------

describe("admin organisations : suspension et reactivation", () => {
  it("suspend l'organisation et ecrit le journal", async () => {
    await agentResponsableSusp.get("/api/v1/auth/me").expect(200);

    const reponse = await agentAdmin
      .post("/api/v1/admin/organisations/" + suspId + "/suspendre")
      .expect(200);
    expect(reponse.body.organisation.statut).toBe("SUSPENDU");

    const ligne = await prisma.auditLog.findFirstOrThrow({
      where: { organisation_id: suspId, action: "ORGANISATION_SUSPENDUE" },
      select: { utilisateur_id: true, details: true },
    });
    expect(ligne.utilisateur_id).toBe(adminId);
    expect(ligne.details).toEqual({ statut_precedent: "ACTIF" });

    const deux = await agentAdmin
      .post("/api/v1/admin/organisations/" + suspId + "/suspendre")
      .expect(409);
    expect(deux.body.code).toBe("DEJA_SUSPENDUE");
  });

  it("refuse la session en cours, la connexion et le QR code de l'organisation suspendue", async () => {
    // Session en cours : refusee sur /me et sur une route du Responsable
    const moi = await agentResponsableSusp.get("/api/v1/auth/me").expect(401);
    expect(moi.body.code).toBe("ORGANISATION_SUSPENDUE");
    const route = await agentResponsableSusp.get("/api/v1/utilisateurs").expect(401);
    expect(route.body.code).toBe("ORGANISATION_SUSPENDUE");

    // Connexion : refusee avec le bon mot de passe, sans cookie de session
    const connexion = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: suspResponsableEmail, mot_de_passe: MOT_DE_PASSE, se_souvenir: false });
    expect(connexion.status).toBe(403);
    expect(connexion.body.code).toBe("ORGANISATION_SUSPENDUE");
    expect(connexion.headers["set-cookie"]).toBeUndefined();

    // Un mauvais mot de passe ne revele rien : meme reponse qu'avant la suspension
    const mauvais = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: suspResponsableEmail, mot_de_passe: "Mauvais-Mot-De-Passe-1", se_souvenir: false });
    expect(mauvais.status).toBe(401);
    expect(mauvais.body.code).toBe("IDENTIFIANTS_INVALIDES");

    // QR code : page claire, et le scan n'est pas compte
    const qr = await request(app).get("/api/v1/public/q/" + suspCode);
    expect(qr.status).toBe(403);
    expect(qr.body.code).toBe("ORGANISATION_SUSPENDUE");
    expect(await prisma.scan.count({ where: { point_contact_id: suspPointId } })).toBe(0);
  });

  it("reactive l'organisation : elle repasse a ACTIF et tout refonctionne", async () => {
    const reponse = await agentAdmin
      .post("/api/v1/admin/organisations/" + suspId + "/reactiver")
      .expect(200);
    expect(reponse.body.organisation.statut).toBe("ACTIF");

    const ligne = await prisma.auditLog.findFirstOrThrow({
      where: { organisation_id: suspId, action: "ORGANISATION_REACTIVEE" },
      select: { details: true },
    });
    expect(ligne.details).toEqual({ statut_precedent: "SUSPENDU" });

    const deux = await agentAdmin
      .post("/api/v1/admin/organisations/" + suspId + "/reactiver")
      .expect(409);
    expect(deux.body.code).toBe("PAS_SUSPENDUE");

    // Connexion de nouveau possible
    const agent = await connecterAgent(suspResponsableEmail, MOT_DE_PASSE);
    await agent.get("/api/v1/auth/me").expect(200);

    // Le QR code n'est plus bloque par la suspension : ce point n'a pas de questionnaire,
    // la page dit donc "questionnaire non disponible" et non plus "organisation suspendue"
    const qr = await request(app).get("/api/v1/public/q/" + suspCode);
    expect(qr.status).toBe(409);
    expect(qr.body.code).toBe("QUESTIONNAIRE_INACTIF");
  });

  it("une organisation d'essai suspendue puis reactivee devient ACTIF ; cas d'erreur", async () => {
    await agentAdmin.post("/api/v1/admin/organisations/" + essaiId + "/reactiver").expect(409);

    await agentAdmin.post("/api/v1/admin/organisations/" + essaiId + "/suspendre").expect(200);
    const ligne = await prisma.auditLog.findFirstOrThrow({
      where: { organisation_id: essaiId, action: "ORGANISATION_SUSPENDUE" },
      select: { details: true },
    });
    expect(ligne.details).toEqual({ statut_precedent: "ESSAI" });

    const reactivee = await agentAdmin
      .post("/api/v1/admin/organisations/" + essaiId + "/reactiver")
      .expect(200);
    expect(reactivee.body.organisation.statut).toBe("ACTIF");

    await agentAdmin
      .post("/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000/suspendre")
      .expect(404);
    await agentAdmin
      .post("/api/v1/admin/organisations/00000000-0000-4000-8000-000000000000/reactiver")
      .expect(404);
    await agentAdmin.post("/api/v1/admin/organisations/abc/suspendre").expect(400);
  });
});