import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Isolation entre organisations et perimetre par site pour les routes du jour 17 :
// sites, points de contact (dont activer, questionnaire associe) et creation en masse.
// L'organisation A essaie de lire ou de modifier les sites et points de B : tout doit etre refuse.
// Un Gestionnaire du site 1 ne voit rien des autres sites et ne peut rien modifier.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Sites-2026";

type Agent = ReturnType<typeof request.agent>;

type OrganisationDeTest = {
  organisationId: string;
  utilisateurIds: string[];
  siteId: string;
  autreSiteId: string;
  siteInactifId: string;
  pointId: string;
  pointInactifId: string;
  pointRevoqueId: string;
  pointAutreSiteId: string;
  questionnaireId: string;
  responsable: Agent;
  gestionnaire: Agent;
};

async function creerUtilisateurConnecte(
  organisationId: string,
  lettre: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  siteId: string | undefined,
): Promise<{ id: string; agent: Agent }> {
  const email = role.toLowerCase() + "-" + lettre.toLowerCase() + "-" + suffixe + "@test-isolation-sites.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: role + " " + lettre,
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
      nom: "TEST-ISOLATION-SITES-" + lettre + "-" + suffixe,
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
  const siteInactif = await prisma.site.create({
    data: { organisation_id: organisationId, nom: "Site " + lettre + " inactif", actif: false },
  });

  async function creerPoint(siteId: string, nom: string, extra: { actif?: boolean; revoque?: boolean }) {
    return prisma.pointContact.create({
      data: {
        organisation_id: organisationId,
        site_id: siteId,
        nom,
        code_public: randomBytes(9).toString("base64url"),
        ...(extra.actif !== undefined ? { actif: extra.actif } : {}),
        ...(extra.revoque ? { revoque_le: new Date() } : {}),
      },
      select: { id: true },
    });
  }
  const point = await creerPoint(site.id, "Table " + lettre + " 1", {});
  const pointInactif = await creerPoint(site.id, "Table " + lettre + " inactive", { actif: false });
  const pointRevoque = await creerPoint(site.id, "Table " + lettre + " revoquee", {
    actif: false,
    revoque: true,
  });
  const pointAutreSite = await creerPoint(autreSite.id, "Table " + lettre + " autre site", {});

  const questionnaire = await prisma.questionnaire.create({
    data: { organisation_id: organisationId, titre: { fr: "Questionnaire " + lettre } },
    select: { id: true },
  });

  const responsable = await creerUtilisateurConnecte(organisationId, lettre, "RESPONSABLE", undefined);
  const gestionnaire = await creerUtilisateurConnecte(organisationId, lettre, "GESTIONNAIRE", site.id);

  return {
    organisationId,
    utilisateurIds: [responsable.id, gestionnaire.id],
    siteId: site.id,
    autreSiteId: autreSite.id,
    siteInactifId: siteInactif.id,
    pointId: point.id,
    pointInactifId: pointInactif.id,
    pointRevoqueId: pointRevoque.id,
    pointAutreSiteId: pointAutreSite.id,
    questionnaireId: questionnaire.id,
    responsable: responsable.agent,
    gestionnaire: gestionnaire.agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;
// Modele sectoriel : il n'appartient a aucune organisation.
let modeleId: string;

beforeAll(async () => {
  // Les QR codes contiennent PUBLIC_BASE_URL : on la fixe pour le test.
  process.env["PUBLIC_BASE_URL"] = "https://test-isolation.local";
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const modele = await prisma.questionnaire.create({
    data: {
      secteur_id: secteur.id,
      est_modele: true,
      titre: { fr: "Modele de test " + suffixe },
    },
    select: { id: true },
  });
  modeleId = modele.id;
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
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateurSite.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.questionnaire.deleteMany({
    where: { OR: [{ organisation_id: { in: organisationIds } }, { id: modeleId ?? "" }] },
  });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 30000);

async function lireSite(id: string) {
  return prisma.site.findUniqueOrThrow({ where: { id }, select: { nom: true, actif: true } });
}

async function lirePoint(id: string) {
  return prisma.pointContact.findUniqueOrThrow({
    where: { id },
    select: { nom: true, actif: true, questionnaire_id: true, revoque_le: true },
  });
}

describe("isolation sites et points : acces sans connexion", () => {
  it("toutes les routes refusent un visiteur non connecte (401)", async () => {
    await request(app).get("/api/v1/sites").expect(401);
    await request(app).post("/api/v1/sites/" + orgB.siteId + "/activer").expect(401);
    await request(app).get("/api/v1/points-contact").expect(401);
    await request(app).post("/api/v1/points-contact/" + orgB.pointId + "/activer").expect(401);
    await request(app).post("/api/v1/points-contact/" + orgB.pointId + "/desactiver").expect(401);
    await request(app)
      .patch("/api/v1/points-contact/" + orgB.pointId)
      .send({ nom: "Pirate" })
      .expect(401);
  });
});

describe("isolation sites et points : le Gestionnaire est en lecture seule", () => {
  it("toutes les routes de modification refusent le Gestionnaire (403)", async () => {
    const g = orgA.gestionnaire;
    await g.post("/api/v1/sites").send({ nom: "Nouveau" }).expect(403);
    await g.patch("/api/v1/sites/" + orgA.siteId).send({ nom: "Autre nom" }).expect(403);
    await g.post("/api/v1/sites/" + orgA.siteInactifId + "/activer").expect(403);
    await g.post("/api/v1/sites/" + orgA.siteId + "/desactiver").expect(403);
    await g
      .post("/api/v1/points-contact")
      .send({ site_id: orgA.siteId, nom: "Nouveau point" })
      .expect(403);
    await g
      .post("/api/v1/points-contact/masse")
      .send({ site_id: orgA.siteId, fin: 3 })
      .expect(403);
    await g.patch("/api/v1/points-contact/" + orgA.pointId).send({ nom: "Autre nom" }).expect(403);
    await g.post("/api/v1/points-contact/" + orgA.pointInactifId + "/activer").expect(403);
    await g.post("/api/v1/points-contact/" + orgA.pointId + "/desactiver").expect(403);

    // Rien n'a change en base.
    expect((await lireSite(orgA.siteInactifId)).actif).toBe(false);
    expect((await lireSite(orgA.siteId)).actif).toBe(true);
    expect((await lirePoint(orgA.pointInactifId)).actif).toBe(false);
    expect((await lirePoint(orgA.pointId)).actif).toBe(true);
    expect((await lirePoint(orgA.pointId)).nom).toBe("Table A 1");
  });
});

describe("isolation sites et points : perimetre par site du Gestionnaire", () => {
  it("le Gestionnaire du site 1 ne voit que son site", async () => {
    const reponse = await orgA.gestionnaire.get("/api/v1/sites").expect(200);
    const ids = (reponse.body.sites as { id: string }[]).map((site) => site.id);
    expect(ids).toEqual([orgA.siteId]);
  });

  it("le Gestionnaire du site 1 ne voit aucun point des autres sites", async () => {
    const reponse = await orgA.gestionnaire.get("/api/v1/points-contact").expect(200);
    const points = reponse.body.points_contact as { id: string; site_id: string }[];
    expect(points.length).toBeGreaterThan(0);
    expect(points.every((point) => point.site_id === orgA.siteId)).toBe(true);
    expect(points.map((point) => point.id)).not.toContain(orgA.pointAutreSiteId);
  });

  it("demander explicitement un autre site ne montre rien", async () => {
    const liste = await orgA.gestionnaire
      .get("/api/v1/points-contact?site_id=" + orgA.autreSiteId)
      .expect(200);
    expect(liste.body.points_contact).toEqual([]);

    const stats = await orgA.gestionnaire
      .get("/api/v1/points-contact/statistiques-qr?site_id=" + orgA.autreSiteId)
      .expect(200);
    expect(stats.body.statistiques).toEqual([]);

    await orgA.gestionnaire
      .get("/api/v1/points-contact/planche?site_id=" + orgA.autreSiteId)
      .expect(404);
  });

  it("le Gestionnaire ne peut pas telecharger le QR d'un point d'un autre site (404)", async () => {
    await orgA.gestionnaire
      .get("/api/v1/points-contact/" + orgA.pointAutreSiteId + "/qr?format=png")
      .expect(404);
    await orgA.gestionnaire
      .get("/api/v1/points-contact/" + orgA.pointId + "/qr?format=png")
      .expect(200);
  });
});

describe("isolation sites et points : A ne touche pas aux donnees de B", () => {
  it("A ne voit ni les sites ni les points de B dans ses listes", async () => {
    const sites = await orgA.responsable.get("/api/v1/sites").expect(200);
    const idsSites = (sites.body.sites as { id: string }[]).map((site) => site.id);
    expect(idsSites).toContain(orgA.siteId);
    expect(idsSites).not.toContain(orgB.siteId);
    expect(idsSites).not.toContain(orgB.autreSiteId);

    const points = await orgA.responsable.get("/api/v1/points-contact").expect(200);
    const idsPoints = (points.body.points_contact as { id: string }[]).map((point) => point.id);
    expect(idsPoints).toContain(orgA.pointId);
    expect(idsPoints).not.toContain(orgB.pointId);

    const filtre = await orgA.responsable
      .get("/api/v1/points-contact?site_id=" + orgB.siteId)
      .expect(200);
    expect(filtre.body.points_contact).toEqual([]);
  });

  it("A ne peut ni modifier, ni activer, ni desactiver un site de B (404)", async () => {
    await orgA.responsable
      .patch("/api/v1/sites/" + orgB.siteId)
      .send({ nom: "Pirate" })
      .expect(404);
    await orgA.responsable.post("/api/v1/sites/" + orgB.siteInactifId + "/activer").expect(404);
    await orgA.responsable.post("/api/v1/sites/" + orgB.siteId + "/desactiver").expect(404);

    expect(await lireSite(orgB.siteId)).toEqual({ nom: "Site B principal", actif: true });
    expect((await lireSite(orgB.siteInactifId)).actif).toBe(false);
  });

  it("A ne peut ni modifier, ni activer, ni desactiver un point de B (404)", async () => {
    await orgA.responsable
      .patch("/api/v1/points-contact/" + orgB.pointId)
      .send({ nom: "Pirate" })
      .expect(404);
    await orgA.responsable.post("/api/v1/points-contact/" + orgB.pointInactifId + "/activer").expect(404);
    await orgA.responsable.post("/api/v1/points-contact/" + orgB.pointId + "/desactiver").expect(404);

    expect((await lirePoint(orgB.pointId)).nom).toBe("Table B 1");
    expect((await lirePoint(orgB.pointId)).actif).toBe(true);
    expect((await lirePoint(orgB.pointInactifId)).actif).toBe(false);
  });

  it("A ne peut pas creer de point dans un site de B (404), ni un par un ni en masse", async () => {
    const avant = await prisma.pointContact.count({ where: { site_id: orgB.siteId } });

    await orgA.responsable
      .post("/api/v1/points-contact")
      .send({ site_id: orgB.siteId, nom: "Table pirate" })
      .expect(404);
    await orgA.responsable
      .post("/api/v1/points-contact/masse")
      .send({ site_id: orgB.siteId, prefixe: "Pirate", fin: 5 })
      .expect(404);

    expect(await prisma.pointContact.count({ where: { site_id: orgB.siteId } })).toBe(avant);
  });
});

describe("isolation sites et points : questionnaire associe", () => {
  it("A ne peut pas associer le questionnaire de B (404), nulle part", async () => {
    const avant = await prisma.pointContact.count({ where: { organisation_id: orgA.organisationId } });

    await orgA.responsable
      .post("/api/v1/points-contact")
      .send({ site_id: orgA.siteId, nom: "Table piratee", questionnaire_id: orgB.questionnaireId })
      .expect(404);
    await orgA.responsable
      .post("/api/v1/points-contact/masse")
      .send({ site_id: orgA.siteId, prefixe: "Piratee", fin: 3, questionnaire_id: orgB.questionnaireId })
      .expect(404);
    await orgA.responsable
      .patch("/api/v1/points-contact/" + orgA.pointId)
      .send({ questionnaire_id: orgB.questionnaireId })
      .expect(404);

    expect(await prisma.pointContact.count({ where: { organisation_id: orgA.organisationId } })).toBe(avant);
    expect((await lirePoint(orgA.pointId)).questionnaire_id).toBeNull();
  });

  it("un modele sectoriel ne s'associe pas directement (404)", async () => {
    await orgA.responsable
      .patch("/api/v1/points-contact/" + orgA.pointId)
      .send({ questionnaire_id: modeleId })
      .expect(404);
    expect((await lirePoint(orgA.pointId)).questionnaire_id).toBeNull();
  });

  it("un identifiant de questionnaire invalide est refuse (400)", async () => {
    await orgA.responsable
      .patch("/api/v1/points-contact/" + orgA.pointId)
      .send({ questionnaire_id: "pas-un-identifiant" })
      .expect(400);
  });

  it("A associe, change puis retire le questionnaire de son propre point", async () => {
    const associe = await orgA.responsable
      .patch("/api/v1/points-contact/" + orgA.pointId)
      .send({ questionnaire_id: orgA.questionnaireId })
      .expect(200);
    expect(associe.body.point_contact.questionnaire_id).toBe(orgA.questionnaireId);
    expect(associe.body.point_contact.questionnaire.titre.fr).toBe("Questionnaire A");

    const retire = await orgA.responsable
      .patch("/api/v1/points-contact/" + orgA.pointId)
      .send({ questionnaire_id: null })
      .expect(200);
    expect(retire.body.point_contact.questionnaire_id).toBeNull();
    expect(retire.body.point_contact.questionnaire).toBeNull();
  });

  it("la creation en masse applique le questionnaire a tous les points crees", async () => {
    const corps = {
      site_id: orgA.siteId,
      prefixe: "Masse",
      fin: 3,
      questionnaire_id: orgA.questionnaireId,
    };
    const premiere = await orgA.responsable.post("/api/v1/points-contact/masse").send(corps).expect(201);
    expect(premiere.body).toEqual({ crees: 3, deja_existants: 0 });

    const points = await prisma.pointContact.findMany({
      where: { site_id: orgA.siteId, nom: { startsWith: "Masse " } },
      select: { questionnaire_id: true },
    });
    expect(points).toHaveLength(3);
    expect(points.every((point) => point.questionnaire_id === orgA.questionnaireId)).toBe(true);

    // Rejouer la meme demande ne cree aucun doublon.
    const seconde = await orgA.responsable.post("/api/v1/points-contact/masse").send(corps).expect(201);
    expect(seconde.body).toEqual({ crees: 0, deja_existants: 3 });
  });
});

describe("isolation sites et points : activation dans sa propre organisation", () => {
  it("A reactive puis desactive son propre site", async () => {
    const active = await orgA.responsable
      .post("/api/v1/sites/" + orgA.siteInactifId + "/activer")
      .expect(200);
    expect(active.body.site.actif).toBe(true);

    const desactive = await orgA.responsable
      .post("/api/v1/sites/" + orgA.siteInactifId + "/desactiver")
      .expect(200);
    expect(desactive.body.site.actif).toBe(false);
  });

  it("A reactive son propre point, mais un QR revoque reste revoque", async () => {
    const active = await orgA.responsable
      .post("/api/v1/points-contact/" + orgA.pointInactifId + "/activer")
      .expect(200);
    expect(active.body.point_contact.actif).toBe(true);

    const revoque = await orgA.responsable
      .post("/api/v1/points-contact/" + orgA.pointRevoqueId + "/activer")
      .expect(200);
    expect(revoque.body.point_contact.actif).toBe(true);
    expect(revoque.body.point_contact.revoque_le).not.toBeNull();
    expect((await lirePoint(orgA.pointRevoqueId)).revoque_le).not.toBeNull();
  });
});