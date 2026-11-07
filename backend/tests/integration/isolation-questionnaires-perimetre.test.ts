import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Perimetre par site pour les questionnaires (jour 18).
// Un questionnaire n'est pas rattache a un site : il reste visible dans toute l'organisation,
// mais ses points de contact (noms et nombre) respectent le perimetre du Gestionnaire.
// Les organisations restent separees : A ne voit jamais les questionnaires de B.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Perimetre-Quest-2026";

type Agent = ReturnType<typeof request.agent>;

type OrganisationDeTest = {
  organisationId: string;
  utilisateurIds: string[];
  siteId: string;
  autreSiteId: string;
  questionnaireId: string;
  titre: string;
  nomsSite1: string[];
  nomSite2: string;
  responsable: Agent;
  gestionnaireSite1: Agent;
  gestionnaireSite2: Agent;
};

async function creerUtilisateurConnecte(
  organisationId: string,
  lettre: string,
  etiquette: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  siteId: string | undefined,
): Promise<{ id: string; agent: Agent }> {
  const email = etiquette + "-" + lettre.toLowerCase() + "-" + suffixe + "@test-perimetre-quest.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: etiquette + " " + lettre,
      role,
      organisation_id: organisationId,
      ...(siteId !== undefined ? { utilisateurs_sites: { create: { site_id: siteId } } } : {}),
    },
    select: { id: true },
  });

  // Un "agent" garde le cookie de session entre les requetes.
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  return { id: utilisateur.id, agent };
}

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-PERIMETRE-QUEST-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });
  const organisationId = organisation.id;

  const site = await prisma.site.create({
    data: { organisation_id: organisationId, nom: "Site " + lettre + " principal" },
  });
  const autreSite = await prisma.site.create({
    data: { organisation_id: organisationId, nom: "Site " + lettre + " autre" },
  });

  const titre = "Questionnaire perimetre " + lettre + " " + suffixe;
  const questionnaire = await prisma.questionnaire.create({
    data: { organisation_id: organisationId, titre: { fr: titre } },
    select: { id: true },
  });

  // Les points sont tous associes au meme questionnaire.
  async function creerPoint(siteId: string, nom: string, supprime: boolean) {
    return prisma.pointContact.create({
      data: {
        organisation_id: organisationId,
        site_id: siteId,
        questionnaire_id: questionnaire.id,
        nom,
        code_public: randomBytes(9).toString("base64url"),
        ...(supprime ? { supprime_le: new Date() } : {}),
      },
      select: { id: true },
    });
  }
  const nomsSite1 = ["Table " + lettre + " 1", "Table " + lettre + " 2"];
  const nomSite2 = "Table " + lettre + " autre site";
  await creerPoint(site.id, nomsSite1[0] ?? "", false);
  await creerPoint(site.id, nomsSite1[1] ?? "", false);
  await creerPoint(autreSite.id, nomSite2, false);
  // Un point supprime ne doit jamais etre compte ni affiche.
  await creerPoint(site.id, "Table " + lettre + " supprimee", true);

  const responsable = await creerUtilisateurConnecte(organisationId, lettre, "responsable", "RESPONSABLE", undefined);
  const gestionnaireSite1 = await creerUtilisateurConnecte(
    organisationId,
    lettre,
    "gestionnaire-site1",
    "GESTIONNAIRE",
    site.id,
  );
  const gestionnaireSite2 = await creerUtilisateurConnecte(
    organisationId,
    lettre,
    "gestionnaire-site2",
    "GESTIONNAIRE",
    autreSite.id,
  );

  return {
    organisationId,
    utilisateurIds: [responsable.id, gestionnaireSite1.id, gestionnaireSite2.id],
    siteId: site.id,
    autreSiteId: autreSite.id,
    questionnaireId: questionnaire.id,
    titre,
    nomsSite1,
    nomSite2,
    responsable: responsable.agent,
    gestionnaireSite1: gestionnaireSite1.agent,
    gestionnaireSite2: gestionnaireSite2.agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;
// Gestionnaire de A dont le seul site est supprime : son perimetre est vide.
let gestionnaireSiteSupprime: Agent;
let gestionnaireSiteSupprimeId: string;

beforeAll(async () => {
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");

  const siteSupprime = await prisma.site.create({
    data: { organisation_id: orgA.organisationId, nom: "Site A supprime", supprime_le: new Date() },
  });
  const gestionnaire = await creerUtilisateurConnecte(
    orgA.organisationId,
    "A",
    "gestionnaire-supprime",
    "GESTIONNAIRE",
    siteSupprime.id,
  );
  gestionnaireSiteSupprime = gestionnaire.agent;
  gestionnaireSiteSupprimeId = gestionnaire.id;
}, 60000);

afterAll(async () => {
  const organisationIds = [orgA?.organisationId, orgB?.organisationId].filter(
    (id): id is string => id !== undefined,
  );
  const utilisateurIds = [
    ...(orgA?.utilisateurIds ?? []),
    ...(orgB?.utilisateurIds ?? []),
    ...(gestionnaireSiteSupprimeId !== undefined ? [gestionnaireSiteSupprimeId] : []),
  ];

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateurSite.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.questionnaire.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 30000);

type LigneListe = { id: string; titre: { fr: string }; nombre_points_contact: number };

async function ligneDeListe(agent: Agent, organisation: OrganisationDeTest): Promise<LigneListe | undefined> {
  const reponse = await agent.get("/api/v1/questionnaires").expect(200);
  const lignes = reponse.body.questionnaires as LigneListe[];
  return lignes.find((ligne) => ligne.id === organisation.questionnaireId);
}

async function nomsDesPoints(agent: Agent, organisation: OrganisationDeTest): Promise<string[]> {
  const reponse = await agent.get("/api/v1/questionnaires/" + organisation.questionnaireId).expect(200);
  const points = reponse.body.questionnaire.points_contact as { id: string; nom: string }[];
  return points.map((point) => point.nom).sort();
}

describe("perimetre questionnaires : le Responsable voit toute son organisation", () => {
  it("la liste compte les 3 points non supprimes", async () => {
    const ligne = await ligneDeListe(orgA.responsable, orgA);
    expect(ligne).toBeDefined();
    expect(ligne?.nombre_points_contact).toBe(3);
  });

  it("la fiche montre les 3 points, sans le point supprime", async () => {
    const noms = await nomsDesPoints(orgA.responsable, orgA);
    expect(noms).toEqual([...orgA.nomsSite1, orgA.nomSite2].sort());
  });
});

describe("perimetre questionnaires : le Gestionnaire ne voit que ses sites", () => {
  it("le Gestionnaire du site 1 voit le questionnaire mais seulement 2 points dans la liste", async () => {
    const ligne = await ligneDeListe(orgA.gestionnaireSite1, orgA);
    expect(ligne).toBeDefined();
    expect(ligne?.titre.fr).toBe(orgA.titre);
    expect(ligne?.nombre_points_contact).toBe(2);
  });

  it("le Gestionnaire du site 1 ne voit dans la fiche que les points de son site", async () => {
    const noms = await nomsDesPoints(orgA.gestionnaireSite1, orgA);
    expect(noms).toEqual([...orgA.nomsSite1].sort());
    expect(noms).not.toContain(orgA.nomSite2);
  });

  it("le Gestionnaire du site 2 voit 1 seul point, dans la liste et dans la fiche", async () => {
    const ligne = await ligneDeListe(orgA.gestionnaireSite2, orgA);
    expect(ligne?.nombre_points_contact).toBe(1);
    expect(await nomsDesPoints(orgA.gestionnaireSite2, orgA)).toEqual([orgA.nomSite2]);
  });

  it("un Gestionnaire dont le site est supprime ne voit aucun point (perimetre vide)", async () => {
    const ligne = await ligneDeListe(gestionnaireSiteSupprime, orgA);
    expect(ligne?.nombre_points_contact).toBe(0);
    expect(await nomsDesPoints(gestionnaireSiteSupprime, orgA)).toEqual([]);
  });
});

describe("perimetre questionnaires : isolation entre organisations", () => {
  it("le Gestionnaire de A ne voit pas le questionnaire de B (404, absent de la liste)", async () => {
    await orgA.gestionnaireSite1
      .get("/api/v1/questionnaires/" + orgB.questionnaireId)
      .expect(404);

    const reponse = await orgA.gestionnaireSite1.get("/api/v1/questionnaires").expect(200);
    const identifiants = (reponse.body.questionnaires as LigneListe[]).map((ligne) => ligne.id);
    expect(identifiants).not.toContain(orgB.questionnaireId);
  });

  it("le Responsable de A ne voit pas le questionnaire de B non plus", async () => {
    await orgA.responsable.get("/api/v1/questionnaires/" + orgB.questionnaireId).expect(404);
  });

  it("chaque organisation voit ses propres points, jamais ceux de l'autre", async () => {
    const nomsA = await nomsDesPoints(orgA.responsable, orgA);
    const nomsB = await nomsDesPoints(orgB.responsable, orgB);
    expect(nomsA.every((nom) => nom.includes(" A "))).toBe(true);
    expect(nomsB.every((nom) => nom.includes(" B "))).toBe(true);
  });
});

describe("perimetre questionnaires : le Gestionnaire est en lecture seule", () => {
  it("toutes les routes de modification refusent le Gestionnaire (403)", async () => {
    const g = orgA.gestionnaireSite1;
    const id = orgA.questionnaireId;
    await g.post("/api/v1/questionnaires").send({}).expect(403);
    await g.put("/api/v1/questionnaires/" + id).send({}).expect(403);
    await g.post("/api/v1/questionnaires/" + id + "/publier").expect(403);
    await g.post("/api/v1/questionnaires/" + id + "/dupliquer").expect(403);
    await g.post("/api/v1/questionnaires/" + id + "/activer").expect(403);
    await g.post("/api/v1/questionnaires/" + id + "/desactiver").expect(403);
  });
});