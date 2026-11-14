import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";
import { ACTIONS_ERREUR } from "../../src/modules/administration/services/vue-globale";

// Jour 24 : journal d'audit (GET /api/v1/admin/journal-audit) et vue globale E19 (GET /api/v1/admin/vue-globale).
// Journal :
// - liste du plus recent au plus ancien, avec l'e-mail de l'auteur et le nom de l'organisation ;
// - filtres : action, utilisateur (morceau d'e-mail), periode (bornes comprises), organisation ;
// - pagination ; aucune adresse IP, aucun mot de passe ni jeton dans les details ;
// - filtres invalides refuses (400) ; visiteur 401, Responsable 403.
// Vue globale : organisations par statut, utilisateurs par role, avis par jour (30 jours), erreurs recentes.
// Les controles d'acces de toutes les routes admin sont aussi dans isolation-admin.test.ts.
// Prerequis : le seed a ete lance (secteur restauration).
// Attention : la connexion est limitee a 10 essais par minute.
// Ce fichier en fait 3 (administrateur, Responsable, un echec volontaire) : il ne faut pas en ajouter sans en retirer.
// Les comptes qui se connectent sont dans l'organisation en essai : leurs lignes de journal ne se melangent pas a celles de l'organisation A.
// D'autres fichiers de test tournent en meme temps sur la meme base : les chiffres globaux sont donc
// verifies avec "au moins" ce que ce fichier a ecrit ; le journal est lu avec le filtre de nos organisations.
// Les organisations, comptes, lignes de journal et agregats de test sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Journal-Vue-Globale-2026";
const PREFIXE_NOM = "TEST-JOURNAL-";
const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;

type Agent = ReturnType<typeof request.agent>;
type EntreeJournal = {
  id: string;
  action: string;
  entite: string | null;
  entite_id: string | null;
  details: Record<string, unknown> | null;
  cree_le: string;
  utilisateur: { id: string; email: string; nom: string; role: string } | null;
  organisation: { id: string; nom: string } | null;
};
type EntreeErreur = {
  id: string;
  action: string;
  cree_le: string;
  utilisateur_email: string | null;
  organisation: { id: string; nom: string } | null;
};

let motDePasseHash: string;
let adminId: string;
let responsableId: string;
let gestionnaireId: string;
let connecteId: string;
let echecId: string;
let orgAId: string;
let orgBId: string;
let orgEssaiId: string;
let orgSuspendueId: string;
let siteId: string;
let pointId: string;
let agentAdmin: Agent;
let agentResponsable: Agent;

// Les lignes du journal de l'organisation A, de la plus recente a la plus ancienne (ordre attendu a l'ecran)
const ACTIONS_ATTENDUES_A = [
  "CONNEXION_REUSSIE",
  "AVIS_STATUT_MODIFIE",
  "UTILISATEUR_DESACTIVE",
  "EXPORT_GENERE",
  "QR_REVOQUE",
  "CONNEXION_REUSSIE",
];

const TEXTE_TROP_LONG = "x".repeat(300);

function adresse(etiquette: string): string {
  return etiquette + "-" + suffixe + "@test-journal.local";
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

async function creerOrganisation(etiquette: string, statut: "ESSAI" | "ACTIF" | "SUSPENDU"): Promise<string> {
  const secteur = await prisma.secteur.findUniqueOrThrow({
    where: { code: "restauration" },
    select: { id: true },
  });
  const organisation = await prisma.organisation.create({
    data: { nom: PREFIXE_NOM + etiquette + "-" + suffixe, secteur_id: secteur.id, statut },
    select: { id: true },
  });
  return organisation.id;
}

// Minuit UTC du jour, decale de n jours (n negatif = dans le passe)
function jourTexte(decalage: number): string {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const minuit = Date.parse(aujourdhui + "T00:00:00.000Z");
  return new Date(minuit + decalage * UN_JOUR_EN_MS).toISOString().slice(0, 10);
}

async function ecrireAgregat(decalage: number, nbAvis: number): Promise<void> {
  await prisma.agregatQuotidien.create({
    data: {
      organisation_id: orgAId,
      site_id: siteId,
      point_contact_id: pointId,
      date: new Date(jourTexte(decalage) + "T00:00:00.000Z"),
      nb_avis: nbAvis,
    },
  });
}

async function lireJournalA(requete: string = "") {
  return agentAdmin.get("/api/v1/admin/journal-audit?organisation=" + orgAId + requete);
}

beforeAll(async () => {
  motDePasseHash = await hash(MOT_DE_PASSE, 4);

  orgAId = await creerOrganisation("A", "ACTIF");
  orgBId = await creerOrganisation("B", "ACTIF");
  orgEssaiId = await creerOrganisation("ESSAI", "ESSAI");
  orgSuspendueId = await creerOrganisation("SUSPENDUE", "SUSPENDU");

  adminId = await creerCompte("admin", "ADMINISTRATEUR", null);
  responsableId = await creerCompte("responsable-a", "RESPONSABLE", orgAId);
  gestionnaireId = await creerCompte("gestionnaire-a", "GESTIONNAIRE", orgAId);
  // Comptes qui se connectent : dans l'organisation en essai, jamais dans A (leurs lignes de journal fausseraient les totaux de A)
  connecteId = await creerCompte("responsable-essai", "RESPONSABLE", orgEssaiId);
  echecId = await creerCompte("gestionnaire-essai", "GESTIONNAIRE", orgEssaiId);

  const site = await prisma.site.create({
    data: { organisation_id: orgAId, nom: "Site journal " + suffixe },
    select: { id: true },
  });
  siteId = site.id;
  const point = await prisma.pointContact.create({
    data: {
      organisation_id: orgAId,
      site_id: siteId,
      nom: "Table journal",
      type: "table",
      code_public: randomBytes(9).toString("base64url"),
    },
    select: { id: true },
  });
  pointId = point.id;

  // Six lignes pour l'organisation A, dates fixes dans le passe (les filtres de periode sont ainsi exacts)
  await prisma.auditLog.createMany({
    data: [
      {
        organisation_id: orgAId,
        utilisateur_id: responsableId,
        action: "CONNEXION_REUSSIE",
        ip: "203.0.113.10",
        cree_le: new Date("2026-03-10T09:00:00.000Z"),
      },
      {
        organisation_id: orgAId,
        utilisateur_id: responsableId,
        action: "QR_REVOQUE",
        entite: "point_contact",
        entite_id: pointId,
        // L'objet imbrique n'est pas montre : seules les valeurs simples le sont
        details: { motif: "perdu", imbrique: { a: 1 } },
        cree_le: new Date("2026-03-11T00:00:00.000Z"),
      },
      {
        organisation_id: orgAId,
        utilisateur_id: responsableId,
        action: "EXPORT_GENERE",
        details: {
          format: "csv",
          nb_lignes: 12,
          avec_notes: true,
          mot_de_passe: "mot-de-passe-a-ne-pas-montrer",
          jeton_acces: "jeton-a-ne-pas-montrer",
          token_session: "token-a-ne-pas-montrer",
          secret_api: "secret-a-ne-pas-montrer",
          commentaire: TEXTE_TROP_LONG,
        },
        cree_le: new Date("2026-03-11T23:59:59.000Z"),
      },
      {
        organisation_id: orgAId,
        utilisateur_id: adminId,
        action: "UTILISATEUR_DESACTIVE",
        // Que des cles interdites : il ne reste rien a montrer
        details: { mot_de_passe_hash: "hash-a-ne-pas-montrer" },
        cree_le: new Date("2026-03-12T12:00:00.000Z"),
      },
      {
        organisation_id: orgAId,
        utilisateur_id: gestionnaireId,
        action: "AVIS_STATUT_MODIFIE",
        cree_le: new Date("2026-03-13T00:00:00.000Z"),
      },
      {
        organisation_id: orgAId,
        utilisateur_id: gestionnaireId,
        action: "CONNEXION_REUSSIE",
        cree_le: new Date("2026-03-15T08:00:00.000Z"),
      },
      // Une ligne d'une autre organisation, sans auteur
      {
        organisation_id: orgBId,
        action: "CONNEXION_REUSSIE",
        cree_le: new Date("2026-03-12T10:00:00.000Z"),
      },
    ],
  });

  agentAdmin = await connecterAgent(adresse("admin"), MOT_DE_PASSE);
  agentResponsable = await connecterAgent(adresse("responsable-essai"), MOT_DE_PASSE);
}, 60000);

afterAll(async () => {
  const organisationIds = [orgAId, orgBId, orgEssaiId, orgSuspendueId].filter((id): id is string => Boolean(id));
  const utilisateurIds = [adminId, responsableId, gestionnaireId, connecteId, echecId].filter((id): id is string => Boolean(id));

  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ organisation_id: { in: organisationIds } }, { utilisateur_id: { in: utilisateurIds } }],
    },
  });
  await prisma.agregatQuotidien.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.pointContact.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  await prisma.$disconnect();
}, 60000);

// ------------------------------------------------------------
// Journal d'audit
// ------------------------------------------------------------

describe("journal d'audit : lecture", () => {
  it("liste les lignes de la plus recente a la plus ancienne, avec l'auteur et l'organisation", async () => {
    const reponse = await lireJournalA();
    expect(reponse.status).toBe(200);
    expect(reponse.body.pagination).toEqual({ page: 1, limite: 20, total: 6, pages: 1 });

    const entrees = reponse.body.entrees as EntreeJournal[];
    expect(entrees.map((entree) => entree.action)).toEqual(ACTIONS_ATTENDUES_A);

    const premiere = entrees[0];
    expect(premiere?.utilisateur?.email).toBe(adresse("gestionnaire-a"));
    expect(premiere?.utilisateur?.role).toBe("GESTIONNAIRE");
    expect(premiere?.organisation?.nom).toBe(PREFIXE_NOM + "A-" + suffixe);
    expect(premiere?.cree_le).toBe("2026-03-15T08:00:00.000Z");

    // Les champs de la ligne sont bien rendus
    const revocation = entrees.find((entree) => entree.action === "QR_REVOQUE");
    expect(revocation?.entite).toBe("point_contact");
    expect(revocation?.entite_id).toBe(pointId);
  });

  it("ne montre jamais l'adresse IP ni le mot de passe de l'auteur", async () => {
    const reponse = await lireJournalA();
    const texte = JSON.stringify(reponse.body);
    expect(texte).not.toContain("203.0.113.10");
    expect(texte).not.toContain(motDePasseHash);
    for (const entree of reponse.body.entrees as EntreeJournal[]) {
      expect(entree).not.toHaveProperty("ip");
      expect(entree.utilisateur ?? {}).not.toHaveProperty("mot_de_passe_hash");
    }
  });

  it("garde dans les details seulement les valeurs simples et sans secret", async () => {
    const reponse = await lireJournalA("&action=EXPORT_GENERE");
    expect(reponse.status).toBe(200);
    expect(reponse.body.entrees).toHaveLength(1);

    const details = reponse.body.entrees[0].details as Record<string, unknown>;
    expect(Object.keys(details).sort()).toEqual(["avec_notes", "commentaire", "format", "nb_lignes"]);
    expect(details["format"]).toBe("csv");
    expect(details["nb_lignes"]).toBe(12);
    expect(details["avec_notes"]).toBe(true);
    // Un texte trop long est coupe (200 caracteres puis "...")
    expect(details["commentaire"]).toBe("x".repeat(200) + "...");

    const texte = JSON.stringify(reponse.body);
    expect(texte).not.toContain("a-ne-pas-montrer");
  });

  it("retire l'objet imbrique, et met details a null quand il ne reste rien", async () => {
    const revocation = await lireJournalA("&action=QR_REVOQUE");
    expect(revocation.body.entrees[0].details).toEqual({ motif: "perdu" });

    const desactivation = await lireJournalA("&action=UTILISATEUR_DESACTIVE");
    expect(desactivation.body.entrees[0].details).toBeNull();
    expect(JSON.stringify(desactivation.body)).not.toContain("hash-a-ne-pas-montrer");

    // Ligne sans details en base
    const statut = await lireJournalA("&action=AVIS_STATUT_MODIFIE");
    expect(statut.body.entrees[0].details).toBeNull();
  });

  it("montre une ligne sans auteur (utilisateur a null)", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/journal-audit?organisation=" + orgBId);
    expect(reponse.status).toBe(200);
    expect(reponse.body.pagination.total).toBe(1);
    expect(reponse.body.entrees[0].utilisateur).toBeNull();
    expect(reponse.body.entrees[0].organisation.nom).toBe(PREFIXE_NOM + "B-" + suffixe);
  });
});

describe("journal d'audit : filtres et pagination", () => {
  it("filtre par action", async () => {
    const reponse = await lireJournalA("&action=CONNEXION_REUSSIE");
    expect(reponse.status).toBe(200);
    expect(reponse.body.pagination.total).toBe(2);
    for (const entree of reponse.body.entrees as EntreeJournal[]) {
      expect(entree.action).toBe("CONNEXION_REUSSIE");
    }
  });

  it("filtre par utilisateur : morceau d'e-mail, sans tenir compte des majuscules", async () => {
    const motif = ("responsable-a-" + suffixe).toUpperCase();
    const reponse = await lireJournalA("&utilisateur=" + motif);
    expect(reponse.status).toBe(200);
    expect(reponse.body.pagination.total).toBe(3);
    for (const entree of reponse.body.entrees as EntreeJournal[]) {
      expect(entree.utilisateur?.email).toBe(adresse("responsable-a"));
    }
  });

  it("filtre par periode : jours complets, bornes comprises", async () => {
    // Du 11 mars (minuit pile) au 12 mars : on garde le 11 a 00:00:00, le 11 a 23:59:59 et le 12 a midi,
    // et on exclut le 13 mars a 00:00:00.
    const reponse = await lireJournalA("&du=2026-03-11&au=2026-03-12");
    expect(reponse.status).toBe(200);
    expect(reponse.body.entrees.map((entree: { action: string }) => entree.action)).toEqual([
      "UTILISATEUR_DESACTIVE",
      "EXPORT_GENERE",
      "QR_REVOQUE",
    ]);

    // Un seul des deux bornes
    const depuis = await lireJournalA("&du=2026-03-13");
    expect(depuis.body.pagination.total).toBe(2);
    const jusque = await lireJournalA("&au=2026-03-10");
    expect(jusque.body.pagination.total).toBe(1);
    expect(jusque.body.entrees[0].action).toBe("CONNEXION_REUSSIE");
  });

  it("combine les filtres", async () => {
    const reponse = await lireJournalA("&action=CONNEXION_REUSSIE&du=2026-03-11");
    expect(reponse.status).toBe(200);
    expect(reponse.body.pagination.total).toBe(1);
    expect(reponse.body.entrees[0].utilisateur.email).toBe(adresse("gestionnaire-a"));
  });

  it("filtre par organisation : une organisation ne voit pas les lignes d'une autre", async () => {
    const reponse = await lireJournalA();
    for (const entree of reponse.body.entrees as EntreeJournal[]) {
      expect(entree.organisation?.id).toBe(orgAId);
    }
  });

  it("pagine : deux pages qui, mises bout a bout, donnent la liste complete", async () => {
    const complete = await lireJournalA();
    const idsComplets = (complete.body.entrees as Array<{ id: string }>).map((entree) => entree.id);

    const page1 = await lireJournalA("&limite=4&page=1");
    const page2 = await lireJournalA("&limite=4&page=2");
    expect(page1.body.pagination).toEqual({ page: 1, limite: 4, total: 6, pages: 2 });
    expect(page2.body.pagination).toEqual({ page: 2, limite: 4, total: 6, pages: 2 });
    expect(page1.body.entrees).toHaveLength(4);
    expect(page2.body.entrees).toHaveLength(2);

    const ids = [...page1.body.entrees, ...page2.body.entrees].map((entree: { id: string }) => entree.id);
    expect(ids).toEqual(idsComplets);

    // Une page au-dela de la fin est vide, sans erreur
    const page9 = await lireJournalA("&limite=4&page=9");
    expect(page9.status).toBe(200);
    expect(page9.body.entrees).toEqual([]);
  });

  it("refuse les filtres invalides (400)", async () => {
    const mauvaisFiltres = [
      "action=ACTION_INCONNUE",
      "organisation=pas-un-identifiant",
      "du=2026-13-45",
      "du=2026-03-12&au=2026-03-11",
      "limite=101",
      "limite=0",
      "page=0",
      "page=abc",
      "utilisateur=",
    ];
    for (const filtre of mauvaisFiltres) {
      const reponse = await agentAdmin.get("/api/v1/admin/journal-audit?" + filtre);
      expect(reponse.status, filtre).toBe(400);
      expect(reponse.body.code, filtre).toBe("DONNEES_INVALIDES");
    }
  });
});

describe("journal d'audit : acces", () => {
  it("visiteur : 401 ; Responsable : 403 ; administrateur : 200", async () => {
    const visiteur = await request(app).get("/api/v1/admin/journal-audit");
    expect(visiteur.status).toBe(401);

    const responsable = await agentResponsable.get("/api/v1/admin/journal-audit");
    expect(responsable.status).toBe(403);
    expect(responsable.body.code).toBe("ACCES_REFUSE");

    const admin = await agentAdmin.get("/api/v1/admin/journal-audit");
    expect(admin.status).toBe(200);
  });

  it("aucune route d'ecriture sur le journal", async () => {
    for (const methode of ["post", "patch", "put", "delete"] as const) {
      const reponse = await agentAdmin[methode]("/api/v1/admin/journal-audit").send({});
      expect(reponse.status, methode).toBe(404);
    }
  });
});

// ------------------------------------------------------------
// Vue globale (E19)
// ------------------------------------------------------------

describe("vue globale : chiffres", () => {
  beforeAll(async () => {
    // Avis par jour de l'organisation A : aujourd'hui, il y a 2 jours, le premier jour de la courbe (il y a 29 jours),
    // et un jour hors courbe (il y a 30 jours)
    await ecrireAgregat(0, 5);
    await ecrireAgregat(-2, 3);
    await ecrireAgregat(-29, 2);
    await ecrireAgregat(-30, 7);
  }, 30000);

  it("compte les organisations par statut (les trois statuts sont toujours presents)", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    expect(reponse.status).toBe(200);

    const { total, par_statut } = reponse.body.organisations as {
      total: number;
      par_statut: Record<string, number>;
    };
    expect(Object.keys(par_statut).sort()).toEqual(["ACTIF", "ESSAI", "SUSPENDU"]);
    // Nos organisations : 2 actives (A et B), 1 en essai, 1 suspendue
    expect(par_statut["ACTIF"]).toBeGreaterThanOrEqual(2);
    expect(par_statut["ESSAI"]).toBeGreaterThanOrEqual(1);
    expect(par_statut["SUSPENDU"]).toBeGreaterThanOrEqual(1);
    expect(total).toBe((par_statut["ACTIF"] ?? 0) + (par_statut["ESSAI"] ?? 0) + (par_statut["SUSPENDU"] ?? 0));
  });

  it("compte les utilisateurs actifs par role (les trois roles sont toujours presents)", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    const { total, par_role } = reponse.body.utilisateurs as {
      total: number;
      par_role: Record<string, number>;
    };
    expect(Object.keys(par_role).sort()).toEqual(["ADMINISTRATEUR", "GESTIONNAIRE", "RESPONSABLE"]);
    expect(par_role["ADMINISTRATEUR"]).toBeGreaterThanOrEqual(1);
    expect(par_role["RESPONSABLE"]).toBeGreaterThanOrEqual(1);
    expect(par_role["GESTIONNAIRE"]).toBeGreaterThanOrEqual(1);
    expect(total).toBe(
      (par_role["ADMINISTRATEUR"] ?? 0) + (par_role["RESPONSABLE"] ?? 0) + (par_role["GESTIONNAIRE"] ?? 0),
    );
  });

  it("donne 30 jours d'avis, un point par jour, sans trou, jusqu'a aujourd'hui", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    const courbe = reponse.body.avis_par_jour as {
      jours: number;
      total: number;
      points: Array<{ date: string; nb_avis: number }>;
    };
    expect(courbe.jours).toBe(30);
    expect(courbe.points).toHaveLength(30);
    expect(courbe.points[0]?.date).toBe(jourTexte(-29));
    expect(courbe.points[29]?.date).toBe(jourTexte(0));

    // Jours consecutifs : on retrouve chaque date attendue, dans l'ordre
    courbe.points.forEach((point, indice) => {
      expect(point.date).toBe(jourTexte(indice - 29));
    });

    const parJour = new Map(courbe.points.map((point) => [point.date, point.nb_avis]));
    expect(parJour.get(jourTexte(0))).toBeGreaterThanOrEqual(5);
    expect(parJour.get(jourTexte(-2))).toBeGreaterThanOrEqual(3);
    expect(parJour.get(jourTexte(-29))).toBeGreaterThanOrEqual(2);
    // Le jour hors courbe (il y a 30 jours) n'y est pas
    expect(parJour.has(jourTexte(-30))).toBe(false);

    // Le total est bien la somme des points
    expect(courbe.total).toBe(courbe.points.reduce((somme, point) => somme + point.nb_avis, 0));
    expect(courbe.total).toBeGreaterThanOrEqual(10);
  });
});

describe("vue globale : erreurs recentes", () => {
  it("montre un echec de connexion provoque, avec l'auteur et l'organisation", async () => {
    // Un echec volontaire : mauvais mot de passe pour le Gestionnaire de l'organisation en essai (cree une ligne CONNEXION_ECHEC)
    const echec = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: adresse("gestionnaire-essai"), mot_de_passe: "Mauvais-Mot-De-Passe-2026", se_souvenir: false });
    expect(echec.status).toBe(401);

    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    expect(reponse.status).toBe(200);
    expect(reponse.body.erreurs_recentes.jours).toBe(7);

    const entrees = reponse.body.erreurs_recentes.entrees as EntreeErreur[];
    const trouvee = entrees.find(
      (entree) => entree.action === "CONNEXION_ECHEC" && entree.utilisateur_email === adresse("gestionnaire-essai"),
    );
    expect(trouvee).toBeDefined();
    expect(trouvee?.organisation?.id).toBe(orgEssaiId);
  });

  it("ne montre que les actions d'echec, au plus 20, de la plus recente a la plus ancienne", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    const entrees = reponse.body.erreurs_recentes.entrees as EntreeErreur[];
    expect(entrees.length).toBeLessThanOrEqual(20);

    const actionsErreur: readonly string[] = ACTIONS_ERREUR;
    for (const entree of entrees) {
      expect(actionsErreur).toContain(entree.action);
    }
    const dates = entrees.map((entree) => Date.parse(entree.cree_le as string));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it("ignore les echecs vieux de plus de 7 jours", async () => {
    const ancienne = await prisma.auditLog.create({
      data: {
        organisation_id: orgEssaiId,
        utilisateur_id: echecId,
        action: "COMPTE_VERROUILLE",
        cree_le: new Date(Date.now() - 8 * UN_JOUR_EN_MS),
      },
      select: { id: true },
    });

    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    const ids = (reponse.body.erreurs_recentes.entrees as Array<{ id: string }>).map((entree) => entree.id);
    expect(ids).not.toContain(ancienne.id);
  });

  it("ne montre ni adresse IP ni secret", async () => {
    const reponse = await agentAdmin.get("/api/v1/admin/vue-globale");
    for (const entree of reponse.body.erreurs_recentes.entrees as EntreeErreur[]) {
      expect(entree).not.toHaveProperty("ip");
      expect(entree).not.toHaveProperty("details");
    }
    expect(JSON.stringify(reponse.body)).not.toContain(motDePasseHash);
  });
});

describe("vue globale : acces", () => {
  it("visiteur : 401 ; Responsable : 403 ; administrateur : 200", async () => {
    const visiteur = await request(app).get("/api/v1/admin/vue-globale");
    expect(visiteur.status).toBe(401);

    const responsable = await agentResponsable.get("/api/v1/admin/vue-globale");
    expect(responsable.status).toBe(403);
    expect(responsable.body.code).toBe("ACCES_REFUSE");

    const admin = await agentAdmin.get("/api/v1/admin/vue-globale");
    expect(admin.status).toBe(200);
  });

  it("aucune route d'ecriture sur la vue globale", async () => {
    for (const methode of ["post", "patch", "put", "delete"] as const) {
      const reponse = await agentAdmin[methode]("/api/v1/admin/vue-globale").send({});
      expect(reponse.status, methode).toBe(404);
    }
  });
});