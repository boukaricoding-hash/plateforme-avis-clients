import "dotenv/config";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import type { Express } from "express";
import { prisma } from "../../src/configuration/base-de-donnees";
import {
  debutDuJourUtc,
  recalculerAgregat,
} from "../../src/modules/agregats/services/calcul-agregats";

// Test des chiffres du tableau de bord (jour 7) : l'API doit donner exactement
// les memes valeurs qu'un calcul fait a la main sur 10 avis.
//
// Les valeurs attendues ci-dessous sont calculees A LA MAIN (formules de l'annexe B),
// pas par le code teste. Periode du test : du 1er au 10 septembre 2026 (10 jours).
// La periode precedente (meme duree) va du 22 au 31 aout 2026.
//
// Les 10 avis de la periode (note globale = moyenne des deux questions notees) :
//
//   n  table  site  jour    accueil rapidite  note   NPS
//   1  T1     A     01/09   5       5         5      10
//   2  T1     A     02/09   4       4         4       9
//   3  T1     A     02/09   3       5         4       8
//   4  T2     A     03/09   2       2         2       3
//   5  T2     A     05/09   1       3         2       6
//   6  T2     A     05/09   4       5         4,5     9
//   7  T3     B     06/09   5       4         4,5    10
//   8  T3     B     08/09   3       3         3       7
//   9  T3     B     09/09   2       4         3       5
//  10  T3     B     10/09   5       5         5       9
//
// Totaux : somme des notes 37 -> moyenne 3,7 ; 6 avis a 4 ou plus -> CSAT 60 % ;
// NPS : 5 promoteurs (9-10), 2 passifs, 3 detracteurs (0-6) -> (5 - 3) / 10 = 20.
// Scans de la periode : 16 -> taux de reponse 10 / 16 = 62,5 %.
//
// Pieges ajoutes : un avis supprime (4/09), un avis hors periode (15/10),
// et 2 avis dans la periode precedente (pour l'evolution).

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Dashboard-Calculs-2026";
const NAVIGATEUR = "Test-Telephone";

const PERIODE = "from=2026-09-01&to=2026-09-10";

type Statut = "NOUVEAU" | "EN_COURS" | "TRAITE" | "IGNORE";
type Point = { id: string; siteId: string; nom: string; code: string };
type Agent = ReturnType<typeof request.agent>;

let app: Express;
let organisationId: string;
let questionnaireId: string;
let versionId: string;
let idAccueil: string;
let idRapidite: string;
let idNps: string;
let themeAccueilId: string;
let themeRapiditeId: string;

let siteAId: string;
let siteBId: string;
let t1: Point;
let t2: Point;
let t3: Point;
let t4: Point;

let responsable: Agent;
let gestionnaireA: Agent;

const utilisateurIds: string[] = [];
const avisIds: Record<string, string> = {};
const instantsAgregats = new Map<string, { pointId: string; jour: Date }>();

const HEURES = 60 * 60 * 1000;

function noterAgregat(pointId: string, date: Date): void {
  const jour = debutDuJourUtc(date);
  instantsAgregats.set(pointId + "|" + jour.toISOString(), { pointId, jour });
}

async function creerPoint(nom: string, siteId: string): Promise<Point> {
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
  return { id: point.id, siteId, nom, code };
}

async function creerAvis(options: {
  cle: string;
  point: Point;
  jour: string;
  accueil: number;
  rapidite: number;
  nps: number;
  statut?: Statut;
  supprime?: boolean;
}): Promise<void> {
  const soumisLe = new Date(options.jour + "T12:00:00.000Z");
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisationId,
      site_id: options.point.siteId,
      point_contact_id: options.point.id,
      version_id: versionId,
      soumis_le: soumisLe,
      langue: "fr",
      note_globale: (options.accueil + options.rapidite) / 2,
      nps: options.nps,
      statut_traitement: options.statut ?? "NOUVEAU",
      supprime_le: options.supprime === true ? new Date() : null,
      reponses: {
        create: [
          { organisation_id: organisationId, question_id: idAccueil, valeur_numerique: options.accueil },
          { organisation_id: organisationId, question_id: idRapidite, valeur_numerique: options.rapidite },
          { organisation_id: organisationId, question_id: idNps, valeur_numerique: options.nps },
        ],
      },
    },
    select: { id: true },
  });
  avisIds[options.cle] = avis.id;
  noterAgregat(options.point.id, soumisLe);
}

async function creerScans(point: Point, jour: string, nombre: number): Promise<void> {
  const cree = new Date(jour + "T10:00:00.000Z");
  await prisma.scan.createMany({
    data: Array.from({ length: nombre }, () => ({
      organisation_id: organisationId,
      point_contact_id: point.id,
      cree_le: cree,
    })),
  });
  noterAgregat(point.id, cree);
}

async function creerAlerte(
  cle: string,
  motifs: Array<"NOTE_BASSE" | "NPS_BAS">,
  heuresAvant: number,
): Promise<void> {
  const avisId = avisIds[cle];
  if (avisId === undefined) {
    throw new Error("Avis inconnu : " + cle);
  }
  await prisma.alerte.create({
    data: {
      organisation_id: organisationId,
      avis_id: avisId,
      motifs,
      cree_le: new Date(Date.now() - heuresAvant * HEURES),
    },
  });
}

async function creerUtilisateur(
  nom: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  siteId?: string,
): Promise<{ email: string }> {
  const email = nom.toLowerCase() + "-" + suffixe + "@test-dashboard-calculs.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom,
      role,
      organisation_id: organisationId,
      ...(siteId !== undefined ? { utilisateurs_sites: { create: { site_id: siteId } } } : {}),
    },
    select: { id: true },
  });
  utilisateurIds.push(utilisateur.id);
  return { email };
}

async function seConnecter(email: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false }).expect(200);
  return agent;
}

beforeAll(async () => {
  // Reglages de test, poses AVANT de charger l'application.
  process.env["SEL_EMPREINTE"] ??= "sel-de-test-" + suffixe + "-0123456789";
  process.env["ANTI_DOUBLON_SEUIL_RESEAU"] = "1000";
  process.env["LIMITE_AVIS_PAR_MINUTE"] = "1000";
  ({ app } = await import("../../src/app"));

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const themeAccueil = await prisma.theme.findUniqueOrThrow({
    where: { secteur_id_code: { secteur_id: secteur.id, code: "accueil" } },
  });
  const themeRapidite = await prisma.theme.findUniqueOrThrow({
    where: { secteur_id_code: { secteur_id: secteur.id, code: "rapidite" } },
  });
  themeAccueilId = themeAccueil.id;
  themeRapiditeId = themeRapidite.id;

  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-DASHBOARD-CALCULS-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const siteA = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site A" } });
  const siteB = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site B" } });
  siteAId = siteA.id;
  siteBId = siteB.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test chiffres" },
      statut: "ACTIF",
      versions: {
        create: {
          numero: 1,
          publie_le: new Date(),
          questions: {
            create: [
              {
                ordre: 1,
                type: "ETOILES",
                libelle: { fr: "Accueil ?" },
                theme_id: themeAccueil.id,
                echelle_min: 1,
                echelle_max: 5,
              },
              {
                ordre: 2,
                type: "ETOILES",
                libelle: { fr: "Rapidite ?" },
                theme_id: themeRapidite.id,
                echelle_min: 1,
                echelle_max: 5,
              },
              { ordre: 3, type: "NPS", libelle: { fr: "Recommanderiez-vous ?" }, echelle_min: 0, echelle_max: 10 },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      versions: {
        select: { id: true, questions: { orderBy: { ordre: "asc" }, select: { id: true } } },
      },
    },
  });
  questionnaireId = questionnaire.id;
  const version = questionnaire.versions[0];
  const q1 = version?.questions[0];
  const q2 = version?.questions[1];
  const q3 = version?.questions[2];
  if (!version || !q1 || !q2 || !q3) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionId = version.id;
  idAccueil = q1.id;
  idRapidite = q2.id;
  idNps = q3.id;

  t1 = await creerPoint("Table 1", siteAId);
  t2 = await creerPoint("Table 2", siteAId);
  t3 = await creerPoint("Table 3", siteBId);
  t4 = await creerPoint("Table 4", siteAId);

  // Les 10 avis de la periode (voir le tableau en haut du fichier).
  await creerAvis({ cle: "1", point: t1, jour: "2026-09-01", accueil: 5, rapidite: 5, nps: 10 });
  await creerAvis({ cle: "2", point: t1, jour: "2026-09-02", accueil: 4, rapidite: 4, nps: 9 });
  await creerAvis({ cle: "3", point: t1, jour: "2026-09-02", accueil: 3, rapidite: 5, nps: 8 });
  await creerAvis({ cle: "4", point: t2, jour: "2026-09-03", accueil: 2, rapidite: 2, nps: 3, statut: "EN_COURS" });
  await creerAvis({ cle: "5", point: t2, jour: "2026-09-05", accueil: 1, rapidite: 3, nps: 6, statut: "TRAITE" });
  await creerAvis({ cle: "6", point: t2, jour: "2026-09-05", accueil: 4, rapidite: 5, nps: 9 });
  await creerAvis({ cle: "7", point: t3, jour: "2026-09-06", accueil: 5, rapidite: 4, nps: 10 });
  await creerAvis({ cle: "8", point: t3, jour: "2026-09-08", accueil: 3, rapidite: 3, nps: 7 });
  await creerAvis({ cle: "9", point: t3, jour: "2026-09-09", accueil: 2, rapidite: 4, nps: 5 });
  await creerAvis({ cle: "10", point: t3, jour: "2026-09-10", accueil: 5, rapidite: 5, nps: 9 });

  // Les pieges : un avis supprime dans la periode, un avis apres la periode.
  await creerAvis({ cle: "supprime", point: t1, jour: "2026-09-04", accueil: 1, rapidite: 1, nps: 0, supprime: true });
  await creerAvis({ cle: "octobre", point: t3, jour: "2026-10-15", accueil: 1, rapidite: 1, nps: 0 });

  // La periode precedente (22 a 31 aout) : 2 avis, pour l'evolution.
  await creerAvis({ cle: "prec1", point: t1, jour: "2026-08-25", accueil: 3, rapidite: 3, nps: 7 });
  await creerAvis({ cle: "prec2", point: t1, jour: "2026-08-28", accueil: 4, rapidite: 4, nps: 9 });

  // Scans : 16 dans la periode (T1 : 6, T2 : 5, T3 : 5), 2 dans la periode precedente.
  await creerScans(t1, "2026-09-01", 4);
  await creerScans(t1, "2026-09-04", 2);
  await creerScans(t2, "2026-09-03", 3);
  await creerScans(t2, "2026-09-07", 2);
  await creerScans(t3, "2026-09-06", 3);
  await creerScans(t3, "2026-09-09", 2);
  await creerScans(t1, "2026-08-25", 1);
  await creerScans(t1, "2026-08-28", 1);

  // Alertes : ouvertes tant que l'avis est Nouveau ou En cours.
  await creerAlerte("4", ["NOTE_BASSE", "NPS_BAS"], 50); // ouverte (En cours), la plus ancienne
  await creerAlerte("5", ["NOTE_BASSE"], 30); // fermee (Traite)
  await creerAlerte("9", ["NPS_BAS"], 2); // ouverte (Nouveau)
  await creerAlerte("octobre", ["NOTE_BASSE", "NPS_BAS"], 1); // ouverte, hors periode
  await creerAlerte("supprime", ["NOTE_BASSE"], 100); // avis supprime : ne compte jamais

  // Les agregats, comme le fait la tache de nuit (un par point de contact et par jour).
  for (const { pointId, jour } of instantsAgregats.values()) {
    await recalculerAgregat(pointId, jour);
  }

  const responsableCompte = await creerUtilisateur("Responsable", "RESPONSABLE");
  const gestionnaireCompte = await creerUtilisateur("Gestionnaire-A", "GESTIONNAIRE", siteAId);
  responsable = await seConnecter(responsableCompte.email);
  gestionnaireA = await seConnecter(gestionnaireCompte.email);
}, 60000);

afterAll(async () => {
  if (organisationId !== undefined) {
    await prisma.notification.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.alerte.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.reponse.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.avis.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.scan.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.agregatQuotidien.deleteMany({ where: { organisation_id: organisationId } });
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

// ------------------------------------------------------------
// Chiffres cles
// ------------------------------------------------------------

describe("kpis : calcul a la main sur 10 avis", () => {
  it("donne la note moyenne, le CSAT, le NPS, les scans et le taux de reponse attendus", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE).expect(200);

    expect(reponse.body.periode).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      nombre_jours: 10,
      precedente: { from: "2026-08-22", to: "2026-08-31" },
    });

    const i = reponse.body.indicateurs;
    expect(i.nb_avis).toBe(10); // ni l'avis supprime, ni celui d'octobre
    expect(i.note_moyenne).toBe(3.7); // 37 / 10
    expect(i.csat).toBe(60); // 6 avis a 4 ou plus sur 10
    expect(i.nps).toBe(20); // (5 promoteurs - 3 detracteurs) / 10
    expect(i.nb_promoteurs).toBe(5);
    expect(i.nb_passifs).toBe(2);
    expect(i.nb_detracteurs).toBe(3);
    expect(i.nb_reponses_nps).toBe(10);
    expect(i.nb_scans).toBe(16);
    expect(i.taux_reponse).toBe(62.5); // 10 / 16
    // Une note de 4,5 est rangee dans la case 5 (arrondi), comme dans l'agregat.
    expect(i.repartition_notes).toEqual([
      { note: 1, nombre: 0 },
      { note: 2, nombre: 2 },
      { note: 3, nombre: 2 },
      { note: 4, nombre: 2 },
      { note: 5, nombre: 4 },
    ]);
  });

  it("calcule l'evolution par rapport a la periode precedente (2 avis, 2 scans)", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE).expect(200);
    const e = reponse.body.evolution;

    // Periode precedente : note moyenne 3,5 ; CSAT 50 ; NPS 50 ; taux de reponse 2 / 2 = 100.
    expect(e.nb_avis).toEqual({ precedent: 2, difference: 8, pourcentage: 400 });
    expect(e.note_moyenne).toEqual({ precedent: 3.5, difference: 0.2, pourcentage: 5.7 });
    expect(e.csat).toEqual({ precedent: 50, difference: 10, pourcentage: 20 });
    expect(e.nps).toEqual({ precedent: 50, difference: -30, pourcentage: -60 });
    expect(e.taux_reponse).toEqual({ precedent: 100, difference: -37.5, pourcentage: -37.5 });
  });

  it("compte les alertes ouvertes (Nouveau ou En cours) avec leur anciennete, hors periode comprise", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE).expect(200);
    const alertes = reponse.body.alertes_ouvertes;

    // Ouvertes : avis 4 (En cours), avis 9 (Nouveau), avis d'octobre. Pas l'avis 5 (Traite),
    // pas l'avis supprime.
    expect(alertes.nombre).toBe(3);
    expect(alertes.plus_anciennes.map((a: { avis_id: string }) => a.avis_id)).toEqual([
      avisIds["4"],
      avisIds["9"],
      avisIds["octobre"],
    ]);
    expect(alertes.plus_anciennes[0].motifs).toEqual(["NOTE_BASSE", "NPS_BAS"]);
    expect(alertes.anciennete_max_heures).toBeGreaterThanOrEqual(50);
    expect(alertes.anciennete_max_heures).toBeLessThan(50.5);
    expect(alertes.plus_anciennes[1].anciennete_heures).toBeGreaterThanOrEqual(2);
    expect(alertes.plus_anciennes[1].anciennete_heures).toBeLessThan(2.5);
    expect(typeof alertes.plus_ancienne_le).toBe("string");
  });

  it("changer la periode change les resultats", async () => {
    const debut = await responsable.get("/api/v1/dashboard/kpis?from=2026-09-01&to=2026-09-05").expect(200);
    expect(debut.body.indicateurs.nb_avis).toBe(6); // avis 1 a 6
    expect(debut.body.indicateurs.note_moyenne).toBe(3.58); // 21,5 / 6

    const fin = await responsable.get("/api/v1/dashboard/kpis?from=2026-09-06&to=2026-09-10").expect(200);
    expect(fin.body.indicateurs.nb_avis).toBe(4); // avis 7 a 10
    expect(fin.body.indicateurs.note_moyenne).toBe(3.88); // 15,5 / 4

    const vide = await responsable.get("/api/v1/dashboard/kpis?from=2026-07-01&to=2026-07-10").expect(200);
    expect(vide.body.indicateurs.nb_avis).toBe(0);
    expect(vide.body.indicateurs.note_moyenne).toBeNull(); // pas de 0 invente
    expect(vide.body.indicateurs.csat).toBeNull();
    expect(vide.body.indicateurs.nps).toBeNull();
    expect(vide.body.indicateurs.taux_reponse).toBeNull();
  });

  it("le filtre questionnaire (calcul direct depuis les avis) donne les memes chiffres que les agregats", async () => {
    const sans = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE).expect(200);
    const avec = await responsable
      .get("/api/v1/dashboard/kpis?" + PERIODE + "&questionnaire=" + questionnaireId)
      .expect(200);

    expect(avec.body.indicateurs).toEqual(sans.body.indicateurs);
    expect(avec.body.evolution).toEqual(sans.body.evolution);
    expect(avec.body.alertes_ouvertes.nombre).toBe(3);
  });

  it("le filtre site isole les chiffres du site A (6 avis, 11 scans)", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE + "&site=" + siteAId).expect(200);
    const i = reponse.body.indicateurs;

    expect(i.nb_avis).toBe(6);
    expect(i.note_moyenne).toBe(3.58); // 21,5 / 6
    expect(i.csat).toBe(66.7); // 4 sur 6
    expect(i.nps).toBe(16.7); // (3 promoteurs - 2 detracteurs) / 6
    expect(i.nb_scans).toBe(11);
    expect(i.taux_reponse).toBe(54.5); // 6 / 11
    expect(reponse.body.alertes_ouvertes.nombre).toBe(1); // avis 4 seulement
  });

  it("le filtre point isole une table (Table 2 : 3 avis, note 2,83)", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/kpis?" + PERIODE + "&point=" + t2.id).expect(200);

    expect(reponse.body.indicateurs.nb_avis).toBe(3);
    expect(reponse.body.indicateurs.note_moyenne).toBe(2.83); // 8,5 / 3
    expect(reponse.body.indicateurs.nb_scans).toBe(5);
  });
});

describe("kpis : perimetre du gestionnaire", () => {
  it("le gestionnaire du site A voit les memes chiffres que le filtre site A, rien du site B", async () => {
    const parResponsable = await responsable
      .get("/api/v1/dashboard/kpis?" + PERIODE + "&site=" + siteAId)
      .expect(200);
    const parGestionnaire = await gestionnaireA.get("/api/v1/dashboard/kpis?" + PERIODE).expect(200);

    expect(parGestionnaire.body.indicateurs).toEqual(parResponsable.body.indicateurs);
    expect(parGestionnaire.body.indicateurs.nb_avis).toBe(6);
    expect(parGestionnaire.body.alertes_ouvertes.nombre).toBe(1);
  });

  it("le gestionnaire qui demande le site B (hors perimetre) obtient des zeros, pas une erreur", async () => {
    const reponse = await gestionnaireA.get("/api/v1/dashboard/kpis?" + PERIODE + "&site=" + siteBId).expect(200);

    expect(reponse.body.indicateurs.nb_avis).toBe(0);
    expect(reponse.body.indicateurs.note_moyenne).toBeNull();
    expect(reponse.body.indicateurs.nb_scans).toBe(0);
    expect(reponse.body.alertes_ouvertes.nombre).toBe(0);
  });

  it("le gestionnaire ne voit que ses tables dans le classement et ses avis dans les derniers avis", async () => {
    const classement = await gestionnaireA.get("/api/v1/dashboard/ranking?" + PERIODE).expect(200);
    const noms = classement.body.points_contact.map((p: { nom: string }) => p.nom);
    expect(noms).toEqual(["Table 1", "Table 2"]);

    const derniers = await gestionnaireA.get("/api/v1/dashboard/derniers-avis?" + PERIODE).expect(200);
    const ids = derniers.body.avis.map((a: { id: string }) => a.id);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain(avisIds["7"]);
    expect(ids).not.toContain(avisIds["10"]);
  });
});

// ------------------------------------------------------------
// Graphiques
// ------------------------------------------------------------

describe("themes", () => {
  it("donne le score de chaque theme, le point faible en premier", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/themes?" + PERIODE).expect(200);
    const themes = reponse.body.themes as Array<{ code: string; score: number; nb_reponses: number }>;

    // Accueil : 34 / 10 = 3,4 ; rapidite : 40 / 10 = 4.
    expect(themes.map((t) => t.code)).toEqual(["accueil", "rapidite"]);
    expect(themes[0]?.score).toBe(3.4);
    expect(themes[0]?.nb_reponses).toBe(10);
    expect(themes[1]?.score).toBe(4);
    expect(themes[1]?.nb_reponses).toBe(10);
  });

  it("le calcul direct (filtre questionnaire) donne les memes scores", async () => {
    const sans = await responsable.get("/api/v1/dashboard/themes?" + PERIODE).expect(200);
    const avec = await responsable
      .get("/api/v1/dashboard/themes?" + PERIODE + "&questionnaire=" + questionnaireId)
      .expect(200);

    expect(avec.body.themes).toEqual(sans.body.themes);
  });
});

describe("timeseries", () => {
  it("donne un point par jour, les jours sans avis ont des valeurs a null", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/timeseries?" + PERIODE).expect(200);
    const points = reponse.body.points as Array<{
      date: string;
      nb_avis: number;
      note_moyenne: number | null;
      nps: number | null;
    }>;

    expect(points).toHaveLength(10);
    expect(points.map((p) => p.date)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
    // Avis par jour. Le 4 : 0 (l'avis supprime ne compte pas). Le 7 : 0 (scans seulement).
    expect(points.map((p) => p.nb_avis)).toEqual([1, 2, 1, 0, 2, 1, 0, 1, 1, 1]);
    expect(points[0]).toMatchObject({ note_moyenne: 5, nps: 100 });
    expect(points[1]).toMatchObject({ note_moyenne: 4, nps: 50 }); // notes 4 et 4 ; NPS 9 et 8
    expect(points[2]).toMatchObject({ note_moyenne: 2, nps: -100 }); // un detracteur
    expect(points[3]).toMatchObject({ note_moyenne: null, nps: null });
    expect(points[4]).toMatchObject({ note_moyenne: 3.25, nps: 0 }); // notes 2 et 4,5 ; NPS 6 et 9
    expect(points[6]).toMatchObject({ note_moyenne: null, nps: null });
  });

  it("le calcul direct (filtre questionnaire) donne la meme courbe", async () => {
    const sans = await responsable.get("/api/v1/dashboard/timeseries?" + PERIODE).expect(200);
    const avec = await responsable
      .get("/api/v1/dashboard/timeseries?" + PERIODE + "&questionnaire=" + questionnaireId)
      .expect(200);

    expect(avec.body.points).toEqual(sans.body.points);
  });
});

describe("ranking", () => {
  it("classe les tables de la meilleure note a la plus faible, sans table sans avis", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/ranking?" + PERIODE).expect(200);
    const lignes = reponse.body.points_contact as Array<{
      nom: string;
      site_nom: string;
      nb_avis: number;
      note_moyenne: number;
      csat: number;
      nps: number;
    }>;

    // La table 4 n'a aucun avis dans la periode : elle n'apparait pas.
    expect(lignes.map((l) => l.nom)).toEqual(["Table 1", "Table 3", "Table 2"]);
    expect(lignes[0]).toMatchObject({ site_nom: "Site A", nb_avis: 3, note_moyenne: 4.33, csat: 100, nps: 66.7 });
    expect(lignes[1]).toMatchObject({ site_nom: "Site B", nb_avis: 4, note_moyenne: 3.88, csat: 50, nps: 25 });
    expect(lignes[2]).toMatchObject({ site_nom: "Site A", nb_avis: 3, note_moyenne: 2.83, csat: 33.3, nps: -33.3 });
  });

  it("le calcul direct (filtre questionnaire) donne le meme classement", async () => {
    const sans = await responsable.get("/api/v1/dashboard/ranking?" + PERIODE).expect(200);
    const avec = await responsable
      .get("/api/v1/dashboard/ranking?" + PERIODE + "&questionnaire=" + questionnaireId)
      .expect(200);

    expect(avec.body.points_contact).toEqual(sans.body.points_contact);
  });
});

describe("questions", () => {
  it("donne le detail et la repartition de chaque question, dans l'ordre du questionnaire", async () => {
    const reponse = await responsable.get("/api/v1/dashboard/questions?" + PERIODE).expect(200);
    const questions = reponse.body.questions as Array<{
      type: string;
      libelle: { fr: string };
      nb_reponses: number;
      moyenne: number | null;
      nps: number | null;
      repartition: Array<{ valeur: number | string; nombre: number }>;
    }>;

    expect(questions).toHaveLength(3);

    expect(questions[0]).toMatchObject({ type: "ETOILES", nb_reponses: 10, moyenne: 3.4, nps: null });
    expect(questions[0]?.libelle.fr).toBe("Accueil ?");
    expect(questions[0]?.repartition).toEqual([
      { valeur: 1, nombre: 1 },
      { valeur: 2, nombre: 2 },
      { valeur: 3, nombre: 2 },
      { valeur: 4, nombre: 2 },
      { valeur: 5, nombre: 3 },
    ]);

    expect(questions[1]).toMatchObject({ type: "ETOILES", nb_reponses: 10, moyenne: 4 });
    expect(questions[1]?.repartition).toEqual([
      { valeur: 2, nombre: 1 },
      { valeur: 3, nombre: 2 },
      { valeur: 4, nombre: 3 },
      { valeur: 5, nombre: 4 },
    ]);

    // NPS : somme 76 / 10 = 7,6 ; (5 promoteurs - 3 detracteurs) / 10 = 20.
    expect(questions[2]).toMatchObject({ type: "NPS", nb_reponses: 10, moyenne: 7.6, nps: 20 });
    expect(questions[2]?.repartition).toEqual([
      { valeur: 3, nombre: 1 },
      { valeur: 5, nombre: 1 },
      { valeur: 6, nombre: 1 },
      { valeur: 7, nombre: 1 },
      { valeur: 8, nombre: 1 },
      { valeur: 9, nombre: 3 },
      { valeur: 10, nombre: 2 },
    ]);
  });
});

describe("derniers avis", () => {
  it("renvoie les 10 plus recents de la periode, du plus recent au plus ancien, sans avis supprime", async () => {
    // Du 1er septembre au 20 octobre : 11 avis (les 10 + celui d'octobre) ; le plus ancien est ecarte.
    const reponse = await responsable
      .get("/api/v1/dashboard/derniers-avis?from=2026-09-01&to=2026-10-20")
      .expect(200);
    const ids = reponse.body.avis.map((a: { id: string }) => a.id);

    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe(avisIds["octobre"]);
    expect(ids[1]).toBe(avisIds["10"]);
    expect(ids).not.toContain(avisIds["1"]);
    expect(ids).not.toContain(avisIds["supprime"]);
  });
});

describe("filtres invalides", () => {
  it("refuse une periode incomplete, a l'envers, trop longue, ou un identifiant mal forme (400)", async () => {
    for (const filtre of [
      "from=2026-09-01",
      "to=2026-09-10",
      "from=2026-09-10&to=2026-09-01",
      "from=2025-01-01&to=2026-09-01",
      "from=01/09/2026&to=10/09/2026",
      "site=pas-un-identifiant",
    ]) {
      const reponse = await responsable.get("/api/v1/dashboard/kpis?" + filtre).expect(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
    }
  });
});

// ------------------------------------------------------------
// Agregats : mis a jour a chaque nouvel avis
// ------------------------------------------------------------
// Ces tests doivent rester les derniers : ils ajoutent des avis "d'aujourd'hui".

describe("agregats mis a jour a chaque nouvel avis", () => {
  async function envoyerAvis(accueil: number, rapidite: number, nps: number): Promise<void> {
    await request(app)
      .post("/api/v1/public/q/" + t4.code + "/avis")
      .set("User-Agent", NAVIGATEUR)
      .send({
        version_id: versionId,
        langue: "fr",
        reponses: [
          { question_id: idAccueil, valeur: accueil },
          { question_id: idRapidite, valeur: rapidite },
          { question_id: idNps, valeur: nps },
        ],
      })
      .expect(201);
  }

  async function lireAgregat() {
    return prisma.agregatQuotidien.findUnique({
      where: {
        point_contact_id_date: { point_contact_id: t4.id, date: debutDuJourUtc(new Date()) },
      },
    });
  }

  it("un avis envoye par l'API cree l'agregat du jour", async () => {
    expect(await lireAgregat()).toBeNull();

    await envoyerAvis(4, 5, 9); // note 4,5 ; promoteur

    const agregat = await lireAgregat();
    expect(agregat).toMatchObject({
      organisation_id: organisationId,
      site_id: siteAId,
      nb_avis: 1,
      nb_avis_notes: 1,
      somme_notes: 4.5,
      nb_satisfaits: 1,
      nb_nps: 1,
      nb_promoteurs: 1,
      nb_detracteurs: 0,
      nb_scans: 0,
    });
    expect(agregat?.repartition_notes).toEqual({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 });
    expect(agregat?.scores_themes).toEqual({
      [themeAccueilId]: { somme: 4, nb: 1 },
      [themeRapiditeId]: { somme: 5, nb: 1 },
    });
  });

  it("un deuxieme avis met a jour la meme ligne (somme des deux, pas un doublon)", async () => {
    await envoyerAvis(3, 3, 7); // note 3 ; passif

    const agregat = await lireAgregat();
    expect(agregat).toMatchObject({
      nb_avis: 2,
      nb_avis_notes: 2,
      somme_notes: 7.5,
      nb_satisfaits: 1,
      nb_nps: 2,
      nb_promoteurs: 1,
      nb_detracteurs: 0,
    });
    expect(agregat?.repartition_notes).toEqual({ "1": 0, "2": 0, "3": 1, "4": 0, "5": 1 });
    expect(agregat?.scores_themes).toEqual({
      [themeAccueilId]: { somme: 7, nb: 2 },
      [themeRapiditeId]: { somme: 8, nb: 2 },
    });
    expect(
      await prisma.agregatQuotidien.count({
        where: { point_contact_id: t4.id, date: debutDuJourUtc(new Date()) },
      }),
    ).toBe(1);
  });

  it("relancer le recalcul ne change rien (meme resultat a chaque fois)", async () => {
    await recalculerAgregat(t4.id, new Date());
    await recalculerAgregat(t4.id, new Date());

    const agregat = await lireAgregat();
    expect(agregat).toMatchObject({ nb_avis: 2, somme_notes: 7.5, nb_satisfaits: 1 });
  });

  it("un avis supprime n'est plus compte apres le recalcul", async () => {
    const avis = await prisma.avis.findFirstOrThrow({
      where: { point_contact_id: t4.id },
      orderBy: { soumis_le: "asc" },
      select: { id: true },
    });
    await prisma.avis.update({ where: { id: avis.id }, data: { supprime_le: new Date() } });

    await recalculerAgregat(t4.id, new Date());

    const agregat = await lireAgregat();
    expect(agregat).toMatchObject({ nb_avis: 1, somme_notes: 3, nb_satisfaits: 0, nb_promoteurs: 0 });
  });
});