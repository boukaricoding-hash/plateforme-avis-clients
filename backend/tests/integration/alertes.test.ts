import "dotenv/config";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/configuration/base-de-donnees";
import { declencherAlerteSiNecessaire } from "../../src/modules/alertes/services/alertes";

// Test des alertes (jour 6, etape 1) : un avis negatif cree une alerte et des
// notifications pour les bons destinataires. Les avis sont envoyes par l'API
// publique, comme un vrai client. L'organisation de test est supprimee a la fin.

const suffixe = randomBytes(4).toString("hex");
const NAVIGATEUR = "Test-Telephone";

let app: Express;
let organisationId: string;
let siteAId: string;
let siteBId: string;
let versionId: string;
let idEtoiles: string;
let idNps: string;
let codePoint: string;

let responsableId: string;
let gestionnaireAId: string;
let gestionnaireBId: string;
let responsableInactifId: string;

async function creerUtilisateur(
  nom: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  options: { siteId?: string; actif?: boolean } = {},
): Promise<string> {
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email: nom.toLowerCase() + "-" + suffixe + "@test-alertes.local",
      mot_de_passe_hash: "non-utilise-dans-ce-test",
      nom,
      role,
      organisation_id: organisationId,
      actif: options.actif ?? true,
      ...(options.siteId !== undefined
        ? { utilisateurs_sites: { create: { site_id: options.siteId } } }
        : {}),
    },
    select: { id: true },
  });
  return utilisateur.id;
}

beforeAll(async () => {
  // Reglages de test, poses AVANT de charger l'application.
  process.env["SEL_EMPREINTE"] ??= "sel-de-test-" + suffixe + "-0123456789";
  process.env["ANTI_DOUBLON_SEUIL_RESEAU"] = "1000";
  process.env["LIMITE_AVIS_PAR_MINUTE"] = "1000";
  ({ app } = await import("../../src/app"));

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-ALERTES-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const siteA = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site A" } });
  const siteB = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site B" } });
  siteAId = siteA.id;
  siteBId = siteB.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test alertes" },
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
        select: { id: true, questions: { orderBy: { ordre: "asc" }, select: { id: true } } },
      },
    },
  });

  const version = questionnaire.versions[0];
  const etoiles = version?.questions[0];
  const nps = version?.questions[1];
  if (!version || !etoiles || !nps) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionId = version.id;
  idEtoiles = etoiles.id;
  idNps = nps.id;

  // Le point de contact est dans le site A.
  codePoint = randomBytes(9).toString("base64url");
  await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteAId,
      questionnaire_id: questionnaire.id,
      nom: "Table alertes",
      code_public: codePoint,
    },
  });

  responsableId = await creerUtilisateur("Responsable", "RESPONSABLE");
  responsableInactifId = await creerUtilisateur("Responsable-inactif", "RESPONSABLE", { actif: false });
  gestionnaireAId = await creerUtilisateur("Gestionnaire-A", "GESTIONNAIRE", { siteId: siteAId });
  gestionnaireBId = await creerUtilisateur("Gestionnaire-B", "GESTIONNAIRE", { siteId: siteBId });
}, 30000);

afterAll(async () => {
  if (organisationId !== undefined) {
    await prisma.notification.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.alerte.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.reponse.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.avis.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.scan.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.pointContact.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.utilisateurSite.deleteMany({
      where: { utilisateur: { organisation_id: organisationId } },
    });
    await prisma.utilisateur.deleteMany({ where: { organisation_id: organisationId } });
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

// Envoie un avis comme un client (sans cookie) et renvoie son identifiant.
async function envoyerAvis(options: {
  note: number;
  nps: number;
  commentaire?: string;
}): Promise<string> {
  const reponse = await request(app)
    .post("/api/v1/public/q/" + codePoint + "/avis")
    .set("User-Agent", NAVIGATEUR)
    .send({
      version_id: versionId,
      langue: "fr",
      ...(options.commentaire !== undefined ? { commentaire: options.commentaire } : {}),
      reponses: [
        { question_id: idEtoiles, valeur: options.note },
        { question_id: idNps, valeur: options.nps },
      ],
    })
    .expect(201);
  return reponse.body.id as string;
}

async function lireAlerte(avisId: string) {
  return prisma.alerte.findUnique({ where: { avis_id: avisId } });
}

async function lireNotifications(avisId: string) {
  return prisma.notification.findMany({
    where: { avis_id: avisId },
    select: { utilisateur_id: true, titre: true, message: true, lue_le: true },
  });
}

describe("alertes sur les avis negatifs", () => {
  it("ne cree aucune alerte pour un avis positif", async () => {
    const avisId = await envoyerAvis({ note: 4, nps: 9 });

    expect(await lireAlerte(avisId)).toBeNull();
    expect(await lireNotifications(avisId)).toHaveLength(0);
  });

  it("cree une alerte et notifie les bonnes personnes pour un avis de 1 sur 5", async () => {
    const avisId = await envoyerAvis({ note: 1, nps: 9, commentaire: "Service tres lent" });

    const alerte = await lireAlerte(avisId);
    expect(alerte).not.toBeNull();
    expect(alerte?.motifs).toEqual(["NOTE_BASSE"]);

    const notifications = await lireNotifications(avisId);
    const destinataires = notifications.map((n) => n.utilisateur_id).sort();
    // Le responsable et le gestionnaire du site A : ni le gestionnaire du site B,
    // ni le responsable desactive.
    expect(destinataires).toEqual([responsableId, gestionnaireAId].sort());
    expect(destinataires).not.toContain(gestionnaireBId);
    expect(destinataires).not.toContain(responsableInactifId);

    const premiere = notifications[0];
    expect(premiere?.titre).toBe("Avis négatif : Table alertes");
    expect(premiere?.message).toContain("Site A");
    expect(premiere?.message).toContain("note 1/5");
    expect(premiere?.message).toContain("Service tres lent");
    expect(premiere?.lue_le).toBeNull();
  });

  it("detecte un NPS bas meme si la note est bonne (motif NPS_BAS)", async () => {
    const avisId = await envoyerAvis({ note: 5, nps: 3 });

    const alerte = await lireAlerte(avisId);
    expect(alerte?.motifs).toEqual(["NPS_BAS"]);
    expect(await lireNotifications(avisId)).toHaveLength(2);
  });

  it("garde les deux motifs quand la note et le NPS sont bas", async () => {
    const avisId = await envoyerAvis({ note: 1, nps: 2 });

    const alerte = await lireAlerte(avisId);
    expect(alerte?.motifs).toEqual(["NOTE_BASSE", "NPS_BAS"]);
  });

  it("le seuil est inclusif : 2 sur 5 alerte, 3 sur 5 non (NPS 6 alerte, 7 non)", async () => {
    const limiteNote = await envoyerAvis({ note: 2, nps: 9 });
    expect(await lireAlerte(limiteNote)).not.toBeNull();

    const limiteNps = await envoyerAvis({ note: 5, nps: 6 });
    expect(await lireAlerte(limiteNps)).not.toBeNull();

    const audessus = await envoyerAvis({ note: 3, nps: 7 });
    expect(await lireAlerte(audessus)).toBeNull();
  });

  it("le seuil est configurable par organisation", async () => {
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { seuil_alerte_note: 4 },
    });

    try {
      const avisId = await envoyerAvis({ note: 4, nps: 9 });
      const alerte = await lireAlerte(avisId);
      expect(alerte?.motifs).toEqual(["NOTE_BASSE"]);
    } finally {
      await prisma.organisation.update({
        where: { id: organisationId },
        data: { seuil_alerte_note: 2 },
      });
    }
  });

  it("ne cree pas de deuxieme alerte si la fonction est rappelee pour le meme avis", async () => {
    const avisId = await envoyerAvis({ note: 1, nps: 9 });
    const avant = await lireNotifications(avisId);

    const resultat = await declencherAlerteSiNecessaire(avisId);

    expect(resultat).toEqual({ alerte_creee: false, notifications: 0 });
    expect(await prisma.alerte.count({ where: { avis_id: avisId } })).toBe(1);
    expect(await lireNotifications(avisId)).toHaveLength(avant.length);
  });
});