import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Jour 24 : support en lecture seule.
// Accord (cote organisation, /api/v1/organisation/acces-support) :
// - le Responsable donne l'accord (1 heure, 24 heures ou 7 jours), le retire, un nouvel accord remplace l'ancien ;
// - seul le Responsable : visiteur 401, Gestionnaire 403, administrateur DTS (sans organisation) 403 ;
// - un Responsable ne touche que l'accord de sa propre organisation ; un champ organisation_id envoye est refuse.
// Consultation (cote DTS, /api/v1/admin/support/organisations/{id}/...) :
// - sans accord, avec un accord expire ou avec un accord retire : 403 sur les 7 routes, rien n'est lu ni journalise ;
// - avec accord : fiche, indicateurs, avis, sites, points de contact et utilisateurs ;
// - coordonnees des clients masquees, aucun mot de passe, aucune donnee d'une autre organisation ;
// - chaque consultation ecrit une ligne SUPPORT_CONSULTATION dans le journal ;
// - aucune ecriture possible : POST, PATCH, PUT et DELETE donnent 404 et rien ne change en base.
// Les controles d'acces des routes admin sont aussi dans isolation-admin.test.ts.
// Prerequis : le seed a ete lance (secteur restauration).
// Attention : la connexion est limitee a 10 essais par minute.
// Ce fichier en fait 4 (administrateur, Responsable A, Gestionnaire A, Responsable B) : il ne faut pas en ajouter sans en retirer.
// Les deux organisations de test, leurs comptes, avis, accords et lignes de journal sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Support-Lecture-2026";
const PREFIXE_NOM = "TEST-SUPPORT-";
const UNE_MINUTE_EN_MS = 60 * 1000;
const UNE_HEURE_EN_MS = 60 * UNE_MINUTE_EN_MS;

// Coordonnees laissees par le client de l'organisation A (avec consentement) : le support ne doit jamais les voir
const CONTACT_NOM = "Client-Nom-" + suffixe;
const CONTACT_TEL = "+22890" + suffixe.replace(/\D/g, "").padEnd(6, "7").slice(0, 6);
const CONTACT_EMAIL = "client-" + suffixe + "@exemple-client.local";
const COMMENTAIRE = "Service tres rapide " + suffixe;

const DUREES = [
  { code: "UNE_HEURE", ms: UNE_HEURE_EN_MS },
  { code: "VINGT_QUATRE_HEURES", ms: 24 * UNE_HEURE_EN_MS },
  { code: "SEPT_JOURS", ms: 7 * 24 * UNE_HEURE_EN_MS },
] as const;

type Agent = ReturnType<typeof request.agent>;
type Donnees = { siteId: string; pointId: string; siteNom: string; pointNom: string; avisId: string };

let motDePasseHash: string;
let adminId: string;
let responsableAId: string;
let gestionnaireAId: string;
let responsableBId: string;
let orgAId: string;
let orgBId: string;
let donneesA: Donnees;
let donneesB: Donnees;
let agentAdmin: Agent;
let agentResponsableA: Agent;
let agentGestionnaireA: Agent;
let agentResponsableB: Agent;

function adresse(etiquette: string): string {
  return etiquette + "-" + suffixe + "@test-support.local";
}

async function connecterAgent(email: string, motDePasse: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: motDePasse, se_souvenir: false })
    .expect(200);
  return agent;
}

async function creerCompte(
  etiquette: string,
  role: "ADMINISTRATEUR" | "RESPONSABLE" | "GESTIONNAIRE",
  organisationId: string | null,
): Promise<string> {
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email: adresse(etiquette),
      mot_de_passe_hash: motDePasseHash,
      nom: "Test " + etiquette,
      role,
      ...(organisationId ? { organisation_id: organisationId } : {}),
    },
    select: { id: true },
  });
  return utilisateur.id;
}

async function creerOrganisation(etiquette: string): Promise<string> {
  const secteur = await prisma.secteur.findUniqueOrThrow({
    where: { code: "restauration" },
    select: { id: true },
  });
  const organisation = await prisma.organisation.create({
    data: { nom: PREFIXE_NOM + etiquette + "-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
    select: { id: true },
  });
  return organisation.id;
}

// Un site, un point de contact, un questionnaire et un avis (avec une reponse) pour l'organisation.
// L'avis de l'organisation A porte des coordonnees avec consentement ; celui de B n'en a pas.
async function creerDonnees(organisationId: string, etiquette: string, avecContact: boolean): Promise<Donnees> {
  const siteNom = "Site support " + etiquette + "-" + suffixe;
  const pointNom = "Table support " + etiquette + "-" + suffixe;
  const site = await prisma.site.create({
    data: { organisation_id: organisationId, nom: siteNom },
    select: { id: true },
  });
  const point = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: site.id,
      nom: pointNom,
      type: "table",
      code_public: randomBytes(9).toString("base64url"),
    },
    select: { id: true },
  });
  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test support " + etiquette },
      statut: "ACTIF",
      versions: {
        create: {
          numero: 1,
          publie_le: new Date(),
          questions: {
            create: [{ ordre: 1, type: "ETOILES", libelle: { fr: "Note ?" }, echelle_min: 1, echelle_max: 5 }],
          },
        },
      },
    },
    select: { versions: { select: { id: true, questions: { select: { id: true } } } } },
  });
  const version = questionnaire.versions[0];
  const question = version?.questions[0];
  if (!version || !question) {
    throw new Error("Le questionnaire de test n'a pas ete cree");
  }
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisationId,
      site_id: site.id,
      point_contact_id: point.id,
      version_id: version.id,
      langue: "fr",
      note_globale: 4,
      commentaire: COMMENTAIRE + " " + etiquette,
      ...(avecContact
        ? {
            contact_nom: CONTACT_NOM,
            contact_tel: CONTACT_TEL,
            contact_email: CONTACT_EMAIL,
            consentement: true,
          }
        : {}),
      reponses: {
        create: [{ organisation_id: organisationId, question_id: question.id, valeur_numerique: 4 }],
      },
    },
    select: { id: true },
  });
  return { siteId: site.id, pointId: point.id, siteNom, pointNom, avisId: avis.id };
}

// Adresse de la consultation de support ("" = la fiche de l'organisation)
function cheminSupport(organisationId: string, partie: string = ""): string {
  return "/api/v1/admin/support/organisations/" + organisationId + partie;
}

// Les 7 routes de lecture du support pour l'organisation A
function toutesLesRoutesA(): string[] {
  return ["", "/indicateurs", "/avis", "/avis/" + donneesA.avisId, "/sites", "/points-contact", "/utilisateurs"].map(
    (partie) => cheminSupport(orgAId, partie),
  );
}

async function viderAccords(): Promise<void> {
  await prisma.accesSupport.deleteMany({ where: { organisation_id: { in: [orgAId, orgBId] } } });
}

// Cree un accord directement en base (pour les tests de consultation) : actif par defaut.
async function creerAccord(options: { expireDansMs?: number; revoque?: boolean } = {}): Promise<string> {
  const accord = await prisma.accesSupport.create({
    data: {
      organisation_id: orgAId,
      accorde_par_id: responsableAId,
      expire_le: new Date(Date.now() + (options.expireDansMs ?? UNE_HEURE_EN_MS)),
      ...(options.revoque === true ? { revoque_le: new Date(Date.now() - UNE_MINUTE_EN_MS) } : {}),
    },
    select: { id: true },
  });
  return accord.id;
}

async function compterAudit(organisationId: string, action: string): Promise<number> {
  return prisma.auditLog.count({ where: { organisation_id: organisationId, action } });
}

async function derniereLigne(organisationId: string, action: string) {
  return prisma.auditLog.findFirst({
    where: { organisation_id: organisationId, action },
    orderBy: [{ cree_le: "desc" }, { id: "desc" }],
    select: { utilisateur_id: true, entite: true, entite_id: true, details: true },
  });
}

type DetailsAudit = { duree?: string; remplace_un_accord?: boolean; partie?: string; accord_id?: string } | null;

beforeAll(async () => {
  motDePasseHash = await hash(MOT_DE_PASSE, 4);

  orgAId = await creerOrganisation("A");
  orgBId = await creerOrganisation("B");

  adminId = await creerCompte("admin", "ADMINISTRATEUR", null);
  responsableAId = await creerCompte("responsable-a", "RESPONSABLE", orgAId);
  gestionnaireAId = await creerCompte("gestionnaire-a", "GESTIONNAIRE", orgAId);
  responsableBId = await creerCompte("responsable-b", "RESPONSABLE", orgBId);

  donneesA = await creerDonnees(orgAId, "A", true);
  donneesB = await creerDonnees(orgBId, "B", false);

  agentAdmin = await connecterAgent(adresse("admin"), MOT_DE_PASSE);
  agentResponsableA = await connecterAgent(adresse("responsable-a"), MOT_DE_PASSE);
  agentGestionnaireA = await connecterAgent(adresse("gestionnaire-a"), MOT_DE_PASSE);
  agentResponsableB = await connecterAgent(adresse("responsable-b"), MOT_DE_PASSE);
}, 60000);

afterAll(async () => {
  const organisationIds = [orgAId, orgBId].filter((id): id is string => Boolean(id));
  const utilisateurIds = [adminId, responsableAId, gestionnaireAId, responsableBId].filter(
    (id): id is string => Boolean(id),
  );

  await prisma.accesSupport.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.avisSuivi.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.notification.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.alerte.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.reponse.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.avis.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ organisation_id: { in: organisationIds } }, { utilisateur_id: { in: utilisateurIds } }],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateurSite.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.scan.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.question.deleteMany({
    where: { version: { questionnaire: { organisation_id: { in: organisationIds } } } },
  });
  await prisma.questionnaireVersion.deleteMany({
    where: { questionnaire: { organisation_id: { in: organisationIds } } },
  });
  await prisma.questionnaire.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 60000);

// ------------------------------------------------------------
// Accord de support, cote organisation
// ------------------------------------------------------------

describe("accord de support : le Responsable donne et retire l'accord", () => {
  beforeEach(viderAccords);

  it("sans accord, la lecture renvoie acces null", async () => {
    const reponse = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ acces: null });
  });

  it("donne l'accord pour 1 heure, 24 heures ou 7 jours : la fin est calculee par le serveur", async () => {
    for (const duree of DUREES) {
      const avant = Date.now();
      const reponse = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: duree.code });
      const apres = Date.now();
      expect(reponse.status, duree.code).toBe(201);

      const expire = Date.parse(reponse.body.acces.expire_le as string);
      expect(expire, duree.code).toBeGreaterThanOrEqual(avant + duree.ms);
      expect(expire, duree.code).toBeLessThanOrEqual(apres + duree.ms);
    }
  });

  it("l'accord est rattache a l'organisation de la session et ne montre pas organisation_id", async () => {
    const reponse = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    expect(reponse.status).toBe(201);
    expect(reponse.body.acces.accorde_par.id).toBe(responsableAId);
    expect(reponse.body.acces).not.toHaveProperty("organisation_id");
    expect(reponse.body.acces).not.toHaveProperty("revoque_le");

    const ligne = await prisma.accesSupport.findUniqueOrThrow({
      where: { id: reponse.body.acces.id as string },
      select: { organisation_id: true, accorde_par_id: true, revoque_le: true },
    });
    expect(ligne.organisation_id).toBe(orgAId);
    expect(ligne.accorde_par_id).toBe(responsableAId);
    expect(ligne.revoque_le).toBeNull();

    // La lecture renvoie le meme accord
    const lecture = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(lecture.status).toBe(200);
    expect(lecture.body.acces.id).toBe(reponse.body.acces.id);
  });

  it("ecrit l'accord dans le journal", async () => {
    const avant = await compterAudit(orgAId, "SUPPORT_ACCES_ACCORDE");
    const reponse = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "VINGT_QUATRE_HEURES" });
    expect(reponse.status).toBe(201);

    expect(await compterAudit(orgAId, "SUPPORT_ACCES_ACCORDE")).toBe(avant + 1);
    const ligne = await derniereLigne(orgAId, "SUPPORT_ACCES_ACCORDE");
    expect(ligne?.utilisateur_id).toBe(responsableAId);
    expect(ligne?.entite).toBe("acces_support");
    expect(ligne?.entite_id).toBe(reponse.body.acces.id);
    const details = ligne?.details as DetailsAudit;
    expect(details?.duree).toBe("VINGT_QUATRE_HEURES");
    expect(details?.remplace_un_accord).toBe(false);
  });

  it("un nouvel accord remplace l'accord actif : il n'en reste qu'un", async () => {
    const premier = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    const second = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "SEPT_JOURS" });
    expect(premier.status).toBe(201);
    expect(second.status).toBe(201);

    const lignes = await prisma.accesSupport.findMany({
      where: { organisation_id: orgAId },
      select: { id: true, revoque_le: true, expire_le: true },
    });
    expect(lignes).toHaveLength(2);
    const actifs = lignes.filter((ligne) => ligne.revoque_le === null && ligne.expire_le.getTime() > Date.now());
    expect(actifs).toHaveLength(1);
    expect(actifs[0]?.id).toBe(second.body.acces.id);
    expect(lignes.find((ligne) => ligne.id === premier.body.acces.id)?.revoque_le).not.toBeNull();

    const lecture = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(lecture.body.acces.id).toBe(second.body.acces.id);

    const details = (await derniereLigne(orgAId, "SUPPORT_ACCES_ACCORDE"))?.details as DetailsAudit;
    expect(details?.remplace_un_accord).toBe(true);
  });

  it("retire l'accord, l'ecrit dans le journal, et retirer deux fois ne provoque ni erreur ni ligne en trop", async () => {
    const accord = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    expect(accord.status).toBe(201);
    const avant = await compterAudit(orgAId, "SUPPORT_ACCES_RETIRE");

    const retrait = await agentResponsableA.delete("/api/v1/organisation/acces-support");
    expect(retrait.status).toBe(200);
    expect(retrait.body).toEqual({ acces: null });

    const lecture = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(lecture.body).toEqual({ acces: null });

    const ligne = await prisma.accesSupport.findUniqueOrThrow({
      where: { id: accord.body.acces.id as string },
      select: { revoque_le: true },
    });
    expect(ligne.revoque_le).not.toBeNull();

    expect(await compterAudit(orgAId, "SUPPORT_ACCES_RETIRE")).toBe(avant + 1);
    const journal = await derniereLigne(orgAId, "SUPPORT_ACCES_RETIRE");
    expect(journal?.utilisateur_id).toBe(responsableAId);
    expect(journal?.entite_id).toBe(accord.body.acces.id);

    // Deuxieme retrait : rien a retirer
    const encore = await agentResponsableA.delete("/api/v1/organisation/acces-support");
    expect(encore.status).toBe(200);
    expect(encore.body).toEqual({ acces: null });
    expect(await compterAudit(orgAId, "SUPPORT_ACCES_RETIRE")).toBe(avant + 1);
  });

  it("refuse une duree ou un champ invalide (400) et ne cree aucun accord", async () => {
    const mauvaisCorps: Array<Record<string, unknown>> = [
      { duree: "UN_MOIS" },
      { duree: "PT1H" },
      { duree: 3600000 },
      {},
      // L'organisation vient toujours de la session : tout autre champ est refuse
      { duree: "UNE_HEURE", organisation_id: orgBId },
    ];
    for (const corps of mauvaisCorps) {
      const reponse = await agentResponsableA.post("/api/v1/organisation/acces-support").send(corps);
      expect(reponse.status, JSON.stringify(corps)).toBe(400);
      expect(reponse.body.code, JSON.stringify(corps)).toBe("DONNEES_INVALIDES");
    }
    expect(await prisma.accesSupport.count({ where: { organisation_id: { in: [orgAId, orgBId] } } })).toBe(0);
  });
});

describe("accord de support : qui peut le donner", () => {
  beforeEach(viderAccords);

  it("visiteur : 401 ; Gestionnaire : 403 ; administrateur DTS (sans organisation) : 403 ; rien n'est cree", async () => {
    for (const methode of ["get", "post", "delete"] as const) {
      const visiteur = await request(app)[methode]("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
      expect(visiteur.status, "visiteur " + methode).toBe(401);

      const gestionnaire = await agentGestionnaireA[methode]("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
      expect(gestionnaire.status, "gestionnaire " + methode).toBe(403);
      expect(gestionnaire.body.code, "gestionnaire " + methode).toBe("ACCES_REFUSE");

      const admin = await agentAdmin[methode]("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
      expect(admin.status, "admin " + methode).toBe(403);
      expect(admin.body.code, "admin " + methode).toBe("ACCES_REFUSE");
    }
    expect(await prisma.accesSupport.count({ where: { organisation_id: { in: [orgAId, orgBId] } } })).toBe(0);
  });

  it("un Responsable ne donne, ne lit et ne retire que l'accord de sa propre organisation", async () => {
    // Le Responsable B donne l'accord : il va a l'organisation B, jamais a A
    const accordB = await agentResponsableB.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    expect(accordB.status).toBe(201);
    const ligneB = await prisma.accesSupport.findUniqueOrThrow({
      where: { id: accordB.body.acces.id as string },
      select: { organisation_id: true, accorde_par_id: true },
    });
    expect(ligneB.organisation_id).toBe(orgBId);
    expect(ligneB.accorde_par_id).toBe(responsableBId);
    expect(await prisma.accesSupport.count({ where: { organisation_id: orgAId } })).toBe(0);

    // Le Responsable A ne voit pas l'accord de B
    const lectureA = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(lectureA.body).toEqual({ acces: null });

    // L'accord de A reste en place quand B retire le sien
    const accordA = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    expect(accordA.status).toBe(201);
    const retraitB = await agentResponsableB.delete("/api/v1/organisation/acces-support");
    expect(retraitB.status).toBe(200);
    const lectureApres = await agentResponsableA.get("/api/v1/organisation/acces-support");
    expect(lectureApres.body.acces.id).toBe(accordA.body.acces.id);
  });
});

// ------------------------------------------------------------
// Consultation de support, sans accord valable
// ------------------------------------------------------------

describe("consultation de support : refusee sans accord valable", () => {
  beforeEach(viderAccords);

  async function verifierRefusSurToutes(raison: string): Promise<void> {
    const avant = await compterAudit(orgAId, "SUPPORT_CONSULTATION");
    for (const chemin of toutesLesRoutesA()) {
      const reponse = await agentAdmin.get(chemin);
      expect(reponse.status, raison + " " + chemin).toBe(403);
      expect(reponse.body.code, raison + " " + chemin).toBe("ACCES_SUPPORT_NON_ACCORDE");
      expect(reponse.body.message, raison + " " + chemin).toBe("Cette organisation n'a pas donné son accord.");
      // Rien n'est lu : la reponse ne contient aucune donnee de l'organisation
      expect(JSON.stringify(reponse.body), raison + " " + chemin).not.toContain(donneesA.siteNom);
    }
    // Un refus n'est pas une consultation : rien n'est ecrit dans le journal
    expect(await compterAudit(orgAId, "SUPPORT_CONSULTATION"), raison).toBe(avant);
  }

  it("sans accord : 403 sur les 7 routes", async () => {
    await verifierRefusSurToutes("sans accord");
  });

  it("accord expire : 403 sur les 7 routes", async () => {
    await creerAccord({ expireDansMs: -UNE_MINUTE_EN_MS });
    await verifierRefusSurToutes("accord expire");
  });

  it("accord retire (meme s'il n'est pas expire) : 403 sur les 7 routes", async () => {
    await creerAccord({ revoque: true });
    await verifierRefusSurToutes("accord retire");
  });

  it("l'accord d'une autre organisation ne donne aucun droit", async () => {
    // B donne son accord : A reste ferme
    const accordB = await agentResponsableB.post("/api/v1/organisation/acces-support").send({ duree: "SEPT_JOURS" });
    expect(accordB.status).toBe(201);
    await verifierRefusSurToutes("accord de B");

    // ... et B est bien consultable
    const fiche = await agentAdmin.get(cheminSupport(orgBId));
    expect(fiche.status).toBe(200);
    expect(fiche.body.organisation.id).toBe(orgBId);
  });

  it("organisation inconnue : 404 ; identifiant invalide : 400", async () => {
    const inconnue = await agentAdmin.get(cheminSupport("00000000-0000-4000-8000-000000000000"));
    expect(inconnue.status).toBe(404);
    expect(inconnue.body.code).toBe("NON_TROUVE");

    const invalide = await agentAdmin.get(cheminSupport("pas-un-identifiant"));
    expect(invalide.status).toBe(400);
    expect(invalide.body.code).toBe("DONNEES_INVALIDES");
  });

  it("visiteur : 401 ; Responsable et Gestionnaire : 403, meme avec un accord actif", async () => {
    await creerAccord();
    for (const chemin of toutesLesRoutesA()) {
      const visiteur = await request(app).get(chemin);
      expect(visiteur.status, "visiteur " + chemin).toBe(401);

      const responsable = await agentResponsableA.get(chemin);
      expect(responsable.status, "responsable " + chemin).toBe(403);
      expect(responsable.body.code, "responsable " + chemin).toBe("ACCES_REFUSE");

      const gestionnaire = await agentGestionnaireA.get(chemin);
      expect(gestionnaire.status, "gestionnaire " + chemin).toBe(403);
      expect(gestionnaire.body.code, "gestionnaire " + chemin).toBe("ACCES_REFUSE");
    }
  });
});

// ------------------------------------------------------------
// Consultation de support, avec accord
// ------------------------------------------------------------

describe("consultation de support : avec accord, en lecture seule", () => {
  let accordId: string;

  beforeEach(async () => {
    await viderAccords();
    accordId = await creerAccord();
  });

  it("lit la fiche de l'organisation", async () => {
    const reponse = await agentAdmin.get(cheminSupport(orgAId));
    expect(reponse.status).toBe(200);
    expect(reponse.body.organisation.id).toBe(orgAId);
    expect(reponse.body.organisation.nom).toBe(PREFIXE_NOM + "A-" + suffixe);
    expect(reponse.body.organisation.statut).toBe("ACTIF");
    expect(reponse.body.organisation.secteur.code).toBe("restauration");
  });

  it("lit les indicateurs", async () => {
    const reponse = await agentAdmin.get(cheminSupport(orgAId, "/indicateurs"));
    expect(reponse.status).toBe(200);
    expect(typeof reponse.body).toBe("object");
    expect(reponse.body).not.toBeNull();
  });

  it("lit les avis de l'organisation seulement, sans aucune coordonnee de client", async () => {
    const reponse = await agentAdmin.get(cheminSupport(orgAId, "/avis"));
    expect(reponse.status).toBe(200);

    const avis = reponse.body.avis as Array<Record<string, unknown>>;
    expect(avis.map((ligne) => ligne["id"])).toEqual([donneesA.avisId]);
    for (const ligne of avis) {
      expect(ligne).not.toHaveProperty("contact");
      expect(ligne).not.toHaveProperty("contact_nom");
      expect(ligne).not.toHaveProperty("contact_tel");
      expect(ligne).not.toHaveProperty("contact_email");
    }
    const texte = JSON.stringify(reponse.body);
    expect(texte).toContain(COMMENTAIRE);
    expect(texte).not.toContain(CONTACT_NOM);
    expect(texte).not.toContain(CONTACT_TEL);
    expect(texte).not.toContain(CONTACT_EMAIL);
    // L'avis de l'autre organisation n'y est pas
    expect(texte).not.toContain(donneesB.avisId);
  });

  it("lit le detail d'un avis : notes et reponses visibles, coordonnees masquees meme avec consentement", async () => {
    // Controle de depart : le client A a bien donne ses coordonnees avec consentement
    const base = await prisma.avis.findUniqueOrThrow({
      where: { id: donneesA.avisId },
      select: { consentement: true, contact_nom: true, contact_tel: true, contact_email: true },
    });
    expect(base.consentement).toBe(true);
    expect(base.contact_nom).toBe(CONTACT_NOM);

    const reponse = await agentAdmin.get(cheminSupport(orgAId, "/avis/" + donneesA.avisId));
    expect(reponse.status).toBe(200);
    expect(reponse.body.avis.id).toBe(donneesA.avisId);
    expect(reponse.body.avis.note_globale).toBe(4);
    expect(reponse.body.avis.commentaire).toBe(COMMENTAIRE + " A");
    expect(reponse.body.avis.reponses).toHaveLength(1);
    expect(reponse.body.avis.contact).toBeNull();

    const texte = JSON.stringify(reponse.body);
    expect(texte).not.toContain(CONTACT_NOM);
    expect(texte).not.toContain(CONTACT_TEL);
    expect(texte).not.toContain(CONTACT_EMAIL);
    expect(texte).not.toContain("contact_tel");
    expect(texte).not.toContain("contact_email");
  });

  it("un avis d'une autre organisation donne 404 ; un identifiant d'avis invalide donne 400", async () => {
    const autre = await agentAdmin.get(cheminSupport(orgAId, "/avis/" + donneesB.avisId));
    expect(autre.status).toBe(404);
    expect(autre.body.code).toBe("NON_TROUVE");
    expect(JSON.stringify(autre.body)).not.toContain(COMMENTAIRE + " B");

    const inexistant = await agentAdmin.get(cheminSupport(orgAId, "/avis/00000000-0000-4000-8000-000000000000"));
    expect(inexistant.status).toBe(404);

    const invalide = await agentAdmin.get(cheminSupport(orgAId, "/avis/pas-un-identifiant"));
    expect(invalide.status).toBe(400);
    expect(invalide.body.code).toBe("DONNEES_INVALIDES");
  });

  it("lit les sites et les points de contact de l'organisation seulement", async () => {
    const sites = await agentAdmin.get(cheminSupport(orgAId, "/sites"));
    expect(sites.status).toBe(200);
    const texteSites = JSON.stringify(sites.body);
    expect(texteSites).toContain(donneesA.siteNom);
    expect(texteSites).not.toContain(donneesB.siteNom);

    const points = await agentAdmin.get(cheminSupport(orgAId, "/points-contact"));
    expect(points.status).toBe(200);
    const textePoints = JSON.stringify(points.body);
    expect(textePoints).toContain(donneesA.pointNom);
    expect(textePoints).not.toContain(donneesB.pointNom);
  });

  it("lit les utilisateurs de l'organisation, sans mot de passe", async () => {
    const reponse = await agentAdmin.get(cheminSupport(orgAId, "/utilisateurs"));
    expect(reponse.status).toBe(200);

    const texte = JSON.stringify(reponse.body);
    expect(texte).toContain(adresse("responsable-a"));
    expect(texte).toContain(adresse("gestionnaire-a"));
    expect(texte).not.toContain(adresse("responsable-b"));
    expect(texte).not.toContain(adresse("admin"));
    expect(texte).not.toContain(motDePasseHash);
    expect(texte).not.toContain("mot_de_passe");
  });

  it("chaque consultation est ecrite dans le journal avec l'auteur DTS, l'organisation et la partie lue", async () => {
    const parties = [
      { chemin: "", partie: "fiche" },
      { chemin: "/indicateurs", partie: "indicateurs" },
      { chemin: "/avis", partie: "avis" },
      { chemin: "/sites", partie: "sites" },
      { chemin: "/points-contact", partie: "points-contact" },
      { chemin: "/utilisateurs", partie: "utilisateurs" },
    ];
    for (const { chemin, partie } of parties) {
      const avant = await compterAudit(orgAId, "SUPPORT_CONSULTATION");
      const reponse = await agentAdmin.get(cheminSupport(orgAId, chemin));
      expect(reponse.status, partie).toBe(200);
      expect(await compterAudit(orgAId, "SUPPORT_CONSULTATION"), partie).toBe(avant + 1);

      const ligne = await derniereLigne(orgAId, "SUPPORT_CONSULTATION");
      expect(ligne?.utilisateur_id, partie).toBe(adminId);
      expect(ligne?.entite, partie).toBe("organisation");
      expect(ligne?.entite_id, partie).toBe(orgAId);
      const details = ligne?.details as DetailsAudit;
      expect(details?.partie, partie).toBe(partie);
      expect(details?.accord_id, partie).toBe(accordId);
    }
  });

  it("l'accord est verifie a chaque requete : retire ou expire, le refus est immediat", async () => {
    const avant = await agentAdmin.get(cheminSupport(orgAId, "/sites"));
    expect(avant.status).toBe(200);

    // Le Responsable retire l'accord : la requete suivante est refusee
    const retrait = await agentResponsableA.delete("/api/v1/organisation/acces-support");
    expect(retrait.status).toBe(200);
    const apresRetrait = await agentAdmin.get(cheminSupport(orgAId, "/sites"));
    expect(apresRetrait.status).toBe(403);
    expect(apresRetrait.body.code).toBe("ACCES_SUPPORT_NON_ACCORDE");

    // Un nouvel accord rouvre la lecture
    const nouveau = await agentResponsableA.post("/api/v1/organisation/acces-support").send({ duree: "UNE_HEURE" });
    expect(nouveau.status).toBe(201);
    const apresNouveau = await agentAdmin.get(cheminSupport(orgAId, "/sites"));
    expect(apresNouveau.status).toBe(200);

    // L'accord arrive a expiration : la requete suivante est refusee
    await prisma.accesSupport.updateMany({
      where: { organisation_id: orgAId, revoque_le: null },
      data: { expire_le: new Date(Date.now() - 1000) },
    });
    const apresExpiration = await agentAdmin.get(cheminSupport(orgAId, "/sites"));
    expect(apresExpiration.status).toBe(403);
    expect(apresExpiration.body.code).toBe("ACCES_SUPPORT_NON_ACCORDE");
  });

  it("aucune ecriture n'est possible : POST, PATCH, PUT et DELETE donnent 404 et rien ne change", async () => {
    for (const chemin of toutesLesRoutesA()) {
      for (const methode of ["post", "patch", "put", "delete"] as const) {
        const reponse = await agentAdmin[methode](chemin).send({ statut: "SUSPENDU", statut_traitement: "TRAITE", nom: "PIRATE" });
        expect(reponse.status, methode + " " + chemin).toBe(404);
      }
    }

    // Rien n'a bouge en base
    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: orgAId },
      select: { nom: true, statut: true, supprime_le: true },
    });
    expect(organisation.nom).toBe(PREFIXE_NOM + "A-" + suffixe);
    expect(organisation.statut).toBe("ACTIF");
    expect(organisation.supprime_le).toBeNull();

    const avis = await prisma.avis.findMany({
      where: { organisation_id: orgAId },
      select: { id: true, statut_traitement: true, supprime_le: true },
    });
    expect(avis).toHaveLength(1);
    expect(avis[0]?.statut_traitement).toBe("NOUVEAU");
    expect(avis[0]?.supprime_le).toBeNull();

    expect(await prisma.site.count({ where: { organisation_id: orgAId, supprime_le: null } })).toBe(1);
    expect(await prisma.pointContact.count({ where: { organisation_id: orgAId, supprime_le: null } })).toBe(1);
    expect(await prisma.utilisateur.count({ where: { organisation_id: orgAId, supprime_le: null } })).toBe(2);
  });
});