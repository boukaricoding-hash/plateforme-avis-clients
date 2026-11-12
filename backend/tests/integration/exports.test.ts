import { randomBytes, randomUUID } from "node:crypto";
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

// Test des exports et de l'analyse (jour 21) : POST /exports et POST /exports/analyse.
// Les avis sont poses directement en base pour maitriser les dates, les notes et les textes.
// L'organisation de test est supprimee a la fin.
//
// Les 6 avis d'octobre 2026 (l'avis supprime ne doit jamais sortir) :
//
//   n   site  jour    note  NPS  statut     commentaire
//   1   A     02/10   5     10   Nouveau    Tres bien, service rapide ; merci
//   2   A     05/10   1     2    En cours   =2+2   (alerte, coordonnees consenties)
//   3   B     07/10   4,5   9    Traite     Cafe delicieux   (coordonnees NON consenties)
//   4   A     09/10   4     8    Nouveau    (aucun)
//   5   B     12/10   3     7    Ignore     Prix eleve
//   6   B     15/10   5     10   Nouveau    Accueil chaleureux
//
// Valeurs calculees a la main : note moyenne = 22,5 / 6 = 3,75.
// NPS : 3 promoteurs (10, 9, 10), 1 detracteur (2), 6 reponses -> (3 - 1) / 6 = 33,3.
// Le gestionnaire du site A ne voit que les avis 1, 2 et 4.
//
// Les 1 000 avis d'aout 2026 servent au scenario 10 (Excel en moins de 10 secondes).

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Exports-2026";
const PERIODE_OCTOBRE = { from: "2026-10-01", to: "2026-10-31" };
const PERIODE_AOUT = { from: "2026-08-01", to: "2026-08-31" };
const NOMBRE_AVIS_AOUT = 1000;
const DUREE_MAX_MS = 10_000;

type Agent = ReturnType<typeof request.agent>;

let organisationId: string;
let siteAId: string;
let siteBId: string;
let pointAId: string;
let pointBId: string;
let versionId: string;
let idEtoiles: string;
let idNps: string;
let idChoix: string;
let idOuiNon: string;

let responsableId: string;
const utilisateurIds: string[] = [];
let agentResponsable: Agent;
let agentGestionnaireA: Agent;
let agentAdministrateur: Agent;

type ChoixPlat = "poulet" | "poisson";

async function creerAvis(donnees: {
  site: "A" | "B";
  note: number;
  nps: number;
  commentaire: string | null;
  soumisLe: string;
  statut: "NOUVEAU" | "EN_COURS" | "TRAITE" | "IGNORE";
  plat: ChoixPlat;
  reviendrait: boolean;
  supprime?: boolean;
  contact?: { nom: string; tel: string; email: string; consentement: boolean };
}): Promise<string> {
  const avis = await prisma.avis.create({
    data: {
      organisation_id: organisationId,
      site_id: donnees.site === "A" ? siteAId : siteBId,
      point_contact_id: donnees.site === "A" ? pointAId : pointBId,
      version_id: versionId,
      soumis_le: new Date(donnees.soumisLe),
      langue: "fr",
      note_globale: donnees.note,
      nps: donnees.nps,
      commentaire: donnees.commentaire,
      statut_traitement: donnees.statut,
      ...(donnees.supprime === true ? { supprime_le: new Date() } : {}),
      ...(donnees.contact !== undefined
        ? {
            consentement: donnees.contact.consentement,
            contact_nom: donnees.contact.nom,
            contact_tel: donnees.contact.tel,
            contact_email: donnees.contact.email,
          }
        : {}),
      reponses: {
        create: [
          { organisation_id: organisationId, question_id: idEtoiles, valeur_numerique: donnees.note },
          { organisation_id: organisationId, question_id: idNps, valeur_numerique: donnees.nps },
          { organisation_id: organisationId, question_id: idChoix, valeur_choix: donnees.plat },
          { organisation_id: organisationId, question_id: idOuiNon, valeur_numerique: donnees.reviendrait ? 1 : 0 },
        ],
      },
    },
    select: { id: true },
  });
  return avis.id;
}

async function creerUtilisateur(
  nom: string,
  role: "RESPONSABLE" | "GESTIONNAIRE" | "ADMINISTRATEUR",
  siteId?: string,
): Promise<{ id: string; email: string }> {
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email: nom.toLowerCase() + "-" + suffixe + "@test-exports.local",
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom,
      role,
      organisation_id: organisationId,
      ...(siteId !== undefined ? { utilisateurs_sites: { create: { site_id: siteId } } } : {}),
    },
    select: { id: true, email: true },
  });
  utilisateurIds.push(utilisateur.id);
  return utilisateur;
}

async function connecter(email: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false }).expect(200);
  return agent;
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

// Le CSV decode en UTF-8, sans le BOM, coupe en lignes.
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

// Les valeurs d'une ligne de la feuille (ExcelJS compte les colonnes a partir de 1 : on retire la case 0).
function valeursLigne(feuille: ExcelJS.Worksheet, numero: number): unknown[] {
  const valeurs = feuille.getRow(numero).values;
  return Array.isArray(valeurs) ? valeurs.slice(1) : [];
}

const ENTETES_FR = [
  "Date et heure (UTC)",
  "Site",
  "Point de contact",
  "Type de point",
  "Questionnaire",
  "Version",
  "Langue",
  "Appareil",
  "Note globale",
  "NPS",
  "Statut",
  "Alerte",
  "Commentaire",
  "Nom",
  "Téléphone",
  "E-mail",
  "Accueil ?",
  "Recommanderiez-vous ?",
  "Plat préféré ?",
  "Reviendriez-vous ?",
];

beforeAll(async () => {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-EXPORTS-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const siteA = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Salle Étoile" } });
  const siteB = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Terrasse Océan" } });
  siteAId = siteA.id;
  siteBId = siteB.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire été", en: "Summer questionnaire" },
      statut: "ACTIF",
      versions: {
        create: {
          numero: 1,
          publie_le: new Date(),
          questions: {
            create: [
              { ordre: 1, type: "ETOILES", libelle: { fr: "Accueil ?", en: "Welcome?" }, echelle_min: 1, echelle_max: 5 },
              {
                ordre: 2,
                type: "NPS",
                libelle: { fr: "Recommanderiez-vous ?", en: "Would you recommend us?" },
                echelle_min: 0,
                echelle_max: 10,
              },
              {
                ordre: 3,
                type: "CHOIX_UNIQUE",
                libelle: { fr: "Plat préféré ?", en: "Favourite dish?" },
                options: [
                  { valeur: "poulet", fr: "Poulet braisé", en: "Grilled chicken" },
                  { valeur: "poisson", fr: "Poisson grillé", en: "Grilled fish" },
                ],
              },
              { ordre: 4, type: "OUI_NON", libelle: { fr: "Reviendriez-vous ?", en: "Would you come back?" } },
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
  const [etoiles, nps, choix, ouiNon] = version?.questions ?? [];
  if (!version || !etoiles || !nps || !choix || !ouiNon) {
    throw new Error("Questionnaire de test incomplet.");
  }
  versionId = version.id;
  idEtoiles = etoiles.id;
  idNps = nps.id;
  idChoix = choix.id;
  idOuiNon = ouiNon.id;

  const pointA = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteAId,
      questionnaire_id: questionnaire.id,
      nom: "Table 1",
      code_public: randomBytes(9).toString("base64url"),
    },
  });
  const pointB = await prisma.pointContact.create({
    data: {
      organisation_id: organisationId,
      site_id: siteBId,
      questionnaire_id: questionnaire.id,
      nom: "Table 2",
      code_public: randomBytes(9).toString("base64url"),
    },
  });
  pointAId = pointA.id;
  pointBId = pointB.id;

  // Les avis d'octobre.
  await creerAvis({
    site: "A", note: 5, nps: 10, commentaire: "Très bien, service rapide ; merci",
    soumisLe: "2026-10-02T09:00:00.000Z", statut: "NOUVEAU", plat: "poulet", reviendrait: true,
  });
  const avis2 = await creerAvis({
    site: "A", note: 1, nps: 2, commentaire: "=2+2",
    soumisLe: "2026-10-05T14:30:00.000Z", statut: "EN_COURS", plat: "poisson", reviendrait: false,
    contact: { nom: "Kossi Ahégo", tel: "+22890000000", email: "kossi@test-exports.local", consentement: true },
  });
  await creerAvis({
    site: "B", note: 4.5, nps: 9, commentaire: "Café délicieux",
    soumisLe: "2026-10-07T12:00:00.000Z", statut: "TRAITE", plat: "poulet", reviendrait: true,
    contact: { nom: "Ne-pas-exporter", tel: "+22891111111", email: "cache@test-exports.local", consentement: false },
  });
  await creerAvis({
    site: "A", note: 4, nps: 8, commentaire: null,
    soumisLe: "2026-10-09T18:00:00.000Z", statut: "NOUVEAU", plat: "poisson", reviendrait: true,
  });
  await creerAvis({
    site: "B", note: 3, nps: 7, commentaire: "Prix élevé",
    soumisLe: "2026-10-12T19:00:00.000Z", statut: "IGNORE", plat: "poulet", reviendrait: false,
  });
  await creerAvis({
    site: "B", note: 5, nps: 10, commentaire: "Accueil chaleureux",
    soumisLe: "2026-10-15T11:00:00.000Z", statut: "NOUVEAU", plat: "poisson", reviendrait: true,
  });
  await creerAvis({
    site: "A", note: 5, nps: 10, commentaire: "Avis-supprime-secret",
    soumisLe: "2026-10-03T10:00:00.000Z", statut: "NOUVEAU", plat: "poulet", reviendrait: true, supprime: true,
  });

  // L'avis negatif (le 2) a declenche une alerte.
  await prisma.alerte.create({
    data: { organisation_id: organisationId, avis_id: avis2, motifs: ["NOTE_BASSE", "NPS_BAS"] },
  });

  // Les agregats, comme le fait la tache de nuit (un par point de contact et par jour d'avis).
  const jours = [
    [pointAId, "2026-10-02"], [pointAId, "2026-10-05"], [pointAId, "2026-10-09"],
    [pointBId, "2026-10-07"], [pointBId, "2026-10-12"], [pointBId, "2026-10-15"],
  ] as const;
  for (const [pointId, jour] of jours) {
    await recalculerAgregat(pointId, debutDuJourUtc(new Date(jour + "T12:00:00.000Z")));
  }

  // Un responsable (toute l'organisation), un gestionnaire du site A, un administrateur.
  const responsable = await creerUtilisateur("Responsable", "RESPONSABLE");
  const gestionnaire = await creerUtilisateur("Gestionnaire-A", "GESTIONNAIRE", siteAId);
  const administrateur = await creerUtilisateur("Administrateur", "ADMINISTRATEUR");
  responsableId = responsable.id;
  agentResponsable = await connecter(responsable.email);
  agentGestionnaireA = await connecter(gestionnaire.email);
  agentAdministrateur = await connecter(administrateur.email);
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
}, 60000);

// ------------------------------------------------------------
// Acces et validation
// ------------------------------------------------------------

describe("acces et validation", () => {
  it("refuse sans connexion (401)", async () => {
    await request(app).post("/api/v1/exports").send({ format: "csv" }).expect(401);
    await request(app).post("/api/v1/exports/analyse").send({}).expect(401);
  });

  it("refuse un administrateur (403) : seuls les responsables et gestionnaires exportent", async () => {
    await agentAdministrateur.post("/api/v1/exports").send({ format: "csv" }).expect(403);
    await agentAdministrateur.post("/api/v1/exports/analyse").send({}).expect(403);
  });

  it("refuse un corps invalide avec le bon champ (400)", async () => {
    const champs = async (corps: object, route = "/api/v1/exports"): Promise<string[]> => {
      const reponse = await agentResponsable.post(route).send(corps).expect(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
      return (reponse.body.details as { champ: string }[]).map((detail) => detail.champ);
    };

    expect(await champs({})).toContain("format");
    expect(await champs({ format: "docx" })).toContain("format");
    expect(await champs({ format: "csv", langue: "xx" })).toContain("langue");
    expect(await champs({ format: "csv", filtres: { from: "2026-10-01" } })).toContain("filtres.from");
    expect(await champs({ format: "csv", filtres: { from: "2026-10-31", to: "2026-10-01" } })).toContain("filtres.from");
    expect(await champs({ format: "csv", filtres: { site: "pas-un-uuid" } })).toContain("filtres.site");
    expect(await champs({ format: "pdf", filtres: { from: "2025-01-01", to: "2026-02-05" } })).toContain("filtres.to");
    // L'analyse a la meme limite de periode (366 jours) et les memes filtres.
    expect(await champs({ filtres: { from: "2025-01-01", to: "2026-02-05" } }, "/api/v1/exports/analyse")).toContain(
      "filtres.to",
    );
  });
});

// ------------------------------------------------------------
// CSV
// ------------------------------------------------------------

describe("export csv", () => {
  it("renvoie un fichier csv en UTF-8 avec BOM, nomme avec la date du jour", async () => {
    const { reponse, contenu } = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_OCTOBRE });

    expect(reponse.status).toBe(200);
    expect(reponse.headers["content-type"]).toContain("text/csv");
    expect(reponse.headers["content-type"]).toContain("utf-8");
    expect(reponse.headers["content-disposition"]).toMatch(/^attachment; filename="avis-\d{4}-\d{2}-\d{2}\.csv"$/);
    // Le BOM (EF BB BF) permet a Excel de lire les accents.
    expect([...contenu.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("garde les accents et ne contient aucun caractere casse", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_OCTOBRE });
    const texte = contenu.toString("utf8");

    for (const attendu of ["Téléphone", "Plat préféré ?", "Poulet braisé", "Poisson grillé", "Salle Étoile", "Terrasse Océan"]) {
      expect(texte).toContain(attendu);
    }
    expect(texte).toContain("Café délicieux");
    expect(texte).toContain("Kossi Ahégo");
    expect(texte).toContain("Traité");
    expect(texte).not.toContain("Ã");
    expect(texte).not.toContain("\uFFFD");
  });

  it("met une ligne par avis (l'avis supprime n'y est pas) et une colonne par question", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_OCTOBRE });
    const lignes = lignesCsv(contenu);

    expect(lignes).toHaveLength(1 + 6);
    expect(lignes[0]).toBe(ENTETES_FR.join(";"));
    expect(contenu.toString("utf8")).not.toContain("Avis-supprime-secret");
  });

  it("ecrit les nombres a la francaise, protege le point-virgule et neutralise les formules", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_OCTOBRE });
    const texte = contenu.toString("utf8");

    // Avis 3 : note 4,5 avec la virgule decimale ; statut et alerte en francais.
    expect(texte).toContain(";4,5;9;Traité;Non;");
    // Avis 1 : le commentaire contient un point-virgule, il est entre guillemets.
    expect(texte).toContain(';"Très bien, service rapide ; merci";');
    // Avis 2 : un commentaire qui commence par = devient du texte (apostrophe), le telephone reste intact.
    expect(texte).toContain(";'=2+2;Kossi Ahégo;+22890000000;kossi@test-exports.local;");
    expect(texte).toContain("2026-10-05 14:30");
  });

  it("n'exporte les coordonnees que si le client a consenti", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_OCTOBRE });
    const texte = contenu.toString("utf8");

    expect(texte).toContain("kossi@test-exports.local");
    expect(texte).not.toContain("Ne-pas-exporter");
    expect(texte).not.toContain("+22891111111");
    expect(texte).not.toContain("cache@test-exports.local");
  });

  it("respecte les filtres de la liste des avis", async () => {
    const negatifs = await exporter(agentResponsable, { format: "csv", filtres: { ...PERIODE_OCTOBRE, negatifs: true } });
    expect(lignesCsv(negatifs.contenu)).toHaveLength(1 + 1);

    const siteB = await exporter(agentResponsable, { format: "csv", filtres: { ...PERIODE_OCTOBRE, site: siteBId } });
    expect(lignesCsv(siteB.contenu)).toHaveLength(1 + 3);

    const statut = await exporter(agentResponsable, { format: "csv", filtres: { ...PERIODE_OCTOBRE, statut: "NOUVEAU" } });
    expect(lignesCsv(statut.contenu)).toHaveLength(1 + 3);

    const recherche = await exporter(agentResponsable, { format: "csv", filtres: { ...PERIODE_OCTOBRE, q: "délicieux" } });
    expect(lignesCsv(recherche.contenu)).toHaveLength(1 + 1);

    const semaine = await exporter(agentResponsable, {
      format: "csv",
      filtres: { from: "2026-10-05", to: "2026-10-07" },
    });
    expect(lignesCsv(semaine.contenu)).toHaveLength(1 + 2);
  });

  it("exporte en anglais : virgule, point decimal, entetes et statuts anglais", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "csv", langue: "en", filtres: PERIODE_OCTOBRE });
    const texte = contenu.toString("utf8");

    expect(lignesCsv(contenu)[0]).toContain("Overall rating");
    expect(lignesCsv(contenu)[0]).toContain("Favourite dish?");
    expect(texte).toContain(",4.5,9,Resolved,No,");
    expect(texte).toContain("Grilled chicken");
  });

  it("ne laisse que le texte de recherche hors du journal d'audit", async () => {
    await exporter(agentResponsable, { format: "csv", filtres: { ...PERIODE_OCTOBRE, q: "Prix" } });

    const lignes = await prisma.auditLog.findMany({
      where: { organisation_id: organisationId, action: "EXPORT_GENERE", utilisateur_id: responsableId },
      orderBy: { cree_le: "desc" },
    });
    const derniere = lignes[0];
    expect(derniere).toBeDefined();
    expect(derniere?.details).toMatchObject({ format: "csv", langue: "fr", nb_avis: 1, recherche: true });
    expect(JSON.stringify(derniere?.details)).not.toContain("Prix");
  });
});

// ------------------------------------------------------------
// Excel
// ------------------------------------------------------------

describe("export excel", () => {
  it("renvoie un classeur avec la feuille Avis et la feuille Analyse", async () => {
    const { reponse, contenu } = await exporter(agentResponsable, { format: "xlsx", filtres: PERIODE_OCTOBRE });

    expect(reponse.status).toBe(200);
    expect(reponse.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(reponse.headers["content-disposition"]).toMatch(/^attachment; filename="avis-\d{4}-\d{2}-\d{2}\.xlsx"$/);

    const classeur = await lireClasseur(contenu);
    expect(classeur.worksheets.map((feuille) => feuille.name)).toEqual(["Avis", "Analyse"]);
  });

  it("met une ligne par avis et une colonne par question, avec les accents", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "xlsx", filtres: PERIODE_OCTOBRE });
    const feuille = (await lireClasseur(contenu)).getWorksheet("Avis");
    if (!feuille) throw new Error("Feuille Avis absente.");

    expect(feuille.rowCount).toBe(1 + 6);
    expect(valeursLigne(feuille, 1)).toEqual(ENTETES_FR);

    // Les plus recents d'abord : l'avis 6 (15 octobre) est en premiere ligne de donnees.
    const premiere = valeursLigne(feuille, 2);
    expect(premiere[1]).toBe("Terrasse Océan");
    expect(premiere[12]).toBe("Accueil chaleureux");
    expect(premiere[18]).toBe("Poisson grillé");
    expect(premiere[19]).toBe("Oui");

    // L'avis 3 : la note est un vrai nombre, la date une vraie date, pas de coordonnees.
    const ligne3 = [2, 3, 4, 5, 6, 7].map((n) => valeursLigne(feuille, n)).find((v) => v[12] === "Café délicieux");
    expect(ligne3).toBeDefined();
    expect(ligne3?.[8]).toBe(4.5);
    expect(ligne3?.[9]).toBe(9);
    expect(ligne3?.[10]).toBe("Traité");
    expect(ligne3?.[0]).toBeInstanceOf(Date);
    expect((ligne3?.[0] as Date).toISOString().slice(0, 16)).toBe("2026-10-07T12:00");
    expect(ligne3?.[13]).toBeFalsy();
    expect(ligne3?.[15]).toBeFalsy();
  });

  it("ecrit la formule du client comme du texte, jamais comme une formule", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "xlsx", filtres: PERIODE_OCTOBRE });
    const feuille = (await lireClasseur(contenu)).getWorksheet("Avis");
    if (!feuille) throw new Error("Feuille Avis absente.");

    const ligne2 = [2, 3, 4, 5, 6, 7].map((n) => valeursLigne(feuille, n)).find((v) => v[14] === "+22890000000");
    expect(ligne2?.[12]).toBe("=2+2");
  });

  it("la feuille Analyse reprend les chiffres de l'analyse", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "xlsx", filtres: PERIODE_OCTOBRE });
    const feuille = (await lireClasseur(contenu)).getWorksheet("Analyse");
    if (!feuille) throw new Error("Feuille Analyse absente.");

    const texte: string[] = [];
    feuille.eachRow((ligne) => texte.push(String(ligne.getCell(1).value ?? "")));
    const tout = texte.join("\n");

    expect(texte[0]).toBe("Analyse des avis");
    expect(tout).toContain("Du 01/10/2026 au 31/10/2026 : vos clients sont moyennement satisfaits");
    // Le robot parle en mots, pas en chiffres : la note reste dans la feuille des avis et le tableau de bord.
    expect(tout).not.toContain("3,75/5");
    expect(tout).toContain("Points forts");
    expect(tout).toContain("Points faibles");
    expect(tout).toContain("Pistes d’action");
    expect(tout).toContain("rien ne quitte le serveur");
  });

  it("exporte en anglais : feuilles Reviews et Analysis", async () => {
    const { contenu } = await exporter(agentResponsable, { format: "xlsx", langue: "en", filtres: PERIODE_OCTOBRE });
    const classeur = await lireClasseur(contenu);

    expect(classeur.worksheets.map((feuille) => feuille.name)).toEqual(["Reviews", "Analysis"]);
    const feuille = classeur.getWorksheet("Reviews");
    expect(feuille ? valeursLigne(feuille, 1)[8] : null).toBe("Overall rating");
  });
});

// ------------------------------------------------------------
// PDF
// ------------------------------------------------------------

describe("rapport pdf", () => {
  it("renvoie un PDF valide avec les deux pages (indicateurs, puis points forts et faibles)", async () => {
    const { reponse, contenu } = await exporter(agentResponsable, { format: "pdf", filtres: PERIODE_OCTOBRE });

    expect(reponse.status).toBe(200);
    expect(reponse.headers["content-type"]).toBe("application/pdf");
    expect(reponse.headers["content-disposition"]).toMatch(/^attachment; filename="rapport-avis-\d{4}-\d{2}-\d{2}\.pdf"$/);

    const texte = contenu.toString("latin1");
    expect(texte.startsWith("%PDF-")).toBe(true);
    expect(texte.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(contenu.length).toBeGreaterThan(5000);
    // Une page de graphiques + une page d'analyse : 6 avis suffisent pour conclure.
    expect(texte.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(2);
  });

  it("n'a qu'une page quand il y a trop peu d'avis pour conclure", async () => {
    const { reponse, contenu } = await exporter(agentResponsable, {
      format: "pdf",
      filtres: { from: "2026-10-01", to: "2026-10-06" },
    });

    expect(reponse.status).toBe(200);
    expect(contenu.toString("latin1").match(/\/Type \/Page\b(?!s)/g)).toHaveLength(1);
  });

  it("laisse une ligne dans le journal d'audit", async () => {
    await exporter(agentResponsable, { format: "pdf", filtres: PERIODE_OCTOBRE });

    const ligne = await prisma.auditLog.findFirst({
      where: { organisation_id: organisationId, action: "EXPORT_GENERE", details: { path: ["format"], equals: "pdf" } },
    });
    expect(ligne).not.toBeNull();
    expect(ligne?.utilisateur_id).toBe(responsableId);
    expect(ligne?.details).toMatchObject({ format: "pdf", from: "2026-10-01", to: "2026-10-31", nb_avis: 6 });
  });
});

// ------------------------------------------------------------
// Analyse (le robot de l'ecran E16)
// ------------------------------------------------------------

describe("analyse", () => {
  it("fonctionne sans format et renvoie le resume, les points forts, les points faibles et les pistes", async () => {
    const reponse = await agentResponsable.post("/api/v1/exports/analyse").send({ filtres: PERIODE_OCTOBRE }).expect(200);
    const analyse = reponse.body;

    expect(analyse.langue).toBe("fr");
    expect(analyse.periode).toMatchObject({ from: "2026-10-01", to: "2026-10-31", nombre_jours: 31 });
    expect(analyse.nb_avis).toBe(6);
    expect(analyse.suffisant).toBe(true);
    // Note de 3,75 : entre l'orange et le vert, donc "moyennement satisfaits" (sans chiffre).
    expect(analyse.resume).toContain("Du 01/10/2026 au 31/10/2026 : vos clients sont moyennement satisfaits");
    expect(analyse.points_forts.length).toBeLessThanOrEqual(3);
    expect(analyse.points_faibles.length).toBeLessThanOrEqual(3);
    expect(analyse.points_forts.length + analyse.points_faibles.length).toBeGreaterThan(0);
    expect(analyse.pistes.length).toBeGreaterThan(0);
    for (const point of [...analyse.points_forts, ...analyse.points_faibles, ...analyse.pistes]) {
      expect(typeof point.titre).toBe("string");
      expect(typeof point.detail).toBe("string");
    }
  });

  it("parle en mots et non en chiffres, et relie chaque point faible a une action", async () => {
    const analyse = (await agentResponsable.post("/api/v1/exports/analyse").send({ filtres: PERIODE_OCTOBRE }).expect(200)).body;

    const textes = [analyse.resume, ...[...analyse.points_forts, ...analyse.points_faibles, ...analyse.pistes].flatMap((p) => [p.titre, p.detail])];
    for (const texte of textes) {
      // Ni score (4,2/5), ni pourcentage (30 %), ni sigle NPS : les chiffres sont dans le tableau de bord.
      expect(texte).not.toMatch(/\d\s?(\/5|%)|NPS/);
    }
    // Une piste d'action par point faible (ou une seule piste "maintenir" quand rien ne va mal).
    expect(analyse.pistes.length).toBe(Math.max(1, analyse.points_faibles.length));
  });
  it("donne les memes chiffres que le tableau de bord (calcul a la main : note 3,75, NPS 33,3)", async () => {
    const analyse = (await agentResponsable.post("/api/v1/exports/analyse").send({ filtres: PERIODE_OCTOBRE }).expect(200)).body;
    const tableau = (
      await agentResponsable
        .get("/api/v1/dashboard/kpis")
        .query({ from: PERIODE_OCTOBRE.from, to: PERIODE_OCTOBRE.to })
        .expect(200)
    ).body;

    expect(analyse.donnees.kpis.indicateurs).toEqual(tableau.indicateurs);
    expect(analyse.donnees.kpis.indicateurs.nb_avis).toBe(6);
    expect(analyse.donnees.kpis.indicateurs.note_moyenne).toBeCloseTo(3.75, 2);
    expect(analyse.donnees.kpis.indicateurs.nps).toBeCloseTo(33.3, 1);
  });

  it("accepte un format sans en tenir compte, et repond en anglais si on le demande", async () => {
    const reponse = await agentResponsable
      .post("/api/v1/exports/analyse")
      .send({ format: "csv", langue: "en", filtres: PERIODE_OCTOBRE })
      .expect(200);

    expect(reponse.body.langue).toBe("en");
    expect(reponse.body.resume).toContain("From 2026-10-01 to 2026-10-31: your customers are only fairly satisfied");
  });

  it("dit qu'il n'y a pas assez d'avis plutot que d'inventer une conclusion", async () => {
    const reponse = await agentResponsable
      .post("/api/v1/exports/analyse")
      .send({ filtres: { from: "2026-10-01", to: "2026-10-06" } })
      .expect(200);

    expect(reponse.body.nb_avis).toBe(2);
    expect(reponse.body.suffisant).toBe(false);
    expect(reponse.body.points_forts).toEqual([]);
    expect(reponse.body.points_faibles).toEqual([]);
    expect(reponse.body.pistes).toEqual([]);
  });

  it("sans corps, analyse les 30 derniers jours sans erreur", async () => {
    const reponse = await agentResponsable.post("/api/v1/exports/analyse").expect(200);
    expect(reponse.body.periode.nombre_jours).toBe(30);
  });
});

// ------------------------------------------------------------
// Perimetre du gestionnaire
// ------------------------------------------------------------

describe("perimetre du gestionnaire (site A seulement)", () => {
  it("n'exporte que les avis de son site, en csv", async () => {
    const { contenu } = await exporter(agentGestionnaireA, { format: "csv", filtres: PERIODE_OCTOBRE });
    const texte = contenu.toString("utf8");

    expect(lignesCsv(contenu)).toHaveLength(1 + 3);
    expect(texte).toContain("Salle Étoile");
    expect(texte).not.toContain("Terrasse Océan");
    expect(texte).not.toContain("Café délicieux");
    expect(texte).not.toContain("Prix élevé");
    expect(texte).not.toContain("Accueil chaleureux");
  });

  it("n'exporte que les avis de son site, en excel", async () => {
    const { contenu } = await exporter(agentGestionnaireA, { format: "xlsx", filtres: PERIODE_OCTOBRE });
    const feuille = (await lireClasseur(contenu)).getWorksheet("Avis");
    if (!feuille) throw new Error("Feuille Avis absente.");

    expect(feuille.rowCount).toBe(1 + 3);
    for (const numero of [2, 3, 4]) {
      expect(valeursLigne(feuille, numero)[1]).toBe("Salle Étoile");
    }
  });

  it("ne peut pas demander le site d'un autre : aucun avis ne sort", async () => {
    const { reponse, contenu } = await exporter(agentGestionnaireA, {
      format: "csv",
      filtres: { ...PERIODE_OCTOBRE, site: siteBId },
    });

    expect(reponse.status).toBe(200);
    expect(lignesCsv(contenu)).toHaveLength(1);
    expect(contenu.toString("utf8")).not.toContain("Terrasse Océan");
  });

  it("son rapport pdf et son analyse ne comptent que son site", async () => {
    const analyse = (await agentGestionnaireA.post("/api/v1/exports/analyse").send({ filtres: PERIODE_OCTOBRE }).expect(200)).body;
    expect(analyse.nb_avis).toBe(3);

    const { reponse, contenu } = await exporter(agentGestionnaireA, { format: "pdf", filtres: PERIODE_OCTOBRE });
    expect(reponse.status).toBe(200);
    expect(contenu.toString("latin1").startsWith("%PDF-")).toBe(true);
  });
});

// ------------------------------------------------------------
// Volume : 1 000 avis (scenario 10)
// ------------------------------------------------------------

describe("1 000 avis d'aout", () => {
  beforeAll(async () => {
    const avis: Array<{
      id: string;
      organisation_id: string;
      site_id: string;
      point_contact_id: string;
      version_id: string;
      soumis_le: Date;
      langue: string;
      note_globale: number;
      nps: number;
      commentaire: string | null;
      statut_traitement: "NOUVEAU" | "EN_COURS" | "TRAITE" | "IGNORE";
    }> = [];
    const statuts = ["NOUVEAU", "EN_COURS", "TRAITE", "IGNORE"] as const;

    for (let i = 0; i < NOMBRE_AVIS_AOUT; i += 1) {
      const jour = String(1 + (i % 31)).padStart(2, "0");
      const heure = String(8 + (i % 12)).padStart(2, "0");
      const surA = i % 2 === 0;
      avis.push({
        id: randomUUID(),
        organisation_id: organisationId,
        site_id: surA ? siteAId : siteBId,
        point_contact_id: surA ? pointAId : pointBId,
        version_id: versionId,
        soumis_le: new Date("2026-08-" + jour + "T" + heure + ":15:00.000Z"),
        langue: "fr",
        note_globale: 1 + (i % 5),
        nps: i % 11,
        commentaire: i % 3 === 0 ? "Très bon accueil, café délicieux à Lomé (n° " + String(i) + ")" : null,
        statut_traitement: statuts[i % 4] ?? "NOUVEAU",
      });
    }
    await prisma.avis.createMany({ data: avis });

    // Les reponses, par paquets (une limite de parametres existe cote base).
    for (let debut = 0; debut < avis.length; debut += 400) {
      await prisma.reponse.createMany({
        data: avis.slice(debut, debut + 400).flatMap((ligne, index) => [
          { organisation_id: organisationId, avis_id: ligne.id, question_id: idEtoiles, valeur_numerique: ligne.note_globale },
          { organisation_id: organisationId, avis_id: ligne.id, question_id: idNps, valeur_numerique: ligne.nps },
          { organisation_id: organisationId, avis_id: ligne.id, question_id: idChoix, valeur_choix: (debut + index) % 2 === 0 ? "poulet" : "poisson" },
          { organisation_id: organisationId, avis_id: ligne.id, question_id: idOuiNon, valeur_numerique: (debut + index) % 3 === 0 ? 1 : 0 },
        ]),
      });
    }

    // Les agregats, pour que la feuille Analyse travaille sur de vrais chiffres.
    for (let numero = 1; numero <= 31; numero += 1) {
      const jour = debutDuJourUtc(new Date("2026-08-" + String(numero).padStart(2, "0") + "T12:00:00.000Z"));
      await recalculerAgregat(pointAId, jour);
      await recalculerAgregat(pointBId, jour);
    }
  }, 120000);

  it("exporte 1 000 avis en Excel en moins de 10 secondes, accents corrects (scenario 10)", async () => {
    const debut = Date.now();
    const { reponse, contenu } = await exporter(agentResponsable, { format: "xlsx", filtres: PERIODE_AOUT });
    const duree = Date.now() - debut;
    console.log("Excel, " + String(NOMBRE_AVIS_AOUT) + " avis : " + String(duree) + " ms");

    expect(reponse.status).toBe(200);
    expect(duree).toBeLessThan(DUREE_MAX_MS);

    const classeur = await lireClasseur(contenu);
    const feuille = classeur.getWorksheet("Avis");
    if (!feuille) throw new Error("Feuille Avis absente.");
    expect(feuille.rowCount).toBe(1 + NOMBRE_AVIS_AOUT);
    expect(valeursLigne(feuille, 1)).toEqual(ENTETES_FR);

    const commentaires = new Set<unknown>();
    for (let numero = 2; numero <= 40; numero += 1) {
      commentaires.add(valeursLigne(feuille, numero)[12]);
    }
    expect([...commentaires].some((texte) => typeof texte === "string" && texte.includes("Très bon accueil, café délicieux à Lomé"))).toBe(true);

    // La feuille Analyse travaille sur les 1 000 avis.
    const analyse = classeur.getWorksheet("Analyse");
    expect(analyse).toBeDefined();
    expect(String(analyse?.getRow(3).getCell(1).value ?? "")).toContain("Résumé");
    expect(String(analyse?.getRow(4).getCell(1).value ?? "")).toContain("1000 avis");
  }, 60000);

  it("exporte aussi le csv et le rapport pdf sans attendre", async () => {
    const debutCsv = Date.now();
    const csv = await exporter(agentResponsable, { format: "csv", filtres: PERIODE_AOUT });
    const dureeCsv = Date.now() - debutCsv;
    expect(lignesCsv(csv.contenu)).toHaveLength(1 + NOMBRE_AVIS_AOUT);
    expect(dureeCsv).toBeLessThan(DUREE_MAX_MS);

    const debutPdf = Date.now();
    const pdf = await exporter(agentResponsable, { format: "pdf", filtres: PERIODE_AOUT });
    const dureePdf = Date.now() - debutPdf;
    console.log("Csv : " + String(dureeCsv) + " ms, pdf : " + String(dureePdf) + " ms");
    expect(pdf.reponse.status).toBe(200);
    expect(pdf.contenu.toString("latin1").startsWith("%PDF-")).toBe(true);
    expect(dureePdf).toBeLessThan(DUREE_MAX_MS);
  }, 60000);
});