import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";
import express from "express";
import cookieParser from "cookie-parser";
import { exigerConnexion } from "../../src/middleware/exiger-connexion";
import { exigerRole } from "../../src/middleware/exiger-role";
const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-2026";

type OrganisationDeTest = {
  organisationId: string;
  utilisateurId: string;
  siteId: string;
  pointContactId: string;
  questionnaireId: string;
  versionId: string;
  agent: ReturnType<typeof request.agent>;
};

function corpsQuestionnaire(titre: string) {
  return {
    titre: { fr: titre },
    questions: [{ type: "ETOILES", libelle: { fr: "Note ?" } }],
  };
}

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-ISOLATION-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });
  const email = "responsable-" + lettre.toLowerCase() + "-" + suffixe + "@test-isolation.local";
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
  const pointContact = await prisma.pointContact.create({
    data: {
      organisation_id: organisation.id,
      site_id: site.id,
      nom: "Table " + lettre,
      code_public: randomBytes(9).toString("base64url"),
    },
  });
  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisation.id,
      titre: { fr: "Questionnaire " + lettre },
      versions: {
        create: {
          numero: 1,
          questions: {
            create: [
              {
                ordre: 1,
                type: "ETOILES",
                libelle: { fr: "Note ?" },
                echelle_min: 1,
                echelle_max: 5,
              },
            ],
          },
        },
      },
    },
    select: { id: true, versions: { select: { id: true } } },
  });
  const version = questionnaire.versions[0];
  if (!version) {
    throw new Error("Version du questionnaire de test introuvable.");
  }

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
    versionId: version.id,
    agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;

// Modeles de questionnaire (sans organisation) : un du secteur restauration, un d'un autre secteur.
let modeleRestaurationId: string;
let modeleAutreSecteurId: string;

async function creerModeleDeTest(secteurId: string, titre: string): Promise<string> {
  const modele = await prisma.questionnaire.create({
    data: {
      secteur_id: secteurId,
      est_modele: true,
      titre: { fr: titre },
      versions: {
        create: {
          numero: 1,
          questions: {
            create: [
              {
                ordre: 1,
                type: "ETOILES",
                libelle: { fr: "Note ?" },
                echelle_min: 1,
                echelle_max: 5,
              },
            ],
          },
        },
      },
    },
    select: { id: true },
  });
  return modele.id;
}

beforeAll(async () => {
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");

  const restauration = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const autreSecteur = await prisma.secteur.create({
    data: { code: "test-isolation-" + suffixe, nom_fr: "Secteur de test", nom_en: "Test sector" },
  });
  modeleRestaurationId = await creerModeleDeTest(restauration.id, "Modele test restauration");
  modeleAutreSecteurId = await creerModeleDeTest(autreSecteur.id, "Modele test autre secteur");
}, 30000);

afterAll(async () => {
  const organisationIds = [orgA?.organisationId, orgB?.organisationId].filter(
    (id): id is string => id !== undefined,
  );
  const utilisateurIds = [orgA?.utilisateurId, orgB?.utilisateurId].filter(
    (id): id is string => id !== undefined,
  );

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
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.question.deleteMany({
    where: { version: { questionnaire: { organisation_id: { in: organisationIds } } } },
  });
  await prisma.questionnaireVersion.deleteMany({
    where: { questionnaire: { organisation_id: { in: organisationIds } } },
  });
  await prisma.questionnaire.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  const modeleIds = [modeleRestaurationId, modeleAutreSecteurId].filter((id) => Boolean(id));
  await prisma.question.deleteMany({
    where: { version: { questionnaire: { id: { in: modeleIds } } } },
  });
  await prisma.questionnaireVersion.deleteMany({
    where: { questionnaire: { id: { in: modeleIds } } },
  });
  await prisma.questionnaire.deleteMany({ where: { id: { in: modeleIds } } });
  await prisma.secteur.deleteMany({ where: { code: "test-isolation-" + suffixe } });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 30000);

describe("isolation entre organisations", () => {
  it("l'organisation A ne voit que ses propres sites", async () => {
    const reponse = await orgA.agent.get("/api/v1/sites").expect(200);
    const ids = reponse.body.sites.map((site: { id: string }) => site.id);

    expect(ids).toContain(orgA.siteId);
    expect(ids).not.toContain(orgB.siteId);
  });
});
describe("l'organisation A essaie d'atteindre les donnees de B", () => {
  it("refuse l'acces sans connexion (401)", async () => {
    await request(app).get("/api/v1/sites").expect(401);
    await request(app).get("/api/v1/points-contact").expect(401);
    await request(app).get("/api/v1/questionnaires").expect(401);
    await request(app).get("/api/v1/questionnaires/" + orgB.questionnaireId).expect(401);
    await request(app).get("/api/v1/questionnaires/modeles").expect(401);
  });

  it("ne modifie pas un site de B (404)", async () => {
    await orgA.agent.patch("/api/v1/sites/" + orgB.siteId).send({ nom: "Pirate" }).expect(404);
    const site = await prisma.site.findUniqueOrThrow({ where: { id: orgB.siteId } });
    expect(site.nom).toBe("Site B");
  });

  it("ne desactive pas un site de B (404)", async () => {
    await orgA.agent.post("/api/v1/sites/" + orgB.siteId + "/desactiver").expect(404);
    const site = await prisma.site.findUniqueOrThrow({ where: { id: orgB.siteId } });
    expect(site.actif).toBe(true);
  });

  it("ne liste aucun point de contact de B", async () => {
    const reponse = await orgA.agent.get("/api/v1/points-contact").expect(200);
    const ids = reponse.body.points_contact.map((point: { id: string }) => point.id);
    expect(ids).toContain(orgA.pointContactId);
    expect(ids).not.toContain(orgB.pointContactId);

    const filtre = await orgA.agent
      .get("/api/v1/points-contact?site_id=" + orgB.siteId)
      .expect(200);
    expect(filtre.body.points_contact).toHaveLength(0);
  });

  it("ne modifie pas un point de contact de B (404)", async () => {
    await orgA.agent
      .patch("/api/v1/points-contact/" + orgB.pointContactId)
      .send({ nom: "Pirate" })
      .expect(404);
    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgB.pointContactId },
    });
    expect(point.nom).toBe("Table B");
  });

  it("ne desactive pas un point de contact de B (404)", async () => {
    await orgA.agent
      .post("/api/v1/points-contact/" + orgB.pointContactId + "/desactiver")
      .expect(404);
    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgB.pointContactId },
    });
    expect(point.actif).toBe(true);
  });

  it("ne cree pas de point de contact dans un site de B (404)", async () => {
    await orgA.agent
      .post("/api/v1/points-contact")
      .send({ site_id: orgB.siteId, nom: "Intrus" })
      .expect(404);
    await orgA.agent
      .post("/api/v1/points-contact/masse")
      .send({ site_id: orgB.siteId, debut: 1, fin: 5 })
      .expect(404);
    const nombre = await prisma.pointContact.count({ where: { site_id: orgB.siteId } });
    expect(nombre).toBe(1);
  });

  it("refuse une organisation envoyee par le navigateur (400)", async () => {
    await orgA.agent
      .post("/api/v1/sites")
      .send({ nom: "Faux site", organisation_id: orgB.organisationId })
      .expect(400);
    const nombre = await prisma.site.count({ where: { organisation_id: orgB.organisationId } });
    expect(nombre).toBe(1);
  });

  it("ne liste aucun questionnaire de B", async () => {
    const reponse = await orgA.agent.get("/api/v1/questionnaires").expect(200);
    const ids = reponse.body.questionnaires.map((questionnaire: { id: string }) => questionnaire.id);
    expect(ids).toContain(orgA.questionnaireId);
    expect(ids).not.toContain(orgB.questionnaireId);
  });

  it("ne lit pas un questionnaire de B (404)", async () => {
    await orgA.agent.get("/api/v1/questionnaires/" + orgB.questionnaireId).expect(404);
  });

  it("ne modifie pas un questionnaire de B (404)", async () => {
    await orgA.agent
      .put("/api/v1/questionnaires/" + orgB.questionnaireId)
      .send(corpsQuestionnaire("Pirate"))
      .expect(404);
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: orgB.questionnaireId },
    });
    expect(questionnaire.titre).toEqual({ fr: "Questionnaire B" });
  });

  it("ne publie pas un questionnaire de B (404)", async () => {
    await orgA.agent.post("/api/v1/questionnaires/" + orgB.questionnaireId + "/publier").expect(404);
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: orgB.questionnaireId },
    });
    expect(questionnaire.statut).toBe("BROUILLON");
  });

  it("ne duplique pas un questionnaire de B (404)", async () => {
    await orgA.agent
      .post("/api/v1/questionnaires/" + orgB.questionnaireId + "/dupliquer")
      .expect(404);
    const nombreB = await prisma.questionnaire.count({
      where: { organisation_id: orgB.organisationId },
    });
    expect(nombreB).toBe(1);
  });

  it("refuse une organisation envoyee pour creer un questionnaire (400)", async () => {
    await orgA.agent
      .post("/api/v1/questionnaires")
      .send({ ...corpsQuestionnaire("Faux"), organisation_id: orgB.organisationId })
      .expect(400);
    const nombreB = await prisma.questionnaire.count({
      where: { organisation_id: orgB.organisationId },
    });
    expect(nombreB).toBe(1);
  });

  it("n'active pas un questionnaire de B (404)", async () => {
    await orgA.agent.post("/api/v1/questionnaires/" + orgB.questionnaireId + "/activer").expect(404);
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: orgB.questionnaireId },
    });
    expect(questionnaire.statut).toBe("BROUILLON");
  });

  it("ne desactive pas un questionnaire de B (404)", async () => {
    await orgA.agent
      .post("/api/v1/questionnaires/" + orgB.questionnaireId + "/desactiver")
      .expect(404);
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: orgB.questionnaireId },
    });
    expect(questionnaire.statut).toBe("BROUILLON");
  });

  it("ne change pas les dates d'un questionnaire de B (404)", async () => {
    await orgA.agent
      .put("/api/v1/questionnaires/" + orgB.questionnaireId + "/dates")
      .send({ date_debut: "2026-12-01T08:00:00Z", date_fin: "2026-12-02T08:00:00Z" })
      .expect(404);
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: orgB.questionnaireId },
    });
    expect(questionnaire.date_debut).toBeNull();
    expect(questionnaire.date_fin).toBeNull();
  });

  it("n'associe pas un point de contact de B a un questionnaire de A (404)", async () => {
    await orgA.agent
      .put("/api/v1/questionnaires/" + orgA.questionnaireId + "/points-contact")
      .send({ points_contact_ids: [orgB.pointContactId] })
      .expect(404);
    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgB.pointContactId },
    });
    expect(point.questionnaire_id).toBeNull();
  });

  it("n'associe rien a un questionnaire de B (404)", async () => {
    await orgA.agent
      .put("/api/v1/questionnaires/" + orgB.questionnaireId + "/points-contact")
      .send({ points_contact_ids: [orgA.pointContactId] })
      .expect(404);
    const pointA = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgA.pointContactId },
    });
    expect(pointA.questionnaire_id).toBeNull();
    const nombreAssocies = await prisma.pointContact.count({
      where: { questionnaire_id: orgB.questionnaireId },
    });
    expect(nombreAssocies).toBe(0);
  });

  it("A peut associer son propre point de contact a son propre questionnaire (200)", async () => {
    const reponse = await orgA.agent
      .put("/api/v1/questionnaires/" + orgA.questionnaireId + "/points-contact")
      .send({ points_contact_ids: [orgA.pointContactId] })
      .expect(200);
    const ids = reponse.body.points_contact.map((point: { id: string }) => point.id);
    expect(ids).toEqual([orgA.pointContactId]);
  });
});
describe("modeles de questionnaire", () => {
  it("ne propose que les modeles du secteur de l'organisation", async () => {
    const reponse = await orgA.agent.get("/api/v1/questionnaires/modeles").expect(200);
    const ids = reponse.body.modeles.map((modele: { id: string }) => modele.id);
    expect(ids).toContain(modeleRestaurationId);
    expect(ids).not.toContain(modeleAutreSecteurId);
  });

  it("ne clone pas un modele d'un autre secteur (404)", async () => {
    const avant = await prisma.questionnaire.count({
      where: { organisation_id: orgA.organisationId },
    });
    await orgA.agent
      .post("/api/v1/questionnaires/modeles/" + modeleAutreSecteurId + "/cloner")
      .expect(404);
    const apres = await prisma.questionnaire.count({
      where: { organisation_id: orgA.organisationId },
    });
    expect(apres).toBe(avant);
  });

  it("ne clone pas le questionnaire de B comme s'il etait un modele (404)", async () => {
    await orgA.agent
      .post("/api/v1/questionnaires/modeles/" + orgB.questionnaireId + "/cloner")
      .expect(404);
    const nombreB = await prisma.questionnaire.count({
      where: { organisation_id: orgB.organisationId },
    });
    expect(nombreB).toBe(1);
  });

  it("clone un modele de son secteur : la copie appartient a A, pas a B (201)", async () => {
    const reponse = await orgA.agent
      .post("/api/v1/questionnaires/modeles/" + modeleRestaurationId + "/cloner")
      .expect(201);
    const copieId: string = reponse.body.questionnaire.id;

    const copie = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: copieId },
      select: {
        organisation_id: true,
        est_modele: true,
        statut: true,
        versions: { select: { numero: true, _count: { select: { questions: true } } } },
      },
    });
    expect(copie.organisation_id).toBe(orgA.organisationId);
    expect(copie.est_modele).toBe(false);
    expect(copie.statut).toBe("BROUILLON");
    expect(copie.versions).toHaveLength(1);
    expect(copie.versions[0]?.numero).toBe(1);
    expect(copie.versions[0]?._count.questions).toBe(1);

    const listeB = await orgB.agent.get("/api/v1/questionnaires").expect(200);
    const idsB = listeB.body.questionnaires.map((questionnaire: { id: string }) => questionnaire.id);
    expect(idsB).not.toContain(copieId);
  });
});
describe("controle des roles", () => {
  it("une route reservee a l'administrateur repond 403 a un responsable", async () => {
    const miniApp = express();
    miniApp.use(cookieParser());
    miniApp.get("/reservee-admin", exigerConnexion, exigerRole("ADMINISTRATEUR"), (_req, res) => {
      res.json({ ok: true });
    });

    const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: orgA.utilisateurId },
    });
    const connexion = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: utilisateur.email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
      .expect(200);
    const cookies = connexion.get("Set-Cookie") ?? [];

    await request(miniApp).get("/reservee-admin").set("Cookie", cookies).expect(403);
    await request(miniApp).get("/reservee-admin").expect(401);
  });
});
describe("versionnage des questionnaires", () => {
  it("sans avis : la version est modifiee sur place", async () => {
    const reponse = await orgA.agent
      .put("/api/v1/questionnaires/" + orgA.questionnaireId)
      .send(corpsQuestionnaire("A modifie"))
      .expect(200);
    expect(reponse.body.nouvelle_version).toBe(false);
    expect(reponse.body.questionnaire.version.numero).toBe(1);
  });

  it("avec avis : une version 2 est creee, l'ancien avis reste lie a la version 1", async () => {
    const avis = await prisma.avis.create({
      data: {
        organisation_id: orgA.organisationId,
        site_id: orgA.siteId,
        point_contact_id: orgA.pointContactId,
        version_id: orgA.versionId,
      },
    });

    const reponse = await orgA.agent
      .put("/api/v1/questionnaires/" + orgA.questionnaireId)
      .send(corpsQuestionnaire("A version 2"))
      .expect(200);
    expect(reponse.body.nouvelle_version).toBe(true);
    expect(reponse.body.questionnaire.version.numero).toBe(2);

    const avisApres = await prisma.avis.findUniqueOrThrow({ where: { id: avis.id } });
    expect(avisApres.version_id).toBe(orgA.versionId);
    const nombreVersions = await prisma.questionnaireVersion.count({
      where: { questionnaire_id: orgA.questionnaireId },
    });
    expect(nombreVersions).toBe(2);
  });
});