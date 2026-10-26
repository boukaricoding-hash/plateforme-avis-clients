import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Isolation entre organisations pour les routes du jour 6 : avis, statuts, notes, notifications.
// L'organisation A essaie de lire ou de modifier ce qui appartient a B : tout doit etre refuse.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Avis-2026";

type OrganisationDeTest = {
  organisationId: string;
  utilisateurId: string;
  siteId: string;
  pointContactId: string;
  questionnaireId: string;
  avisId: string;
  notificationId: string;
  commentaire: string;
  agent: ReturnType<typeof request.agent>;
};

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-ISOLATION-AVIS-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });

  const email = "responsable-" + lettre.toLowerCase() + "-" + suffixe + "@test-isolation-avis.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: "Responsable " + lettre,
      role: "RESPONSABLE",
      organisation_id: organisation.id,
    },
  });

  const site = await prisma.site.create({
    data: { organisation_id: organisation.id, nom: "Site " + lettre },
  });

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisation.id,
      titre: { fr: "Questionnaire " + lettre },
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
    select: {
      id: true,
      versions: { select: { id: true, questions: { select: { id: true } } } },
    },
  });
  const version = questionnaire.versions[0];
  const question = version?.questions[0];
  if (!version || !question) {
    throw new Error("Questionnaire de test incomplet.");
  }

  const pointContact = await prisma.pointContact.create({
    data: {
      organisation_id: organisation.id,
      site_id: site.id,
      questionnaire_id: questionnaire.id,
      nom: "Table " + lettre,
      code_public: randomBytes(9).toString("base64url"),
    },
  });

  const commentaire = "Commentaire secret " + lettre + " " + suffixe;
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisation.id,
      site_id: site.id,
      point_contact_id: pointContact.id,
      version_id: version.id,
      langue: "fr",
      note_globale: 2,
      commentaire,
      reponses: {
        create: [{ organisation_id: organisation.id, question_id: question.id, valeur_numerique: 2 }],
      },
    },
    select: { id: true },
  });

  const notification = await prisma.notification.create({
    data: {
      organisation_id: organisation.id,
      utilisateur_id: utilisateur.id,
      avis_id: avis.id,
      titre: "Notification secrete " + lettre + " " + suffixe,
      message: commentaire,
    },
    select: { id: true },
  });

  // Un "agent" garde le cookie de session entre les requetes.
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);

  return {
    organisationId: organisation.id,
    utilisateurId: utilisateur.id,
    siteId: site.id,
    pointContactId: pointContact.id,
    questionnaireId: questionnaire.id,
    avisId: avis.id,
    notificationId: notification.id,
    commentaire,
    agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;

beforeAll(async () => {
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");
}, 30000);

afterAll(async () => {
  const organisationIds = [orgA?.organisationId, orgB?.organisationId].filter(
    (id): id is string => id !== undefined,
  );
  const utilisateurIds = [orgA?.utilisateurId, orgB?.utilisateurId].filter(
    (id): id is string => id !== undefined,
  );

  await prisma.avisSuivi.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.notification.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.alerte.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.reponse.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.avis.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { organisation_id: { in: organisationIds } } });
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
}, 30000);

type ReponseAvis = { body: { avis: { id: string }[] } };

function idsAvis(reponse: ReponseAvis): string[] {
  return reponse.body.avis.map((a) => a.id);
}

describe("isolation : lecture des avis", () => {
  it("la liste de A ne contient que les avis de A, jamais ceux de B", async () => {
    const reponse = await orgA.agent.get("/api/v1/avis").expect(200);

    expect(idsAvis(reponse)).toEqual([orgA.avisId]);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.avisId);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.commentaire);
  });

  it("A ne peut pas ouvrir un avis de B (404), mais ouvre le sien", async () => {
    const reponse = await orgA.agent.get("/api/v1/avis/" + orgB.avisId).expect(404);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.commentaire);

    await orgA.agent.get("/api/v1/avis/" + orgA.avisId).expect(200);
    // Et dans l'autre sens.
    await orgB.agent.get("/api/v1/avis/" + orgA.avisId).expect(404);
  });

  it("les filtres ne permettent pas d'atteindre les avis de B (site, point, questionnaire)", async () => {
    for (const filtre of [
      "site=" + orgB.siteId,
      "point=" + orgB.pointContactId,
      "questionnaire=" + orgB.questionnaireId,
    ]) {
      const reponse = await orgA.agent.get("/api/v1/avis?" + filtre).expect(200);
      expect(idsAvis(reponse)).toEqual([]);
      expect(reponse.body.pagination.total).toBe(0);
    }
  });

  it("l'organisation n'est jamais lue dans l'adresse : organisation_id est ignore", async () => {
    const reponse = await orgA.agent.get("/api/v1/avis?organisation_id=" + orgB.organisationId).expect(200);

    expect(idsAvis(reponse)).toEqual([orgA.avisId]);
  });
});

describe("isolation : statut et notes internes", () => {
  it("A ne peut pas changer le statut d'un avis de B (404), qui reste inchange", async () => {
    await orgA.agent
      .patch("/api/v1/avis/" + orgB.avisId + "/statut")
      .send({ statut: "TRAITE", commentaire: "Tentative depuis A" })
      .expect(404);

    const avis = await prisma.avis.findUniqueOrThrow({
      where: { id: orgB.avisId },
      select: { statut_traitement: true },
    });
    expect(avis.statut_traitement).toBe("NOUVEAU");
    expect(await prisma.avisSuivi.count({ where: { avis_id: orgB.avisId } })).toBe(0);
  });

  it("A ne peut pas ajouter de note a un avis de B (404), rien n'est ecrit", async () => {
    await orgA.agent
      .post("/api/v1/avis/" + orgB.avisId + "/notes")
      .send({ commentaire: "Note depuis A" })
      .expect(404);

    expect(await prisma.avisSuivi.count({ where: { avis_id: orgB.avisId } })).toBe(0);
  });

  it("envoyer l'organisation de B dans le corps ne change rien", async () => {
    await orgA.agent
      .patch("/api/v1/avis/" + orgB.avisId + "/statut")
      .send({ statut: "TRAITE", organisation_id: orgB.organisationId })
      .expect(404);

    const avis = await prisma.avis.findUniqueOrThrow({
      where: { id: orgB.avisId },
      select: { statut_traitement: true },
    });
    expect(avis.statut_traitement).toBe("NOUVEAU");
  });

  it("A change normalement le statut de SON avis (controle de non-regression)", async () => {
    await orgA.agent
      .patch("/api/v1/avis/" + orgA.avisId + "/statut")
      .send({ statut: "EN_COURS" })
      .expect(200);

    // Et B ne voit toujours rien de cet historique.
    expect(await prisma.avisSuivi.count({ where: { avis_id: orgB.avisId } })).toBe(0);
  });
});

describe("isolation : notifications", () => {
  it("A ne voit jamais les notifications de B", async () => {
    const reponse = await orgA.agent.get("/api/v1/notifications").expect(200);
    const identifiants = (reponse.body.notifications as { id: string }[]).map((n) => n.id);

    expect(identifiants).toEqual([orgA.notificationId]);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.notificationId);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.commentaire);
  });

  it("A ne peut pas marquer comme lue une notification de B (404), qui reste non lue", async () => {
    await orgA.agent.post("/api/v1/notifications/" + orgB.notificationId + "/lue").expect(404);

    const notification = await prisma.notification.findUniqueOrThrow({
      where: { id: orgB.notificationId },
      select: { lue_le: true },
    });
    expect(notification.lue_le).toBeNull();

    // Dans l'autre sens aussi.
    await orgB.agent.post("/api/v1/notifications/" + orgA.notificationId + "/lue").expect(404);
  });
});

describe("isolation : acces sans connexion", () => {
  it("toutes les routes du jour 6 refusent un visiteur non connecte (401)", async () => {
    await request(app).get("/api/v1/avis").expect(401);
    await request(app).get("/api/v1/avis/" + orgB.avisId).expect(401);
    await request(app).patch("/api/v1/avis/" + orgB.avisId + "/statut").send({ statut: "TRAITE" }).expect(401);
    await request(app).post("/api/v1/avis/" + orgB.avisId + "/notes").send({ commentaire: "Note" }).expect(401);
    await request(app).get("/api/v1/notifications").expect(401);
    await request(app).post("/api/v1/notifications/" + orgB.notificationId + "/lue").expect(401);
  });
});