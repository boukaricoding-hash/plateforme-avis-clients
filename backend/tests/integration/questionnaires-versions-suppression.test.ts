import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Jour 20 : versions des questionnaires (scenario 9) et suppression.
// - Modifier un questionnaire qui a deja des avis cree la version suivante :
//   les anciens avis et leurs reponses restent lies a l'ancienne version.
// - L'historique des versions est reserve au Responsable et reste dans son organisation.
// - Supprimer un questionnaire : seulement sans avis, ses points de contact sont detaches,
//   jamais dans une autre organisation.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Versions-Quest-2026";

type Agent = ReturnType<typeof request.agent>;

type OrganisationDeTest = {
  organisationId: string;
  siteId: string;
  utilisateurIds: string[];
  responsable: Agent;
  gestionnaire: Agent;
};

type VersionTest = {
  id: string;
  numero: number;
  publie_le: string | null;
  questions: { id: string }[];
};

type FicheTest = { id: string; version: VersionTest | null };

type LigneVersion = {
  id: string;
  numero: number;
  publie_le: string | null;
  nombre_questions: number;
  nombre_avis: number;
};

async function creerUtilisateurConnecte(
  organisationId: string,
  lettre: string,
  etiquette: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  siteId: string | undefined,
): Promise<{ id: string; agent: Agent }> {
  const email = etiquette + "-" + lettre.toLowerCase() + "-" + suffixe + "@test-versions-quest.local";
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
      nom: "TEST-VERSIONS-QUEST-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });
  const site = await prisma.site.create({
    data: { organisation_id: organisation.id, nom: "Site " + lettre + " principal" },
  });

  const responsable = await creerUtilisateurConnecte(organisation.id, lettre, "responsable", "RESPONSABLE", undefined);
  const gestionnaire = await creerUtilisateurConnecte(organisation.id, lettre, "gestionnaire", "GESTIONNAIRE", site.id);

  return {
    organisationId: organisation.id,
    siteId: site.id,
    utilisateurIds: [responsable.id, gestionnaire.id],
    responsable: responsable.agent,
    gestionnaire: gestionnaire.agent,
  };
}

function adresse(id: string): string {
  return "/api/v1/questionnaires/" + id;
}

// Contenu envoye a POST et PUT : une question d'etoiles, et une question oui/non en plus si demandee.
function corps(titre: string, avecDeuxiemeQuestion: boolean) {
  const questions = [{ type: "ETOILES", libelle: { fr: "Note globale ?" }, obligatoire: true }];
  if (avecDeuxiemeQuestion) {
    questions.push({ type: "OUI_NON", libelle: { fr: "Vous reviendrez ?" }, obligatoire: false });
  }
  return { titre: { fr: titre }, langue_defaut: "fr", questions };
}

async function creerQuestionnaire(agent: Agent, titre: string): Promise<FicheTest> {
  const reponse = await agent.post("/api/v1/questionnaires").send(corps(titre, false)).expect(201);
  return reponse.body.questionnaire as FicheTest;
}

async function creerPoint(organisation: OrganisationDeTest, questionnaireId: string, nom: string): Promise<string> {
  const point = await prisma.pointContact.create({
    data: {
      organisation_id: organisation.organisationId,
      site_id: organisation.siteId,
      questionnaire_id: questionnaireId,
      nom,
      code_public: randomBytes(9).toString("base64url"),
    },
    select: { id: true },
  });
  return point.id;
}

async function creerAvis(
  organisation: OrganisationDeTest,
  pointId: string,
  versionId: string,
  questionId: string,
): Promise<string> {
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisation.organisationId,
      site_id: organisation.siteId,
      point_contact_id: pointId,
      version_id: versionId,
      langue: "fr",
      note_globale: 4,
      reponses: {
        create: [{ organisation_id: organisation.organisationId, question_id: questionId, valeur_numerique: 4 }],
      },
    },
    select: { id: true },
  });
  return avis.id;
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;
// Questionnaire publie de A, avec un point de contact et un avis sur sa version 1.
let questionnaireScenario: FicheTest;
let versionUn: VersionTest;
let questionUnId: string;
let pointScenarioId: string;
let avisAncienId: string;

beforeAll(async () => {
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");

  questionnaireScenario = await creerQuestionnaire(orgA.responsable, "Scenario 9 " + suffixe);
  await orgA.responsable.post(adresse(questionnaireScenario.id) + "/publier").expect(200);

  const version = questionnaireScenario.version;
  const question = version?.questions[0];
  if (!version || !question) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionUn = version;
  questionUnId = question.id;

  pointScenarioId = await creerPoint(orgA, questionnaireScenario.id, "Table scenario " + suffixe);
  avisAncienId = await creerAvis(orgA, pointScenarioId, versionUn.id, questionUnId);
}, 60000);

afterAll(async () => {
  const organisationIds = [orgA?.organisationId, orgB?.organisationId].filter(
    (id): id is string => id !== undefined,
  );
  const utilisateurIds = [...(orgA?.utilisateurIds ?? []), ...(orgB?.utilisateurIds ?? [])];

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.reponse.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.avis.deleteMany({ where: { organisation_id: { in: organisationIds } } });
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
  await prisma.$disconnect();
}, 30000);

describe("scenario 9 : modifier un questionnaire qui a deja des avis", () => {
  it("cree la version 2 et garde l'ancien avis, avec sa reponse, sur la version 1", async () => {
    const reponse = await orgA.responsable
      .put(adresse(questionnaireScenario.id))
      .send(corps("Scenario 9 modifie " + suffixe, true))
      .expect(200);
    expect(reponse.body.nouvelle_version).toBe(true);

    const fiche = reponse.body.questionnaire as FicheTest;
    expect(fiche.version?.numero).toBe(2);
    expect(fiche.version?.questions).toHaveLength(2);
    // La version precedente etait publiee : la nouvelle l'est aussi.
    expect(fiche.version?.publie_le ?? null).not.toBeNull();

    const avis = await prisma.avis.findUniqueOrThrow({
      where: { id: avisAncienId },
      select: { version_id: true, reponses: { select: { question_id: true } } },
    });
    expect(avis.version_id).toBe(versionUn.id);
    expect(avis.reponses.map((ligne) => ligne.question_id)).toEqual([questionUnId]);
    expect(await prisma.question.count({ where: { version_id: versionUn.id } })).toBe(1);
  });

  it("l'historique montre la version 2 sans avis et la version 1 avec son avis", async () => {
    const reponse = await orgA.responsable.get(adresse(questionnaireScenario.id) + "/versions").expect(200);
    const versions = reponse.body.versions as LigneVersion[];

    expect(versions.map((ligne) => ligne.numero)).toEqual([2, 1]);
    const deux = versions.find((ligne) => ligne.numero === 2);
    const un = versions.find((ligne) => ligne.numero === 1);
    expect(deux?.nombre_avis).toBe(0);
    expect(deux?.nombre_questions).toBe(2);
    expect(un?.nombre_avis).toBe(1);
    expect(un?.nombre_questions).toBe(1);
    expect(un?.id).toBe(versionUn.id);
  });

  it("une modification de plus, sans avis sur la version 2, la remplace sur place", async () => {
    const reponse = await orgA.responsable
      .put(adresse(questionnaireScenario.id))
      .send(corps("Scenario 9 encore modifie " + suffixe, false))
      .expect(200);
    expect(reponse.body.nouvelle_version).toBe(false);
    expect((reponse.body.questionnaire as FicheTest).version?.numero).toBe(2);

    const historique = await orgA.responsable.get(adresse(questionnaireScenario.id) + "/versions").expect(200);
    expect(historique.body.versions as LigneVersion[]).toHaveLength(2);
  });
});

describe("historique des versions : acces", () => {
  it("le Gestionnaire n'y a pas acces (403)", async () => {
    await orgA.gestionnaire.get(adresse(questionnaireScenario.id) + "/versions").expect(403);
  });

  it("le Responsable d'une autre organisation recoit 404", async () => {
    await orgB.responsable.get(adresse(questionnaireScenario.id) + "/versions").expect(404);
  });
});

describe("suppression d'un questionnaire", () => {
  it("supprime un questionnaire sans avis : il disparait de la fiche et de la liste", async () => {
    const brouillon = await creerQuestionnaire(orgA.responsable, "Brouillon a supprimer " + suffixe);

    const reponse = await orgA.responsable.delete(adresse(brouillon.id)).expect(200);
    expect(reponse.body.questionnaire).toEqual({ id: brouillon.id });
    expect(reponse.body.points_contact_detaches).toBe(0);

    await orgA.responsable.get(adresse(brouillon.id)).expect(404);
    const liste = await orgA.responsable.get("/api/v1/questionnaires").expect(200);
    const identifiants = (liste.body.questionnaires as { id: string }[]).map((ligne) => ligne.id);
    expect(identifiants).not.toContain(brouillon.id);
  });

  it("detache les points de contact d'un questionnaire sans avis (suppression douce)", async () => {
    const questionnaire = await creerQuestionnaire(orgA.responsable, "A supprimer avec un point " + suffixe);
    const pointId = await creerPoint(orgA, questionnaire.id, "Table a detacher " + suffixe);

    const reponse = await orgA.responsable.delete(adresse(questionnaire.id)).expect(200);
    expect(reponse.body.points_contact_detaches).toBe(1);

    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: pointId },
      select: { questionnaire_id: true, supprime_le: true },
    });
    expect(point.questionnaire_id).toBeNull();
    expect(point.supprime_le).toBeNull();

    const ligne = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: questionnaire.id },
      select: { supprime_le: true },
    });
    expect(ligne.supprime_le).not.toBeNull();
  });

  it("refuse (409) un questionnaire qui a deja des avis et ne change rien", async () => {
    const reponse = await orgA.responsable.delete(adresse(questionnaireScenario.id)).expect(409);
    expect(reponse.body.code).toBe("QUESTIONNAIRE_AVEC_AVIS");
    expect(reponse.body.details).toEqual({ nombre_avis: 1 });

    await orgA.responsable.get(adresse(questionnaireScenario.id)).expect(200);
    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: pointScenarioId },
      select: { questionnaire_id: true },
    });
    expect(point.questionnaire_id).toBe(questionnaireScenario.id);
  });

  it("le Gestionnaire ne peut pas supprimer (403)", async () => {
    const questionnaire = await creerQuestionnaire(orgA.responsable, "Protege du gestionnaire " + suffixe);
    await orgA.gestionnaire.delete(adresse(questionnaire.id)).expect(403);
    await orgA.responsable.get(adresse(questionnaire.id)).expect(200);
  });

  it("le Responsable d'une autre organisation ne peut pas supprimer (404)", async () => {
    const questionnaire = await creerQuestionnaire(orgA.responsable, "Protege de l'autre organisation " + suffixe);
    await orgB.responsable.delete(adresse(questionnaire.id)).expect(404);
    await orgA.responsable.get(adresse(questionnaire.id)).expect(200);
  });
});