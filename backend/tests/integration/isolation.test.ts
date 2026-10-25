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
  agent: ReturnType<typeof request.agent>;
};

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