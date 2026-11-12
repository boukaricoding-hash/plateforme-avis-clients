import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";
import { NOM_COOKIE_SESSION } from "../../src/modules/authentification/services/sessions";

// Jour 22 : acces aux routes du back-office DTS (/api/v1/admin/organisations et /api/v1/admin/secteurs).
// - visiteur sans cookie ou avec un faux cookie : 401 sur les 14 routes ;
// - Responsable et Gestionnaire : 403 sur les 14 routes, et rien ne change en base ;
// - l'administrateur DTS passe (controle positif) et la reponse ne laisse rien sortir d'interne.
// Les routes creer / modifier / suspendre sont testees a fond dans admin-organisations.test.ts et admin-secteurs.test.ts.
// Prerequis : le seed a ete lance (secteur restauration et ses themes).
// Attention : la connexion est limitee a 10 essais par minute.
// Ce fichier en fait 4 : il ne faut pas en ajouter sans en retirer.
// Les deux organisations de test et tous les comptes sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Admin-2026";
const PREFIXE_NOM = "TEST-ISOLATION-ADMIN-";

type Agent = ReturnType<typeof request.agent>;
type Methode = "get" | "post" | "patch";
type Route = { methode: Methode; chemin: string; corps?: Record<string, unknown> };

let motDePasseHash: string;
let adminId: string;
let orgAId: string;
let orgBId: string;
let responsableAId: string;
let gestionnaireAId: string;
let responsableBId: string;
let secteurRestaurationId: string;
let themeRestaurationId: string;

let agentAdmin: Agent;
let agentResponsableA: Agent;
let agentGestionnaireA: Agent;
let agentResponsableB: Agent;
let routesAdmin: Route[] = [];

function adresse(etiquette: string): string {
  return etiquette + "-" + suffixe + "@test-isolation-admin.local";
}

async function connecterAgent(email: string, motDePasse: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: motDePasse, se_souvenir: false })
    .expect(200);
  return agent;
}

async function creerCompte(
  etiquette: string,
  role: "ADMINISTRATEUR" | "RESPONSABLE" | "GESTIONNAIRE",
  organisationId: string | null,
): Promise<string> {
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email: adresse(etiquette),
      mot_de_passe_hash: motDePasseHash,
      nom: "Test " + etiquette,
      role,
      ...(organisationId ? { organisation_id: organisationId } : {}),
    },
    select: { id: true },
  });
  return utilisateur.id;
}

async function creerOrganisation(lettre: "A" | "B"): Promise<string> {
  const organisation = await prisma.organisation.create({
    data: {
      nom: PREFIXE_NOM + lettre + "-" + suffixe,
      secteur_id: secteurRestaurationId,
      statut: "ACTIF",
    },
    select: { id: true },
  });
  return organisation.id;
}

// Les 14 routes du back-office, avec des corps valides : si l'acces etait ouvert, elles feraient vraiment quelque chose.
function listerRoutesAdmin(): Route[] {
  const orgs = "/api/v1/admin/organisations";
  const secteurs = "/api/v1/admin/secteurs";
  return [
    { methode: "get", chemin: orgs },
    {
      methode: "post",
      chemin: orgs,
      corps: { nom: PREFIXE_NOM + "PIRATE-" + suffixe, secteur_id: secteurRestaurationId, statut: "ACTIF" },
    },
    { methode: "get", chemin: orgs + "/" + orgBId },
    { methode: "patch", chemin: orgs + "/" + orgBId, corps: { nom: PREFIXE_NOM + "MODIFIE-" + suffixe } },
    { methode: "post", chemin: orgs + "/" + orgBId + "/suspendre" },
    { methode: "post", chemin: orgs + "/" + orgBId + "/reactiver" },
    {
      methode: "post",
      chemin: orgs + "/" + orgBId + "/inviter-responsable",
      corps: { email: adresse("pirate") },
    },
    { methode: "get", chemin: secteurs },
    {
      methode: "post",
      chemin: secteurs,
      corps: {
        code: "pirate_" + suffixe,
        nom_fr: "Secteur pirate",
        nom_en: "Pirate sector",
        vocabulaire: { point_contact: "table" },
      },
    },
    { methode: "get", chemin: secteurs + "/" + secteurRestaurationId },
    { methode: "patch", chemin: secteurs + "/" + secteurRestaurationId, corps: { nom_fr: "Restauration piratée" } },
    {
      methode: "post",
      chemin: secteurs + "/" + secteurRestaurationId + "/themes",
      corps: { code: "theme_pirate_" + suffixe, libelle_fr: "Thème pirate", libelle_en: "Pirate theme" },
    },
    {
      methode: "patch",
      chemin: secteurs + "/" + secteurRestaurationId + "/themes/" + themeRestaurationId,
      corps: { libelle_fr: "Thème piraté" },
    },
    { methode: "get", chemin: secteurs + "/" + secteurRestaurationId + "/questionnaires-types" },
  ];
}

async function appeler(agent: Agent, route: Route) {
  const requete = agent[route.methode](route.chemin);
  return route.corps ? requete.send(route.corps) : requete;
}

function decrire(route: Route): string {
  return route.methode.toUpperCase() + " " + route.chemin.replace("/api/v1", "");
}

// Photo de la base avant et apres les tentatives du Responsable : tout doit rester identique.
async function photoDeLaBase() {
  const [organisationB, secteur, theme, organisationsTest, secteurs, themes, invitations, audits] =
    await Promise.all([
      prisma.organisation.findUniqueOrThrow({
        where: { id: orgBId },
        select: { nom: true, statut: true, modifie_le: true },
      }),
      prisma.secteur.findUniqueOrThrow({
        where: { id: secteurRestaurationId },
        select: { nom_fr: true, nom_en: true, vocabulaire: true, indicateurs_suggeres: true, actif: true },
      }),
      prisma.theme.findUniqueOrThrow({
        where: { id: themeRestaurationId },
        select: { libelle_fr: true, libelle_en: true, ordre: true },
      }),
      prisma.organisation.count({ where: { nom: { startsWith: PREFIXE_NOM } } }),
      prisma.secteur.count(),
      prisma.theme.count({ where: { secteur_id: secteurRestaurationId } }),
      prisma.jetonInvitation.count({ where: { organisation_id: { in: [orgAId, orgBId] } } }),
      prisma.auditLog.count({
        where: { organisation_id: { in: [orgAId, orgBId] }, action: { startsWith: "ORGANISATION_" } },
      }),
    ]);
  return { organisationB, secteur, theme, organisationsTest, secteurs, themes, invitations, audits };
}

beforeAll(async () => {
  motDePasseHash = await hash(MOT_DE_PASSE, 4);

  const secteur = await prisma.secteur.findUniqueOrThrow({
    where: { code: "restauration" },
    select: { id: true },
  });
  secteurRestaurationId = secteur.id;
  const theme = await prisma.theme.findFirstOrThrow({
    where: { secteur_id: secteurRestaurationId },
    orderBy: { ordre: "asc" },
    select: { id: true },
  });
  themeRestaurationId = theme.id;

  orgAId = await creerOrganisation("A");
  orgBId = await creerOrganisation("B");

  adminId = await creerCompte("admin", "ADMINISTRATEUR", null);
  responsableAId = await creerCompte("responsable-a", "RESPONSABLE", orgAId);
  gestionnaireAId = await creerCompte("gestionnaire-a", "GESTIONNAIRE", orgAId);
  responsableBId = await creerCompte("responsable-b", "RESPONSABLE", orgBId);

  agentAdmin = await connecterAgent(adresse("admin"), MOT_DE_PASSE);
  agentResponsableA = await connecterAgent(adresse("responsable-a"), MOT_DE_PASSE);
  agentGestionnaireA = await connecterAgent(adresse("gestionnaire-a"), MOT_DE_PASSE);
  agentResponsableB = await connecterAgent(adresse("responsable-b"), MOT_DE_PASSE);

  routesAdmin = listerRoutesAdmin();
}, 30000);

afterAll(async () => {
  const organisationIds = [orgAId, orgBId].filter((id): id is string => id !== undefined);
  const utilisateurIds = [adminId, responsableAId, gestionnaireAId, responsableBId].filter(
    (id): id is string => id !== undefined,
  );

  // Si l'acces etait ouvert par erreur, ces restes de test ne doivent pas rester en base.
  await prisma.theme.deleteMany({ where: { code: "theme_pirate_" + suffixe } });
  await prisma.secteur.deleteMany({ where: { code: "pirate_" + suffixe } });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.jetonInvitation.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 30000);

describe("isolation admin : visiteur non connecte", () => {
  it("les 14 routes du back-office refusent un visiteur sans cookie (401) et un faux cookie (401)", async () => {
    expect(routesAdmin).toHaveLength(14);

    for (const route of routesAdmin) {
      const sansCookie = await appeler(request.agent(app), route);
      expect(sansCookie.status, decrire(route) + " sans cookie").toBe(401);
      expect(sansCookie.body.code).toBe("NON_CONNECTE");

      const fauxCookie = request.agent(app);
      const requete = fauxCookie[route.methode](route.chemin).set("Cookie", NOM_COOKIE_SESSION + "=jeton-invente");
      const avecFauxCookie = await (route.corps ? requete.send(route.corps) : requete);
      expect(avecFauxCookie.status, decrire(route) + " avec faux cookie").toBe(401);
    }
  });
});

describe("isolation admin : Responsable et Gestionnaire", () => {
  it("un Responsable et un Gestionnaire recoivent 403 sur les 14 routes, et la base ne change pas", async () => {
    const avant = await photoDeLaBase();

    for (const route of routesAdmin) {
      for (const [nom, agent] of [
        ["Responsable A", agentResponsableA],
        ["Gestionnaire A", agentGestionnaireA],
        ["Responsable B", agentResponsableB],
      ] as const) {
        const reponse = await appeler(agent, route);
        expect(reponse.status, nom + " : " + decrire(route)).toBe(403);
        expect(reponse.body.code).toBe("ACCES_REFUSE");
        // Le refus ne contient aucune donnee de l'organisation ni du secteur
        expect(reponse.body).not.toHaveProperty("organisation");
        expect(reponse.body).not.toHaveProperty("organisations");
        expect(reponse.body).not.toHaveProperty("secteur");
        expect(reponse.body).not.toHaveProperty("secteurs");
      }
    }

    // Rien n'a bouge : ni organisation creee, ni statut, ni secteur, ni theme, ni invitation, ni journal
    const apres = await photoDeLaBase();
    expect(apres).toEqual(avant);
    expect(apres.organisationB.statut).toBe("ACTIF");
  });
});

describe("isolation admin : administrateur DTS", () => {
  it("l'administrateur passe sur la lecture, et la reponse ne contient rien d'interne", async () => {
    // Controle positif : les 403 plus haut viennent bien du role, pas d'une route cassee.
    const liste = await agentAdmin
      .get("/api/v1/admin/organisations")
      .query({ q: PREFIXE_NOM + "A-" + suffixe })
      .expect(200);
    expect(liste.body.organisations).toHaveLength(1);
    expect(liste.body.organisations[0].id).toBe(orgAId);

    const lecture = await agentAdmin.get("/api/v1/admin/organisations/" + orgBId).expect(200);
    expect(lecture.body.organisation.id).toBe(orgBId);
    expect(lecture.body.organisation.statut).toBe("ACTIF");

    await agentAdmin.get("/api/v1/admin/secteurs/" + secteurRestaurationId).expect(200);
    await agentAdmin
      .get("/api/v1/admin/secteurs/" + secteurRestaurationId + "/questionnaires-types")
      .expect(200);

    // Aucun compte, mot de passe, session ni champ interne dans les reponses de l'administrateur
    const texte = JSON.stringify([liste.body, lecture.body]);
    expect(texte).not.toContain("mot_de_passe");
    expect(texte).not.toContain("supprime_le");
    expect(texte).not.toContain("seuil_alerte");
    expect(texte).not.toContain(adresse("responsable-a"));
    expect(texte).not.toContain(adresse("responsable-b"));
  });

  it("une organisation inconnue donne 404 a l'administrateur, et la liste ne montre que les organisations du filtre", async () => {
    const inconnue = "00000000-0000-4000-8000-000000000000";
    await agentAdmin.get("/api/v1/admin/organisations/" + inconnue).expect(404);
    await agentAdmin.post("/api/v1/admin/organisations/" + inconnue + "/suspendre").expect(404);

    // Le filtre q ne renvoie que les deux organisations de ce test, aucune autre
    const liste = await agentAdmin
      .get("/api/v1/admin/organisations")
      .query({ q: PREFIXE_NOM, limite: 100 })
      .expect(200);
    const ids = (liste.body.organisations as { id: string }[]).map((organisation) => organisation.id).sort();
    expect(ids).toEqual([orgAId, orgBId].sort());
  });
});