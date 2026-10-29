import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Isolation entre organisations pour les routes du jour 8 : QR codes, planche, revocation, statistiques.
// L'organisation A essaie de lire ou de modifier les QR codes de B : tout doit etre refuse.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Qr-2026";

type OrganisationDeTest = {
  organisationId: string;
  utilisateurId: string;
  siteId: string;
  pointContactId: string;
  codePublic: string;
  agent: ReturnType<typeof request.agent>;
};

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-ISOLATION-QR-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });

  const email = "responsable-" + lettre.toLowerCase() + "-" + suffixe + "@test-isolation-qr.local";
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

  const codePublic = randomBytes(9).toString("base64url");
  const pointContact = await prisma.pointContact.create({
    data: {
      organisation_id: organisation.id,
      site_id: site.id,
      nom: "Table " + lettre,
      code_public: codePublic,
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
    codePublic,
    agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;

beforeAll(async () => {
  // Les QR codes contiennent PUBLIC_BASE_URL : on la fixe pour le test.
  process.env["PUBLIC_BASE_URL"] = "https://test-isolation.local";
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

async function lirePointB() {
  return prisma.pointContact.findUniqueOrThrow({
    where: { id: orgB.pointContactId },
    select: { code_public: true, revoque_le: true },
  });
}

describe("isolation QR : acces sans connexion", () => {
  it("toutes les routes QR refusent un visiteur non connecte (401)", async () => {
    await request(app).get("/api/v1/points-contact/" + orgB.pointContactId + "/qr").expect(401);
    await request(app).get("/api/v1/points-contact/planche").expect(401);
    await request(app).get("/api/v1/points-contact/statistiques-qr").expect(401);
    await request(app).post("/api/v1/points-contact/" + orgB.pointContactId + "/revoquer").send({}).expect(401);
  });
});

describe("isolation QR : telechargement", () => {
  it("A ne peut telecharger aucun QR de B (404), quel que soit le format", async () => {
    for (const format of ["png", "svg", "pdf"]) {
      await orgA.agent
        .get("/api/v1/points-contact/" + orgB.pointContactId + "/qr?format=" + format)
        .expect(404);
    }
  });

  it("A telecharge normalement le QR de son propre point de contact (200)", async () => {
    const png = await orgA.agent
      .get("/api/v1/points-contact/" + orgA.pointContactId + "/qr?format=png")
      .expect(200);
    expect(png.headers["content-type"]).toContain("image/png");

    const svg = await orgA.agent
      .get("/api/v1/points-contact/" + orgA.pointContactId + "/qr?format=svg")
      .expect(200);
    expect(svg.headers["content-type"]).toContain("image/svg+xml");

    const pdf = await orgA.agent
      .get("/api/v1/points-contact/" + orgA.pointContactId + "/qr?format=pdf&taille=A6")
      .expect(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
  });

  it("la planche de A ne contient rien de B : le site de B ne donne aucun chevalet (404)", async () => {
    await orgA.agent.get("/api/v1/points-contact/planche").expect(200);
    await orgA.agent.get("/api/v1/points-contact/planche?site_id=" + orgB.siteId).expect(404);
  });
});

describe("isolation QR : revocation et regeneration", () => {
  it("A ne peut pas revoquer le QR de B (404), qui reste inchange", async () => {
    const avant = await lirePointB();

    await orgA.agent
      .post("/api/v1/points-contact/" + orgB.pointContactId + "/revoquer")
      .send({})
      .expect(404);

    const apres = await lirePointB();
    expect(apres.revoque_le).toBeNull();
    expect(apres.code_public).toBe(avant.code_public);
  });

  it("A ne peut pas regenerer le QR de B (404), dont le code reste le meme", async () => {
    const avant = await lirePointB();

    await orgA.agent
      .post("/api/v1/points-contact/" + orgB.pointContactId + "/revoquer")
      .send({ regenerer: true })
      .expect(404);

    const apres = await lirePointB();
    expect(apres.code_public).toBe(avant.code_public);
    expect(apres.revoque_le).toBeNull();
  });

  it("envoyer l'organisation de B dans le corps est refuse (400), rien n'est modifie", async () => {
    const avant = await lirePointB();

    await orgA.agent
      .post("/api/v1/points-contact/" + orgA.pointContactId + "/revoquer")
      .send({ organisation_id: orgB.organisationId })
      .expect(400);
    await orgA.agent
      .post("/api/v1/points-contact/" + orgB.pointContactId + "/revoquer")
      .send({ organisation_id: orgB.organisationId })
      .expect(400);

    const apres = await lirePointB();
    expect(apres.revoque_le).toBeNull();
    expect(apres.code_public).toBe(avant.code_public);
    const pointA = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgA.pointContactId },
      select: { revoque_le: true },
    });
    expect(pointA.revoque_le).toBeNull();
  });
});

describe("isolation QR : statistiques", () => {
  it("A ne voit que ses propres points dans les statistiques", async () => {
    const reponse = await orgA.agent.get("/api/v1/points-contact/statistiques-qr").expect(200);
    const identifiants = (reponse.body.statistiques as { point_contact_id: string }[]).map(
      (ligne) => ligne.point_contact_id,
    );

    expect(identifiants).toEqual([orgA.pointContactId]);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.pointContactId);
  });

  it("le filtre sur le site de B ne donne rien, et organisation_id est ignore", async () => {
    const filtre = await orgA.agent
      .get("/api/v1/points-contact/statistiques-qr?site_id=" + orgB.siteId)
      .expect(200);
    expect(filtre.body.statistiques).toEqual([]);

    const ignore = await orgA.agent
      .get("/api/v1/points-contact/statistiques-qr?organisation_id=" + orgB.organisationId)
      .expect(200);
    const identifiants = (ignore.body.statistiques as { point_contact_id: string }[]).map(
      (ligne) => ligne.point_contact_id,
    );
    expect(identifiants).toEqual([orgA.pointContactId]);
  });
});

describe("QR : revocation et regeneration de son propre point (controle de non-regression)", () => {
  it("revoquer : le point est revoque, son telechargement est refuse (409), B est intact", async () => {
    const reponse = await orgA.agent
      .post("/api/v1/points-contact/" + orgA.pointContactId + "/revoquer")
      .send({})
      .expect(200);
    expect(reponse.body.action).toBe("revoque");
    expect(reponse.body.point_contact.revoque).toBe(true);
    expect(JSON.stringify(reponse.body)).not.toContain(orgA.codePublic);

    await orgA.agent.get("/api/v1/points-contact/" + orgA.pointContactId + "/qr").expect(409);

    const pointB = await lirePointB();
    expect(pointB.revoque_le).toBeNull();
  });

  it("regenerer : un nouveau code remplace l'ancien, le point redevient utilisable", async () => {
    const reponse = await orgA.agent
      .post("/api/v1/points-contact/" + orgA.pointContactId + "/revoquer")
      .send({ regenerer: true })
      .expect(200);
    expect(reponse.body.action).toBe("regenere");
    expect(reponse.body.point_contact.revoque).toBe(false);

    const point = await prisma.pointContact.findUniqueOrThrow({
      where: { id: orgA.pointContactId },
      select: { code_public: true, revoque_le: true },
    });
    expect(point.code_public).not.toBe(orgA.codePublic);
    expect(point.revoque_le).toBeNull();

    await orgA.agent.get("/api/v1/points-contact/" + orgA.pointContactId + "/qr").expect(200);
  });
});