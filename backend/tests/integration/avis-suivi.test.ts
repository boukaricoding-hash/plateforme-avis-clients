import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Test du changement de statut et des notes internes (jour 6, etape 3).
// Chaque test cree son propre avis : les tests ne dependent pas les uns des autres.
// L'organisation de test est supprimee a la fin.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Suivi-Avis-2026";

let organisationId: string;
let siteAId: string;
let siteBId: string;
let pointAId: string;
let pointBId: string;
let versionId: string;
let idEtoiles: string;

let responsableId: string;
let gestionnaireAId: string;
let agentResponsable: ReturnType<typeof request.agent>;
let agentGestionnaireA: ReturnType<typeof request.agent>;

async function connecter(email: string): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  return agent;
}

// Cree un avis neutre (3 sur 5, pas d'alerte), au statut NOUVEAU.
async function creerAvis(site: "A" | "B", options: { supprime?: boolean } = {}): Promise<string> {
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisationId,
      site_id: site === "A" ? siteAId : siteBId,
      point_contact_id: site === "A" ? pointAId : pointBId,
      version_id: versionId,
      langue: "fr",
      note_globale: 3,
      commentaire: "Avis de test " + suffixe,
      ...(options.supprime === true ? { supprime_le: new Date() } : {}),
      reponses: {
        create: [{ organisation_id: organisationId, question_id: idEtoiles, valeur_numerique: 3 }],
      },
    },
    select: { id: true },
  });
  return avis.id;
}

async function lireStatut(avisId: string): Promise<string> {
  const avis = await prisma.avis.findUniqueOrThrow({
    where: { id: avisId },
    select: { statut_traitement: true },
  });
  return avis.statut_traitement;
}

async function lireSuivis(avisId: string) {
  return prisma.avisSuivi.findMany({
    where: { avis_id: avisId },
    orderBy: { cree_le: "asc" },
  });
}

beforeAll(async () => {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-SUIVI-AVIS-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const siteA = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site A" } });
  const siteB = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site B" } });
  siteAId = siteA.id;
  siteBId = siteB.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test suivi" },
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
  const etoiles = version?.questions[0];
  if (!version || !etoiles) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionId = version.id;
  idEtoiles = etoiles.id;

  const pointA = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteAId,
      questionnaire_id: questionnaire.id,
      nom: "Table A",
      code_public: randomBytes(9).toString("base64url"),
    },
  });
  const pointB = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteBId,
      questionnaire_id: questionnaire.id,
      nom: "Table B",
      code_public: randomBytes(9).toString("base64url"),
    },
  });
  pointAId = pointA.id;
  pointBId = pointB.id;

  const motDePasseHash = await hash(MOT_DE_PASSE, 4);
  const responsable = await prisma.utilisateur.create({
    data: {
      email: "responsable-" + suffixe + "@test-suivi.local",
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable Suivi",
      role: "RESPONSABLE",
      organisation_id: organisationId,
    },
    select: { id: true, email: true },
  });
  const gestionnaire = await prisma.utilisateur.create({
    data: {
      email: "gestionnaire-" + suffixe + "@test-suivi.local",
      mot_de_passe_hash: motDePasseHash,
      nom: "Gestionnaire Suivi A",
      role: "GESTIONNAIRE",
      organisation_id: organisationId,
      utilisateurs_sites: { create: { site_id: siteAId } },
    },
    select: { id: true, email: true },
  });
  responsableId = responsable.id;
  gestionnaireAId = gestionnaire.id;

  agentResponsable = await connecter(responsable.email);
  agentGestionnaireA = await connecter(gestionnaire.email);
}, 30000);

afterAll(async () => {
  if (organisationId !== undefined) {
    const utilisateurIds = [responsableId, gestionnaireAId].filter((id): id is string => id !== undefined);

    await prisma.avisSuivi.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.notification.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.alerte.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.reponse.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.avis.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ organisation_id: organisationId }, { utilisateur_id: { in: utilisateurIds } }],
      },
    });
    await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
    await prisma.utilisateurSite.deleteMany({
      where: { utilisateur: { organisation_id: organisationId } },
    });
    await prisma.utilisateur.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.scan.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.pointContact.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.question.deleteMany({
      where: { version: { questionnaire: { organisation_id: organisationId } } },
    });
    await prisma.questionnaireVersion.deleteMany({
      where: { questionnaire: { organisation_id: organisationId } },
    });
    await prisma.questionnaire.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.site.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.organisation.deleteMany({ where: { id: organisationId } });
  }
  await prisma.$disconnect();
}, 30000);

describe("changement de statut d'un avis", () => {
  it("refuse l'acces sans connexion (401)", async () => {
    const avisId = await creerAvis("A");

    await request(app).patch("/api/v1/avis/" + avisId + "/statut").send({ statut: "EN_COURS" }).expect(401);
    await request(app).post("/api/v1/avis/" + avisId + "/notes").send({ commentaire: "Note" }).expect(401);
    expect(await lireStatut(avisId)).toBe("NOUVEAU");
  });

  it("enregistre le nouveau statut avec son auteur, sa date et son commentaire", async () => {
    const avisId = await creerAvis("A");

    const reponse = await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "EN_COURS", commentaire: "Client rappele" })
      .expect(200);

    expect(reponse.body.statut_traitement).toBe("EN_COURS");
    expect(reponse.body.suivi.type).toBe("CHANGEMENT_STATUT");
    expect(reponse.body.suivi.ancien_statut).toBe("NOUVEAU");
    expect(reponse.body.suivi.nouveau_statut).toBe("EN_COURS");
    expect(reponse.body.suivi.commentaire).toBe("Client rappele");
    expect(reponse.body.suivi.utilisateur.nom).toBe("Responsable Suivi");
    expect(JSON.stringify(reponse.body)).not.toContain("organisation_id");

    // En base : le statut a change et une ligne d'historique existe, avec l'auteur et la date.
    expect(await lireStatut(avisId)).toBe("EN_COURS");
    const suivis = await lireSuivis(avisId);
    expect(suivis).toHaveLength(1);
    expect(suivis[0]?.utilisateur_id).toBe(responsableId);
    expect(suivis[0]?.type).toBe("CHANGEMENT_STATUT");
    expect(suivis[0]?.commentaire).toBe("Client rappele");
    const ecart = Math.abs(Date.now() - (suivis[0]?.cree_le.getTime() ?? 0));
    expect(ecart).toBeLessThan(60 * 60 * 1000);
  });

  it("refuse de remettre le meme statut (409) sans rien ecrire", async () => {
    const avisId = await creerAvis("A");
    await agentResponsable.patch("/api/v1/avis/" + avisId + "/statut").send({ statut: "TRAITE" }).expect(200);

    const reponse = await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "TRAITE" })
      .expect(409);

    expect(reponse.body.code).toBe("STATUT_INCHANGE");
    expect(await lireSuivis(avisId)).toHaveLength(1);
  });

  it("accepte un changement sans commentaire ou avec un commentaire vide", async () => {
    const avisId = await creerAvis("A");

    const sans = await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "EN_COURS" })
      .expect(200);
    expect(sans.body.suivi.commentaire).toBeNull();

    const vide = await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "TRAITE", commentaire: "   " })
      .expect(200);
    expect(vide.body.suivi.commentaire).toBeNull();
  });

  it("refuse les donnees invalides (400) sans rien changer", async () => {
    const avisId = await creerAvis("A");
    const adresse = "/api/v1/avis/" + avisId + "/statut";

    const corpsVide = await agentResponsable.patch(adresse).send({}).expect(400);
    expect(corpsVide.body.code).toBe("DONNEES_INVALIDES");
    await agentResponsable.patch(adresse).send({ statut: "INCONNU" }).expect(400);
    await agentResponsable
      .patch(adresse)
      .send({ statut: "EN_COURS", commentaire: "x".repeat(2001) })
      .expect(400);
    await agentResponsable.patch("/api/v1/avis/pas-un-uuid/statut").send({ statut: "EN_COURS" }).expect(400);

    expect(await lireStatut(avisId)).toBe("NOUVEAU");
    expect(await lireSuivis(avisId)).toHaveLength(0);
  });

  it("prend toujours l'auteur dans la session, jamais dans le corps de la requete", async () => {
    const avisId = await creerAvis("A");

    await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "EN_COURS", utilisateur_id: gestionnaireAId, organisation_id: gestionnaireAId })
      .expect(200);

    const suivis = await lireSuivis(avisId);
    expect(suivis).toHaveLength(1);
    expect(suivis[0]?.utilisateur_id).toBe(responsableId);
    expect(suivis[0]?.organisation_id).toBe(organisationId);
  });

  it("deux changements identiques envoyes en meme temps : un seul passe, une seule ligne d'historique", async () => {
    const avisId = await creerAvis("A");
    const adresse = "/api/v1/avis/" + avisId + "/statut";

    const [premiere, deuxieme] = await Promise.all([
      agentResponsable.patch(adresse).send({ statut: "EN_COURS" }),
      agentResponsable.patch(adresse).send({ statut: "EN_COURS" }),
    ]);

    const statuts = [premiere.status, deuxieme.status].sort();
    expect(statuts).toEqual([200, 409]);
    const refusee = premiere.status === 409 ? premiere : deuxieme;
    expect(["STATUT_INCHANGE", "CONFLIT_STATUT"]).toContain(refusee.body.code);

    expect(await lireStatut(avisId)).toBe("EN_COURS");
    expect(await lireSuivis(avisId)).toHaveLength(1);
  });
});

describe("notes internes", () => {
  it("enregistre une note avec son auteur sans changer le statut", async () => {
    const avisId = await creerAvis("A");

    const reponse = await agentResponsable
      .post("/api/v1/avis/" + avisId + "/notes")
      .send({ commentaire: "Appeler le client demain" })
      .expect(201);

    expect(reponse.body.suivi.type).toBe("NOTE");
    expect(reponse.body.suivi.commentaire).toBe("Appeler le client demain");
    expect(reponse.body.suivi.ancien_statut).toBeNull();
    expect(reponse.body.suivi.nouveau_statut).toBeNull();
    expect(reponse.body.suivi.utilisateur.nom).toBe("Responsable Suivi");
    expect(JSON.stringify(reponse.body)).not.toContain("organisation_id");

    expect(await lireStatut(avisId)).toBe("NOUVEAU");
    const suivis = await lireSuivis(avisId);
    expect(suivis).toHaveLength(1);
    expect(suivis[0]?.utilisateur_id).toBe(responsableId);
  });

  it("refuse une note vide ou absente (400)", async () => {
    const avisId = await creerAvis("A");
    const adresse = "/api/v1/avis/" + avisId + "/notes";

    await agentResponsable.post(adresse).send({ commentaire: "   " }).expect(400);
    await agentResponsable.post(adresse).send({}).expect(400);
    await agentResponsable.post(adresse).send({ commentaire: "x".repeat(2001) }).expect(400);

    expect(await lireSuivis(avisId)).toHaveLength(0);
  });

  it("montre le changement de statut et la note dans l'historique du detail, le plus recent d'abord", async () => {
    const avisId = await creerAvis("A");
    await agentResponsable
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "EN_COURS", commentaire: "Pris en charge" })
      .expect(200);
    await agentResponsable
      .post("/api/v1/avis/" + avisId + "/notes")
      .send({ commentaire: "Client injoignable" })
      .expect(201);

    const detail = await agentResponsable.get("/api/v1/avis/" + avisId).expect(200);

    expect(detail.body.avis.statut_traitement).toBe("EN_COURS");
    const suivis = detail.body.avis.suivis as { type: string; commentaire: string | null }[];
    expect(suivis.map((s) => s.type)).toEqual(["NOTE", "CHANGEMENT_STATUT"]);
    expect(suivis[0]?.commentaire).toBe("Client injoignable");
    expect(suivis[1]?.commentaire).toBe("Pris en charge");
  });
});

describe("perimetre et avis introuvables", () => {
  it("laisse un gestionnaire traiter un avis de son site, avec son nom comme auteur", async () => {
    const avisId = await creerAvis("A");

    await agentGestionnaireA
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "TRAITE" })
      .expect(200);
    await agentGestionnaireA
      .post("/api/v1/avis/" + avisId + "/notes")
      .send({ commentaire: "Probleme regle sur place" })
      .expect(201);

    const suivis = await lireSuivis(avisId);
    expect(suivis).toHaveLength(2);
    expect(suivis.every((s) => s.utilisateur_id === gestionnaireAId)).toBe(true);
  });

  it("refuse (404) a un gestionnaire de traiter ou d'annoter un avis d'un autre site, sans rien ecrire", async () => {
    const avisId = await creerAvis("B");

    await agentGestionnaireA
      .patch("/api/v1/avis/" + avisId + "/statut")
      .send({ statut: "TRAITE" })
      .expect(404);
    await agentGestionnaireA
      .post("/api/v1/avis/" + avisId + "/notes")
      .send({ commentaire: "Je ne devrais pas pouvoir" })
      .expect(404);

    expect(await lireStatut(avisId)).toBe("NOUVEAU");
    expect(await lireSuivis(avisId)).toHaveLength(0);

    // Le responsable, lui, voit toute l'organisation.
    await agentResponsable.patch("/api/v1/avis/" + avisId + "/statut").send({ statut: "IGNORE" }).expect(200);
  });

  it("repond 404 pour un avis inconnu ou supprime", async () => {
    const supprime = await creerAvis("A", { supprime: true });
    const inconnu = "00000000-0000-4000-8000-000000000000";

    await agentResponsable.patch("/api/v1/avis/" + inconnu + "/statut").send({ statut: "TRAITE" }).expect(404);
    await agentResponsable.post("/api/v1/avis/" + inconnu + "/notes").send({ commentaire: "Note" }).expect(404);
    await agentResponsable.patch("/api/v1/avis/" + supprime + "/statut").send({ statut: "TRAITE" }).expect(404);
    await agentResponsable.post("/api/v1/avis/" + supprime + "/notes").send({ commentaire: "Note" }).expect(404);

    expect(await lireSuivis(supprime)).toHaveLength(0);
  });
});