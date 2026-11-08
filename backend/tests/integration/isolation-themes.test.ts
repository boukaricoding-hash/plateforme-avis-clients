import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Themes du secteur (jour 19) : GET /api/v1/questionnaires/themes.
// Chaque organisation ne voit que les themes de SON secteur, et ne peut pas rattacher une
// question a un theme d'un autre secteur. Le test cree lui-meme ses deux secteurs et leurs
// themes : il ne depend pas des donnees de depart.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Themes-2026";

type Agent = ReturnType<typeof request.agent>;

type ThemeCree = { id: string; code: string };

type OrganisationDeTest = {
  secteurId: string;
  organisationId: string;
  utilisateurIds: string[];
  // Themes dans l'ordre que l'API doit renvoyer (ordre croissant, puis code).
  themes: ThemeCree[];
  responsable: Agent;
  gestionnaire: Agent;
};

type ThemeRenvoye = { id: string; code: string; libelle_fr: string; libelle_en: string };

// Themes de A : crees volontairement dans le desordre, avec deux themes de meme ordre.
const THEMES_A = [
  { code: "a-accueil", ordre: 1 },
  { code: "b-delai", ordre: 2 },
  { code: "c-prix", ordre: 2 },
];
const THEMES_B = [{ code: "x-autre-secteur", ordre: 1 }];

async function creerUtilisateurConnecte(
  organisationId: string,
  lettre: string,
  etiquette: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
): Promise<{ id: string; agent: Agent }> {
  const email = etiquette + "-" + lettre.toLowerCase() + "-" + suffixe + "@test-themes.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: etiquette + " " + lettre,
      role,
      organisation_id: organisationId,
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

async function creerOrganisationDeTest(
  lettre: "A" | "B",
  definitions: { code: string; ordre: number }[],
): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.create({
    data: {
      code: "test-themes-" + lettre.toLowerCase() + "-" + suffixe,
      nom_fr: "Secteur test themes " + lettre,
      nom_en: "Theme test sector " + lettre,
    },
    select: { id: true },
  });

  // Creation a l'envers : l'ordre renvoye ne doit pas dependre de l'ordre d'insertion.
  const identifiants = new Map<string, string>();
  for (const definition of [...definitions].reverse()) {
    const theme = await prisma.theme.create({
      data: {
        secteur_id: secteur.id,
        code: definition.code,
        libelle_fr: "Libelle fr " + definition.code,
        libelle_en: "Label en " + definition.code,
        ordre: definition.ordre,
      },
      select: { id: true },
    });
    identifiants.set(definition.code, theme.id);
  }
  const themes = definitions.map((definition) => {
    const id = identifiants.get(definition.code);
    if (id === undefined) {
      throw new Error("Theme de test non cree : " + definition.code);
    }
    return { id, code: definition.code };
  });

  const organisation = await prisma.organisation.create({
    data: {
      nom: "TEST-THEMES-" + lettre + "-" + suffixe,
      secteur_id: secteur.id,
      statut: "ACTIF",
    },
    select: { id: true },
  });

  const responsable = await creerUtilisateurConnecte(organisation.id, lettre, "responsable", "RESPONSABLE");
  const gestionnaire = await creerUtilisateurConnecte(organisation.id, lettre, "gestionnaire", "GESTIONNAIRE");

  return {
    secteurId: secteur.id,
    organisationId: organisation.id,
    utilisateurIds: [responsable.id, gestionnaire.id],
    themes,
    responsable: responsable.agent,
    gestionnaire: gestionnaire.agent,
  };
}

let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;

beforeAll(async () => {
  orgA = await creerOrganisationDeTest("A", THEMES_A);
  orgB = await creerOrganisationDeTest("B", THEMES_B);
}, 60000);

afterAll(async () => {
  const organisations = [orgA, orgB].filter((org): org is OrganisationDeTest => org !== undefined);
  const organisationIds = organisations.map((org) => org.organisationId);
  const utilisateurIds = organisations.flatMap((org) => org.utilisateurIds);
  const secteurIds = organisations.map((org) => org.secteurId);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.theme.deleteMany({ where: { secteur_id: { in: secteurIds } } });
  await prisma.secteur.deleteMany({ where: { id: { in: secteurIds } } });
  await prisma.$disconnect();
}, 30000);

async function lireLesThemes(agent: Agent): Promise<ThemeRenvoye[]> {
  const reponse = await agent.get("/api/v1/questionnaires/themes").expect(200);
  return reponse.body.themes as ThemeRenvoye[];
}

describe("themes : chaque organisation voit les themes de son secteur", () => {
  it("le Responsable de A recoit ses 3 themes, tries par ordre puis par code", async () => {
    // Un 200 avec { themes } prouve aussi que le mot themes n est pas lu comme un identifiant (/:id).
    const themes = await lireLesThemes(orgA.responsable);
    expect(themes.map((theme) => theme.code)).toEqual(orgA.themes.map((theme) => theme.code));
    expect(themes.map((theme) => theme.id)).toEqual(orgA.themes.map((theme) => theme.id));
  });

  it("chaque theme ne contient que id, code, libelle_fr et libelle_en", async () => {
    const themes = await lireLesThemes(orgA.responsable);
    const premier = themes[0];
    expect(premier).toBeDefined();
    expect(Object.keys(premier ?? {}).sort()).toEqual(["code", "id", "libelle_en", "libelle_fr"]);
    expect(premier?.libelle_fr).toBe("Libelle fr a-accueil");
    expect(premier?.libelle_en).toBe("Label en a-accueil");
  });

  it("le Responsable de B ne recoit que le theme de son secteur", async () => {
    const themes = await lireLesThemes(orgB.responsable);
    expect(themes.map((theme) => theme.code)).toEqual(["x-autre-secteur"]);
  });

  it("aucun theme d'une organisation n'apparait chez l'autre", async () => {
    const identifiantsA = (await lireLesThemes(orgA.responsable)).map((theme) => theme.id);
    const identifiantsB = (await lireLesThemes(orgB.responsable)).map((theme) => theme.id);
    for (const theme of orgB.themes) {
      expect(identifiantsA).not.toContain(theme.id);
    }
    for (const theme of orgA.themes) {
      expect(identifiantsB).not.toContain(theme.id);
    }
  });
});

describe("themes : acces a la route", () => {
  it("sans connexion : 401", async () => {
    await request(app).get("/api/v1/questionnaires/themes").expect(401);
  });

  it("le Gestionnaire est refuse : 403", async () => {
    await orgA.gestionnaire.get("/api/v1/questionnaires/themes").expect(403);
  });
});

describe("themes : un theme d'un autre secteur est refuse a l'enregistrement", () => {
  it("A ne peut pas creer un questionnaire avec un theme de B (400, rien de cree)", async () => {
    const themeDeB = orgB.themes[0];
    expect(themeDeB).toBeDefined();

    const reponse = await orgA.responsable
      .post("/api/v1/questionnaires")
      .send({
        titre: { fr: "Questionnaire theme interdit" },
        questions: [{ type: "ETOILES", libelle: { fr: "Note ?" }, theme_id: themeDeB?.id }],
      })
      .expect(400);
    expect(reponse.body.code).toBe("DONNEES_INVALIDES");

    const nombre = await prisma.questionnaire.count({ where: { organisation_id: orgA.organisationId } });
    expect(nombre).toBe(0);
  });
});