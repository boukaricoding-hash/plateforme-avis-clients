import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/configuration/base-de-donnees";

// Test de l'API publique d'avis (jour 5) : cle unique, anti-doublon,
// anti-robot, consentement. Il cree sa propre organisation et la supprime a la fin.

const suffixe = randomBytes(4).toString("hex");
const NAVIGATEUR = "Test-Telephone";

let app: Express;
let organisationId: string;
let siteId: string;
let questionnaireId: string;
let versionId: string;
let idEtoiles: string;
let idNps: string;

type PointDeTest = { id: string; code: string };

async function creerPoint(nom: string): Promise<PointDeTest> {
  const code = randomBytes(9).toString("base64url");
  const point = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteId,
      questionnaire_id: questionnaireId,
      nom,
      code_public: code,
    },
    select: { id: true },
  });
  return { id: point.id, code };
}

function adresse(point: PointDeTest): string {
  return "/api/v1/public/q/" + point.code + "/avis";
}

function corpsAvis(options: { cle?: string; note?: number; autres?: Record<string, unknown> } = {}) {
  return {
    version_id: versionId,
    langue: "fr",
    ...(options.cle !== undefined ? { cle_unique: options.cle } : {}),
    reponses: [
      { question_id: idEtoiles, valeur: options.note ?? 4 },
      { question_id: idNps, valeur: 9 },
    ],
    ...(options.autres ?? {}),
  };
}

// Envoi sans cookie : chaque appel ressemble a un nouvel appareil.
function envoyerSansCookie(point: PointDeTest, corps: object) {
  return request(app).post(adresse(point)).set("User-Agent", NAVIGATEUR).send(corps);
}

async function compterAvis(point: PointDeTest): Promise<number> {
  return prisma.avis.count({ where: { point_contact_id: point.id } });
}

let pointLecture: PointDeTest;
let pointValide: PointDeTest;
let pointInvalide: PointDeTest;
let pointCle: PointDeTest;
let pointAppareil: PointDeTest;
let pointPeriode: PointDeTest;
let pointReseau: PointDeTest;
let pointPiege: PointDeTest;
let pointConsentement: PointDeTest;
let pointLimite: PointDeTest;

beforeAll(async () => {
  // Reglages de test, poses AVANT de charger l'application.
  process.env["SEL_EMPREINTE"] ??= "sel-de-test-" + suffixe + "-0123456789";
  process.env["ANTI_DOUBLON_SEUIL_RESEAU"] = "3";
  process.env["LIMITE_AVIS_PAR_MINUTE"] = "40";
  ({ app } = await import("../../src/app"));

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-AVIS-PUBLIC-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const site = await prisma.site.create({
    data: { organisation_id: organisationId, nom: "Site test avis public" },
  });
  siteId = site.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test" },
      statut: "ACTIF",
      versions: {
        create: {
          numero: 1,
          publie_le: new Date(),
          questions: {
            create: [
              { ordre: 1, type: "ETOILES", libelle: { fr: "Note ?" }, echelle_min: 1, echelle_max: 5 },
              { ordre: 2, type: "NPS", libelle: { fr: "Recommanderiez-vous ?" }, echelle_min: 0, echelle_max: 10 },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      versions: {
        select: {
          id: true,
          questions: { orderBy: { ordre: "asc" }, select: { id: true } },
        },
      },
    },
  });
  questionnaireId = questionnaire.id;

  const version = questionnaire.versions[0];
  const etoiles = version?.questions[0];
  const nps = version?.questions[1];
  if (!version || !etoiles || !nps) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionId = version.id;
  idEtoiles = etoiles.id;
  idNps = nps.id;

  // Un point de contact par groupe de tests : les comptages ne se melangent pas.
  pointLecture = await creerPoint("Table lecture");
  pointValide = await creerPoint("Table valide");
  pointInvalide = await creerPoint("Table invalide");
  pointCle = await creerPoint("Table cle");
  pointAppareil = await creerPoint("Table appareil");
  pointPeriode = await creerPoint("Table periode");
  pointReseau = await creerPoint("Table reseau");
  pointPiege = await creerPoint("Table piege");
  pointConsentement = await creerPoint("Table consentement");
  pointLimite = await creerPoint("Table limite");
}, 30000);

afterAll(async () => {
  if (organisationId !== undefined) {
    await prisma.reponse.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.avis.deleteMany({ where: { organisation_id: organisationId } });
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

describe("lecture du questionnaire public", () => {
  it("affiche le questionnaire d'un QR code valide (200)", async () => {
    const reponse = await request(app).get("/api/v1/public/q/" + pointLecture.code).expect(200);
    expect(reponse.body.point_contact.nom).toBe("Table lecture");
    expect(reponse.body.questionnaire.version_id).toBe(versionId);
    expect(reponse.body.questionnaire.questions).toHaveLength(2);
  });

  it("repond QR_INCONNU (404) pour un code inconnu", async () => {
    const reponse = await request(app).get("/api/v1/public/q/code-qui-nexiste-pas").expect(404);
    expect(reponse.body.code).toBe("QR_INCONNU");
  });
});

describe("envoi d'un avis", () => {
  it("enregistre un avis valide (201) avec une empreinte hachee, jamais l'IP en clair", async () => {
    const reponse = await envoyerSansCookie(pointValide, corpsAvis()).expect(201);
    const avis = await prisma.avis.findUniqueOrThrow({ where: { id: reponse.body.id } });

    expect(avis.note_globale).toBe(4);
    expect(avis.nps).toBe(9);
    expect(avis.version_id).toBe(versionId);
    expect(avis.empreinte).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{32}$/);
    expect(avis.empreinte).not.toContain("127.0.0.1");
    expect(avis.empreinte).not.toContain("::1");
  });

  it("pose le cookie de l'appareil (HttpOnly)", async () => {
    const reponse = await envoyerSansCookie(pointValide, corpsAvis()).expect(201);
    const cookies = String(reponse.headers["set-cookie"]);
    expect(cookies).toContain("appareil_avis=");
    expect(cookies).toContain("HttpOnly");
  });

  it("refuse une note hors limites (400) sans rien enregistrer", async () => {
    const reponse = await envoyerSansCookie(pointInvalide, corpsAvis({ note: 7 })).expect(400);
    expect(reponse.body.code).toBe("AVIS_INVALIDE");
    expect(await compterAvis(pointInvalide)).toBe(0);
  });

  it("refuse un avis auquel il manque une question obligatoire (400)", async () => {
    const corps = {
      version_id: versionId,
      langue: "fr",
      reponses: [{ question_id: idEtoiles, valeur: 4 }],
    };
    const reponse = await envoyerSansCookie(pointInvalide, corps).expect(400);
    expect(reponse.body.code).toBe("AVIS_INVALIDE");
    expect(await compterAvis(pointInvalide)).toBe(0);
  });
});

describe("cle unique (coupure du reseau)", () => {
  it("le meme envoi repete avec la meme cle ne cree qu'un avis (201 puis 200)", async () => {
    const agent = request.agent(app);
    const cle = randomUUID();

    const premier = await agent.post(adresse(pointCle)).send(corpsAvis({ cle })).expect(201);
    const second = await agent.post(adresse(pointCle)).send(corpsAvis({ cle })).expect(200);

    expect(second.body.id).toBe(premier.body.id);
    expect(await compterAvis(pointCle)).toBe(1);
  });

  it("deux envois simultanes avec la meme cle ne creent qu'un avis", async () => {
    const cle = randomUUID();
    const [a, b] = await Promise.all([
      envoyerSansCookie(pointCle, corpsAvis({ cle })),
      envoyerSansCookie(pointCle, corpsAvis({ cle })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    // 1 avis du test precedent + 1 de celui-ci.
    expect(await compterAvis(pointCle)).toBe(2);
  });
});

describe("anti-doublon", () => {
  it("refuse poliment un deuxieme avis du meme appareil (409)", async () => {
    const agent = request.agent(app);

    await agent.post(adresse(pointAppareil)).send(corpsAvis({ cle: randomUUID() })).expect(201);
    const refus = await agent
      .post(adresse(pointAppareil))
      .send(corpsAvis({ cle: randomUUID() }))
      .expect(409);

    expect(refus.body.code).toBe("AVIS_DEJA_DONNE");
    expect(await compterAvis(pointAppareil)).toBe(1);
  });

  it("accepte de nouveau le meme appareil une fois la periode passee", async () => {
    const agent = request.agent(app);

    await agent.post(adresse(pointPeriode)).send(corpsAvis({ cle: randomUUID() })).expect(201);

    // On vieillit l'avis de 7 heures : la periode de 6 heures est terminee.
    await prisma.avis.updateMany({
      where: { point_contact_id: pointPeriode.id },
      data: { soumis_le: new Date(Date.now() - 7 * 60 * 60 * 1000) },
    });

    await agent.post(adresse(pointPeriode)).send(corpsAvis({ cle: randomUUID() })).expect(201);
    expect(await compterAvis(pointPeriode)).toBe(2);
  });

  it("limite douce : plusieurs clients sur le meme reseau passent, puis refus au seuil (3)", async () => {
    // Aucun cookie : trois appareils differents derriere la meme IP et le meme navigateur.
    await envoyerSansCookie(pointReseau, corpsAvis({ cle: randomUUID() })).expect(201);
    await envoyerSansCookie(pointReseau, corpsAvis({ cle: randomUUID() })).expect(201);
    await envoyerSansCookie(pointReseau, corpsAvis({ cle: randomUUID() })).expect(201);

    const refus = await envoyerSansCookie(pointReseau, corpsAvis({ cle: randomUUID() })).expect(409);
    expect(refus.body.code).toBe("AVIS_DEJA_DONNE");
    expect(await compterAvis(pointReseau)).toBe(3);
  });
});

describe("anti-robot : champ piege", () => {
  it("refuse un avis dont le champ piege est rempli (400) et l'accepte s'il est vide", async () => {
    const robot = await envoyerSansCookie(
      pointPiege,
      corpsAvis({ autres: { site_web: "coucou" } }),
    ).expect(400);
    expect(robot.body.code).toBe("AVIS_INVALIDE");
    expect(await compterAvis(pointPiege)).toBe(0);

    await envoyerSansCookie(pointPiege, corpsAvis({ autres: { site_web: "" } })).expect(201);
    expect(await compterAvis(pointPiege)).toBe(1);
  });
});

describe("coordonnees et consentement", () => {
  it("n'enregistre aucune coordonnee si la case n'est pas cochee", async () => {
    const reponse = await envoyerSansCookie(
      pointConsentement,
      corpsAvis({
        autres: {
          contact_nom: "Kossi",
          contact_tel: "+22890000000",
          contact_email: "kossi@exemple.tg",
          consentement: false,
        },
      }),
    ).expect(201);

    const avis = await prisma.avis.findUniqueOrThrow({ where: { id: reponse.body.id } });
    expect(avis.consentement).toBe(false);
    expect(avis.contact_nom).toBeNull();
    expect(avis.contact_tel).toBeNull();
    expect(avis.contact_email).toBeNull();
  });

  it("enregistre les coordonnees si la case est cochee", async () => {
    const reponse = await envoyerSansCookie(
      pointConsentement,
      corpsAvis({
        autres: {
          contact_nom: "Ama",
          contact_tel: "+22891111111",
          contact_email: "ama@exemple.tg",
          consentement: true,
        },
      }),
    ).expect(201);

    const avis = await prisma.avis.findUniqueOrThrow({ where: { id: reponse.body.id } });
    expect(avis.consentement).toBe(true);
    expect(avis.contact_nom).toBe("Ama");
    expect(avis.contact_tel).toBe("+22891111111");
    expect(avis.contact_email).toBe("ama@exemple.tg");
  });
});

// Ce groupe DOIT rester le dernier : une fois la limite atteinte,
// l'adresse IP est bloquee pendant une minute pour les envois d'avis.
describe("anti-robot : limite par minute", () => {
  it("repond 429 quand trop d'envois arrivent en une minute", async () => {
    let premier429 = 0;

    for (let essai = 1; essai <= 80; essai++) {
      const reponse = await request(app).post(adresse(pointLimite)).send({});
      if (reponse.status === 429) {
        expect(reponse.body.code).toBe("TROP_DE_REQUETES");
        premier429 = essai;
        break;
      }
      expect(reponse.status).toBe(400);
    }

    expect(premier429).toBeGreaterThan(0);
  }, 30000);
});