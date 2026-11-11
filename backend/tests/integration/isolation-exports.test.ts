import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import ExcelJS from "exceljs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";
import {
  debutDuJourUtc,
  recalculerAgregat,
} from "../../src/modules/agregats/services/calcul-agregats";

// Isolation entre organisations pour les routes du jour 21 : POST /exports et POST /exports/analyse.
// L'organisation A essaie de sortir des avis de B (fichier csv, excel, rapport pdf, analyse) :
// rien de B ne doit jamais apparaitre. Chaque organisation a un seul avis, avec un commentaire
// secret, un site, un point de contact et un questionnaire aux noms uniques.
// Les tests de perimetre par site (gestionnaire) sont dans exports.test.ts.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Exports-2026";

type Agent = ReturnType<typeof request.agent>;

type OrganisationDeTest = {
  organisationId: string;
  utilisateurId: string;
  siteId: string;
  pointContactId: string;
  questionnaireId: string;
  commentaire: string;
  nomSite: string;
  nomPoint: string;
  titreQuestionnaire: string;
  agent: Agent;
};

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-ISOLATION-EXPORTS-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
  });

  const email = "responsable-" + lettre.toLowerCase() + "-" + suffixe + "@test-isolation-exports.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: "Responsable " + lettre,
      role: "RESPONSABLE",
      organisation_id: organisation.id,
    },
  });

  const nomSite = "Site-" + lettre + "-" + suffixe;
  const site = await prisma.site.create({
    data: { organisation_id: organisation.id, nom: nomSite },
  });

  const titreQuestionnaire = "Questionnaire-" + lettre + "-" + suffixe;
  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisation.id,
      titre: { fr: titreQuestionnaire },
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

  const nomPoint = "Table-" + lettre + "-" + suffixe;
  const pointContact = await prisma.pointContact.create({
    data: {
      organisation_id: organisation.id,
      site_id: site.id,
      questionnaire_id: questionnaire.id,
      nom: nomPoint,
      code_public: randomBytes(9).toString("base64url"),
    },
  });

  const commentaire = "Commentaire secret " + lettre + " " + suffixe;
  await prisma.avis.create({
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
  });

  // L'agregat du jour, comme le fait la tache de nuit : l'analyse part des chiffres du tableau de bord.
  await recalculerAgregat(pointContact.id, debutDuJourUtc(new Date()));

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
    commentaire,
    nomSite,
    nomPoint,
    titreQuestionnaire,
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
  await prisma.agregatQuotidien.deleteMany({ where: { organisation_id: { in: organisationIds } } });
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

// Tout ce qui permettrait de reconnaitre une organisation dans un fichier ou une reponse.
function elementsDe(organisation: OrganisationDeTest): string[] {
  return [organisation.commentaire, organisation.nomSite, organisation.nomPoint, organisation.titreQuestionnaire];
}

function verifierSansTrace(texte: string, organisation: OrganisationDeTest): void {
  for (const element of elementsDe(organisation)) {
    expect(texte).not.toContain(element);
  }
}

// Lit la reponse telle quelle (octets), sans la decoder : indispensable pour le BOM, l'Excel et le PDF.
function lireBinaire(
  reponse: NodeJS.ReadableStream,
  rappel: (erreur: Error | null, corps: Buffer) => void,
): void {
  const morceaux: Buffer[] = [];
  reponse.on("data", (morceau: Buffer | string) => {
    morceaux.push(typeof morceau === "string" ? Buffer.from(morceau) : morceau);
  });
  reponse.on("end", () => rappel(null, Buffer.concat(morceaux)));
}

async function exporter(agent: Agent, corps: object) {
  const reponse = await agent.post("/api/v1/exports").send(corps).buffer(true).parse(lireBinaire);
  const contenu: unknown = reponse.body;
  return { reponse, contenu: Buffer.isBuffer(contenu) ? contenu : Buffer.alloc(0) };
}

// Le CSV decode en UTF-8, sans le BOM, coupe en lignes (la premiere est l'en-tete).
function lignesCsv(contenu: Buffer): string[] {
  return contenu
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((ligne) => ligne !== "");
}

async function lireClasseur(contenu: Buffer): Promise<ExcelJS.Workbook> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(contenu as unknown as ExcelJS.Buffer);
  return classeur;
}

// Tout le texte du classeur, toutes feuilles confondues (Avis et Analyse).
function toutLeTexte(classeur: ExcelJS.Workbook): string {
  const morceaux: string[] = [];
  classeur.eachSheet((feuille) => {
    feuille.eachRow((ligne) => {
      morceaux.push(JSON.stringify(ligne.values));
    });
  });
  return morceaux.join("\n");
}

describe("isolation : acces sans connexion", () => {
  it("les deux routes d'exports refusent un visiteur non connecte (401)", async () => {
    await request(app).post("/api/v1/exports").send({ format: "csv" }).expect(401);
    await request(app).post("/api/v1/exports/analyse").send({}).expect(401);
  });
});

describe("isolation : fichiers exportes", () => {
  it("le csv de A ne contient que l'avis de A, et celui de B que l'avis de B", async () => {
    const deA = await exporter(orgA.agent, { format: "csv" });
    expect(deA.reponse.status).toBe(200);
    expect(lignesCsv(deA.contenu)).toHaveLength(2);
    const texteA = deA.contenu.toString("utf8");
    expect(texteA).toContain(orgA.commentaire);
    expect(texteA).toContain(orgA.nomSite);
    verifierSansTrace(texteA, orgB);

    // Et dans l'autre sens.
    const deB = await exporter(orgB.agent, { format: "csv" });
    expect(deB.reponse.status).toBe(200);
    expect(lignesCsv(deB.contenu)).toHaveLength(2);
    const texteB = deB.contenu.toString("utf8");
    expect(texteB).toContain(orgB.commentaire);
    verifierSansTrace(texteB, orgA);
  });

  it("l'Excel de A ne contient que l'avis de A, feuille Analyse comprise", async () => {
    const { reponse, contenu } = await exporter(orgA.agent, { format: "xlsx" });
    expect(reponse.status).toBe(200);

    const classeur = await lireClasseur(contenu);
    expect(classeur.getWorksheet("Avis")).toBeDefined();
    const texte = toutLeTexte(classeur);
    expect(texte).toContain(orgA.commentaire);
    verifierSansTrace(texte, orgB);
  });

  it("le rapport pdf de A ne compte que l'avis de A, et le journal d'audit reste dans A", async () => {
    const { reponse, contenu } = await exporter(orgA.agent, { format: "pdf" });
    expect(reponse.status).toBe(200);
    expect(contenu.toString("latin1").startsWith("%PDF-")).toBe(true);

    const ligne = await prisma.auditLog.findFirst({
      where: {
        organisation_id: orgA.organisationId,
        action: "EXPORT_GENERE",
        details: { path: ["format"], equals: "pdf" },
      },
    });
    expect(ligne).not.toBeNull();
    expect(ligne?.utilisateur_id).toBe(orgA.utilisateurId);
    expect(ligne?.details).toMatchObject({ format: "pdf", nb_avis: 1 });

    // Aucune trace de l'utilisateur de A dans le journal de B.
    const chezB = await prisma.auditLog.count({
      where: { organisation_id: orgB.organisationId, utilisateur_id: orgA.utilisateurId },
    });
    expect(chezB).toBe(0);
  });
});

describe("isolation : filtres et corps de la demande", () => {
  it("les filtres site, point et questionnaire de B ne font sortir aucun avis de B", async () => {
    const filtresDeB = [
      { site: orgB.siteId },
      { point: orgB.pointContactId },
      { questionnaire: orgB.questionnaireId },
    ];

    for (const filtres of filtresDeB) {
      const { reponse, contenu } = await exporter(orgA.agent, { format: "csv", filtres });
      expect(reponse.status).toBe(200);
      // Seulement la ligne d'en-tete : aucun avis.
      expect(lignesCsv(contenu)).toHaveLength(1);
      verifierSansTrace(contenu.toString("utf8"), orgB);

      const analyse = await orgA.agent.post("/api/v1/exports/analyse").send({ filtres }).expect(200);
      expect(analyse.body.nb_avis).toBe(0);
      verifierSansTrace(JSON.stringify(analyse.body), orgB);
    }
  });

  it("l'organisation envoyee dans le corps est ignoree : l'organisation vient de la session", async () => {
    const corps = {
      format: "csv",
      organisation_id: orgB.organisationId,
      filtres: { organisation_id: orgB.organisationId },
    };
    const { reponse, contenu } = await exporter(orgA.agent, corps);
    expect(reponse.status).toBe(200);
    expect(lignesCsv(contenu)).toHaveLength(2);
    const texte = contenu.toString("utf8");
    expect(texte).toContain(orgA.commentaire);
    verifierSansTrace(texte, orgB);

    const analyse = await orgA.agent
      .post("/api/v1/exports/analyse")
      .send({ organisation_id: orgB.organisationId, filtres: { organisation_id: orgB.organisationId } })
      .expect(200);
    expect(analyse.body.nb_avis).toBe(1);
  });
});

describe("isolation : analyse du robot", () => {
  it("l'analyse de A ne compte et ne cite que l'avis de A", async () => {
    const reponse = await orgA.agent.post("/api/v1/exports/analyse").send({}).expect(200);

    expect(reponse.body.nb_avis).toBe(1);
    verifierSansTrace(JSON.stringify(reponse.body), orgB);

    // Et dans l'autre sens.
    const deB = await orgB.agent.post("/api/v1/exports/analyse").send({}).expect(200);
    expect(deB.body.nb_avis).toBe(1);
    verifierSansTrace(JSON.stringify(deB.body), orgA);
  });
});