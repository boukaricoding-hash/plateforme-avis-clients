import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Test de la liste et du detail des avis (jour 6, etape 2).
// Les avis sont poses directement en base pour maitriser les dates, les notes et les statuts.
// L'organisation de test est supprimee a la fin.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Liste-Avis-2026";
const SECRET_EMPREINTE = "empreinte-secrete-" + suffixe;

let organisationId: string;
let siteAId: string;
let siteBId: string;
let pointAId: string;
let pointBId: string;
let versionId: string;
let idEtoiles: string;
let idNps: string;

let responsableId: string;
let gestionnaireAId: string;
let agentResponsable: ReturnType<typeof request.agent>;
let agentGestionnaireA: ReturnType<typeof request.agent>;

// Les six avis du jeu de test (identifiants remplis dans beforeAll).
let avis1: string; // site A, 5/5, nps 10, "Excellent repas", 1er octobre, NOUVEAU
let avis2: string; // site A, 1/5, nps 2, "Service tres lent", 5 octobre, EN_COURS, alerte, contact consenti
let avis3: string; // site A, 3/5, nps 7, sans commentaire, 10 octobre 23h30, TRAITE, contact NON consenti
let avis4: string; // site B, 4/5, nps 9, "Personnel aimable", 15 octobre, NOUVEAU
let avis5: string; // site B, 2/5, nps 5, "Trop cher", 20 octobre, IGNORE, alerte
let avisSupprime: string; // site A, supprime

type StatutAvis = "NOUVEAU" | "EN_COURS" | "TRAITE" | "IGNORE";

let compteur = 0;

async function creerAvis(donnees: {
  site: "A" | "B";
  note: number;
  nps: number;
  commentaire: string | null;
  soumisLe: string;
  statut: StatutAvis;
  supprime?: boolean;
  contact?: { nom: string; tel: string; email: string; consentement: boolean };
}): Promise<string> {
  compteur += 1;
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
      // Champs internes : ils ne doivent jamais sortir de l'API.
      empreinte: SECRET_EMPREINTE,
      cle_idempotence: "test-liste-" + suffixe + ":" + String(compteur),
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
        ],
      },
    },
    select: { id: true },
  });
  return avis.id;
}

async function connecter(email: string): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  return agent;
}

beforeAll(async () => {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-LISTE-AVIS-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const siteA = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site A" } });
  const siteB = await prisma.site.create({ data: { organisation_id: organisationId, nom: "Site B" } });
  siteAId = siteA.id;
  siteBId = siteB.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      organisation_id: organisationId,
      titre: { fr: "Questionnaire test liste" },
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

  // Un responsable (toute l'organisation) et un gestionnaire limite au site A.
  const motDePasseHash = await hash(MOT_DE_PASSE, 4);
  const responsable = await prisma.utilisateur.create({
    data: {
      email: "responsable-" + suffixe + "@test-liste.local",
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable Liste",
      role: "RESPONSABLE",
      organisation_id: organisationId,
    },
    select: { id: true, email: true },
  });
  const gestionnaire = await prisma.utilisateur.create({
    data: {
      email: "gestionnaire-" + suffixe + "@test-liste.local",
      mot_de_passe_hash: motDePasseHash,
      nom: "Gestionnaire A",
      role: "GESTIONNAIRE",
      organisation_id: organisationId,
      utilisateurs_sites: { create: { site_id: siteAId } },
    },
    select: { id: true, email: true },
  });
  responsableId = responsable.id;
  gestionnaireAId = gestionnaire.id;

  avis1 = await creerAvis({
    site: "A", note: 5, nps: 10, commentaire: "Excellent repas",
    soumisLe: "2026-10-01T10:00:00.000Z", statut: "NOUVEAU",
  });
  avis2 = await creerAvis({
    site: "A", note: 1, nps: 2, commentaire: "Service tres lent",
    soumisLe: "2026-10-05T09:00:00.000Z", statut: "EN_COURS",
    contact: { nom: "Kossi Test", tel: "+22890000000", email: "kossi@test-liste.local", consentement: true },
  });
  avis3 = await creerAvis({
    site: "A", note: 3, nps: 7, commentaire: null,
    soumisLe: "2026-10-10T23:30:00.000Z", statut: "TRAITE",
    contact: { nom: "Ne-pas-montrer", tel: "+22891111111", email: "cache@test-liste.local", consentement: false },
  });
  avis4 = await creerAvis({
    site: "B", note: 4, nps: 9, commentaire: "Personnel aimable",
    soumisLe: "2026-10-15T12:00:00.000Z", statut: "NOUVEAU",
  });
  avis5 = await creerAvis({
    site: "B", note: 2, nps: 5, commentaire: "Trop cher",
    soumisLe: "2026-10-20T18:00:00.000Z", statut: "IGNORE",
  });
  avisSupprime = await creerAvis({
    site: "A", note: 5, nps: 10, commentaire: "Avis supprime",
    soumisLe: "2026-10-12T12:00:00.000Z", statut: "NOUVEAU", supprime: true,
  });

  // Les avis negatifs (2 et 5) ont declenche une alerte.
  await prisma.alerte.create({
    data: { organisation_id: organisationId, avis_id: avis2, motifs: ["NOTE_BASSE", "NPS_BAS"] },
  });
  await prisma.alerte.create({
    data: { organisation_id: organisationId, avis_id: avis5, motifs: ["NOTE_BASSE"] },
  });

  // Un suivi sur l'avis 2 pour tester l'historique.
  await prisma.avisSuivi.create({
    data: {
      organisation_id: organisationId,
      avis_id: avis2,
      utilisateur_id: responsableId,
      type: "CHANGEMENT_STATUT",
      ancien_statut: "NOUVEAU",
      nouveau_statut: "EN_COURS",
      commentaire: "Client rappele",
    },
  });

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

type ReponseListe = { body: { avis: { id: string }[] } };

function ids(reponse: ReponseListe): string[] {
  return reponse.body.avis.map((a) => a.id);
}

function listerComme(agent: ReturnType<typeof request.agent>, parametres: string) {
  return agent.get("/api/v1/avis" + (parametres === "" ? "" : "?" + parametres));
}

describe("liste des avis : acces et contenu", () => {
  it("refuse l'acces sans connexion (401)", async () => {
    await request(app).get("/api/v1/avis").expect(401);
    await request(app).get("/api/v1/avis/" + avis1).expect(401);
  });

  it("liste les avis de l'organisation, du plus recent au plus ancien, sans l'avis supprime", async () => {
    const reponse = await listerComme(agentResponsable, "").expect(200);

    expect(ids(reponse)).toEqual([avis5, avis4, avis3, avis2, avis1]);
    expect(ids(reponse)).not.toContain(avisSupprime);
    expect(reponse.body.pagination).toEqual({ page: 1, limite: 20, total: 5, pages: 1 });
  });

  it("ne renvoie aucun champ interne (empreinte, cle unique, organisation)", async () => {
    const reponse = await listerComme(agentResponsable, "").expect(200);
    const texte = JSON.stringify(reponse.body);

    expect(texte).not.toContain("empreinte");
    expect(texte).not.toContain("cle_idempotence");
    expect(texte).not.toContain("organisation_id");
    expect(texte).not.toContain("contact_");
  });

  it("indique l'alerte et un extrait du commentaire pour chaque avis", async () => {
    const reponse = await listerComme(agentResponsable, "").expect(200);
    const parId = new Map(
      (reponse.body.avis as { id: string; en_alerte: boolean; commentaire_extrait: string | null }[]).map(
        (a) => [a.id, a],
      ),
    );

    expect(parId.get(avis2)?.en_alerte).toBe(true);
    expect(parId.get(avis2)?.commentaire_extrait).toBe("Service tres lent");
    expect(parId.get(avis1)?.en_alerte).toBe(false);
    expect(parId.get(avis3)?.commentaire_extrait).toBeNull();
  });
});

describe("liste des avis : pagination et tri", () => {
  it("decoupe en pages stables", async () => {
    const page1 = await listerComme(agentResponsable, "limite=2&page=1").expect(200);
    const page2 = await listerComme(agentResponsable, "limite=2&page=2").expect(200);
    const page3 = await listerComme(agentResponsable, "limite=2&page=3").expect(200);

    expect(ids(page1)).toEqual([avis5, avis4]);
    expect(ids(page2)).toEqual([avis3, avis2]);
    expect(ids(page3)).toEqual([avis1]);
    expect(page2.body.pagination).toEqual({ page: 2, limite: 2, total: 5, pages: 3 });
  });

  it("trie par note croissante", async () => {
    const reponse = await listerComme(agentResponsable, "tri=note_globale&ordre=asc").expect(200);
    expect(ids(reponse)).toEqual([avis2, avis5, avis3, avis4, avis1]);
  });

  it("trie par NPS decroissant", async () => {
    const reponse = await listerComme(agentResponsable, "tri=nps&ordre=desc").expect(200);
    expect(ids(reponse)).toEqual([avis1, avis4, avis3, avis5, avis2]);
  });
});

describe("liste des avis : filtres", () => {
  it("filtre par periode, bornes comprises (jour complet)", async () => {
    const reponse = await listerComme(agentResponsable, "from=2026-10-05&to=2026-10-10").expect(200);
    // L'avis 3 est du 10 octobre a 23h30 : il est bien inclus.
    expect(ids(reponse).sort()).toEqual([avis2, avis3].sort());

    const debut = await listerComme(agentResponsable, "from=2026-10-15").expect(200);
    expect(ids(debut).sort()).toEqual([avis4, avis5].sort());

    const fin = await listerComme(agentResponsable, "to=2026-10-01").expect(200);
    expect(ids(fin)).toEqual([avis1]);
  });

  it("filtre par site et par point de contact", async () => {
    const siteB = await listerComme(agentResponsable, "site=" + siteBId).expect(200);
    expect(ids(siteB).sort()).toEqual([avis4, avis5].sort());

    const pointA = await listerComme(agentResponsable, "point=" + pointAId).expect(200);
    expect(ids(pointA).sort()).toEqual([avis1, avis2, avis3].sort());
  });

  it("filtre par statut", async () => {
    const reponse = await listerComme(agentResponsable, "statut=EN_COURS").expect(200);
    expect(ids(reponse)).toEqual([avis2]);
  });

  it("recherche dans le commentaire sans tenir compte des majuscules", async () => {
    const reponse = await listerComme(agentResponsable, "q=" + encodeURIComponent("TRES LENT")).expect(200);
    expect(ids(reponse)).toEqual([avis2]);
  });

  it("filtre les avis negatifs (ceux qui ont une alerte)", async () => {
    const negatifs = await listerComme(agentResponsable, "negatifs=true").expect(200);
    expect(ids(negatifs).sort()).toEqual([avis2, avis5].sort());

    const autres = await listerComme(agentResponsable, "negatifs=false").expect(200);
    expect(ids(autres).sort()).toEqual([avis1, avis3, avis4].sort());
  });

  it("filtre les avis avec ou sans commentaire", async () => {
    const avec = await listerComme(agentResponsable, "avec_commentaire=true").expect(200);
    expect(ids(avec).sort()).toEqual([avis1, avis2, avis4, avis5].sort());

    const sans = await listerComme(agentResponsable, "avec_commentaire=false").expect(200);
    expect(ids(sans)).toEqual([avis3]);
  });

  it("combine la recherche et le filtre commentaire (les deux s'appliquent)", async () => {
    const reponse = await listerComme(
      agentResponsable,
      "q=" + encodeURIComponent("tres lent") + "&avec_commentaire=false",
    ).expect(200);
    expect(ids(reponse)).toEqual([]);
    expect(reponse.body.pagination.total).toBe(0);
  });

  it("filtre par tranche de notes", async () => {
    const hautes = await listerComme(agentResponsable, "note_min=4").expect(200);
    expect(ids(hautes).sort()).toEqual([avis1, avis4].sort());

    const basses = await listerComme(agentResponsable, "note_max=2").expect(200);
    expect(ids(basses).sort()).toEqual([avis2, avis5].sort());
  });
});

describe("liste des avis : filtres invalides (400)", () => {
  it("refuse une periode a l'envers, une limite trop grande, un statut ou un site inconnus", async () => {
    const periode = await listerComme(agentResponsable, "from=2026-10-10&to=2026-10-01").expect(400);
    expect(periode.body.code).toBe("DONNEES_INVALIDES");

    await listerComme(agentResponsable, "limite=1000").expect(400);
    await listerComme(agentResponsable, "statut=INCONNU").expect(400);
    await listerComme(agentResponsable, "site=pas-un-uuid").expect(400);
    await listerComme(agentResponsable, "note_min=4&note_max=2").expect(400);
  });
});

describe("perimetre du gestionnaire", () => {
  it("ne liste que les avis de son site", async () => {
    const reponse = await listerComme(agentGestionnaireA, "").expect(200);

    expect(ids(reponse)).toEqual([avis3, avis2, avis1]);
    expect(reponse.body.pagination.total).toBe(3);
  });

  it("recoit une liste vide (200) s'il filtre sur un site hors de son perimetre", async () => {
    const reponse = await listerComme(agentGestionnaireA, "site=" + siteBId).expect(200);

    expect(ids(reponse)).toEqual([]);
    expect(reponse.body.pagination.total).toBe(0);
  });

  it("ne peut pas ouvrir un avis d'un autre site (404)", async () => {
    await agentGestionnaireA.get("/api/v1/avis/" + avis4).expect(404);
    await agentGestionnaireA.get("/api/v1/avis/" + avis1).expect(200);
  });
});

describe("detail d'un avis", () => {
  it("renvoie les reponses dans l'ordre, l'alerte, l'historique et les coordonnees consenties", async () => {
    const reponse = await agentResponsable.get("/api/v1/avis/" + avis2).expect(200);
    const avis = reponse.body.avis;

    expect(avis.id).toBe(avis2);
    expect(avis.note_globale).toBe(1);
    expect(avis.commentaire).toBe("Service tres lent");
    expect(avis.statut_traitement).toBe("EN_COURS");
    expect(avis.site.nom).toBe("Site A");
    expect(avis.point_contact.nom).toBe("Table A");
    expect(avis.version.numero).toBe(1);

    expect(avis.reponses).toHaveLength(2);
    expect(avis.reponses[0].question.type).toBe("ETOILES");
    expect(avis.reponses[0].valeur_numerique).toBe(1);
    expect(avis.reponses[1].question.type).toBe("NPS");
    expect(avis.reponses[1].valeur_numerique).toBe(2);

    expect(avis.alerte.motifs).toEqual(["NOTE_BASSE", "NPS_BAS"]);

    expect(avis.suivis).toHaveLength(1);
    expect(avis.suivis[0].nouveau_statut).toBe("EN_COURS");
    expect(avis.suivis[0].commentaire).toBe("Client rappele");
    expect(avis.suivis[0].utilisateur.nom).toBe("Responsable Liste");

    expect(avis.contact).toEqual({
      nom: "Kossi Test",
      telephone: "+22890000000",
      email: "kossi@test-liste.local",
    });
  });

  it("cache les coordonnees quand le client n'a pas consenti", async () => {
    const reponse = await agentResponsable.get("/api/v1/avis/" + avis3).expect(200);

    expect(reponse.body.avis.contact).toBeNull();
    expect(JSON.stringify(reponse.body)).not.toContain("Ne-pas-montrer");
    expect(JSON.stringify(reponse.body)).not.toContain("cache@test-liste.local");
  });

  it("ne renvoie aucun champ interne", async () => {
    const reponse = await agentResponsable.get("/api/v1/avis/" + avis2).expect(200);
    const texte = JSON.stringify(reponse.body);

    expect(texte).not.toContain("empreinte");
    expect(texte).not.toContain("cle_idempotence");
    expect(texte).not.toContain("organisation_id");
    expect(texte).not.toContain("contact_");
  });

  it("repond 404 pour un avis inconnu ou supprime, et 400 pour un identifiant invalide", async () => {
    await agentResponsable.get("/api/v1/avis/00000000-0000-4000-8000-000000000000").expect(404);
    await agentResponsable.get("/api/v1/avis/" + avisSupprime).expect(404);
    await agentResponsable.get("/api/v1/avis/pas-un-uuid").expect(400);
  });
});