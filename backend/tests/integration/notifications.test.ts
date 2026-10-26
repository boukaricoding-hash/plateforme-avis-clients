import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Test des notifications (jour 6, etape 4) : chacun ne lit et ne marque que SES notifications.
// L'organisation de test est supprimee a la fin.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Notifications-2026";

let organisationId: string;
const utilisateurIds: string[] = [];

let agentLecteur: ReturnType<typeof request.agent>;
let agentAutre: ReturnType<typeof request.agent>;
let agentMarqueur: ReturnType<typeof request.agent>;
let autreId: string;
let marqueurId: string;

// Notifications du "lecteur" (tests de lecture) et de "l'autre" utilisateur.
let n1: string; // 1er octobre, non lue
let n2: string; // 2 octobre, non lue
let n3: string; // 3 octobre, deja lue
let g1: string; // appartient a l'autre utilisateur

async function creerUtilisateur(
  nom: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
): Promise<{ id: string; email: string }> {
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email: nom.toLowerCase() + "-" + suffixe + "@test-notifications.local",
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom,
      role,
      organisation_id: organisationId,
    },
    select: { id: true, email: true },
  });
  utilisateurIds.push(utilisateur.id);
  return utilisateur;
}

async function connecter(email: string): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  return agent;
}

async function creerNotification(
  utilisateurId: string,
  options: { titre: string; creeLe?: string; lue?: boolean },
): Promise<string> {
  const notification = await prisma.notification.create({
    data: {
      organisation_id: organisationId,
      utilisateur_id: utilisateurId,
      titre: options.titre,
      message: "Message de " + options.titre,
      ...(options.creeLe !== undefined ? { cree_le: new Date(options.creeLe) } : {}),
      ...(options.lue === true ? { lue_le: new Date("2026-10-04T08:00:00.000Z") } : {}),
    },
    select: { id: true },
  });
  return notification.id;
}

async function lireNotificationEnBase(id: string) {
  return prisma.notification.findUniqueOrThrow({ where: { id }, select: { lue_le: true } });
}

beforeAll(async () => {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-NOTIFICATIONS-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  const lecteur = await creerUtilisateur("Lecteur", "RESPONSABLE");
  const autre = await creerUtilisateur("Autre", "GESTIONNAIRE");
  const marqueur = await creerUtilisateur("Marqueur", "RESPONSABLE");
  autreId = autre.id;
  marqueurId = marqueur.id;

  n1 = await creerNotification(lecteur.id, { titre: "Premiere", creeLe: "2026-10-01T10:00:00.000Z" });
  n2 = await creerNotification(lecteur.id, { titre: "Deuxieme", creeLe: "2026-10-02T10:00:00.000Z" });
  n3 = await creerNotification(lecteur.id, {
    titre: "Troisieme",
    creeLe: "2026-10-03T10:00:00.000Z",
    lue: true,
  });
  g1 = await creerNotification(autre.id, { titre: "Pour l'autre", creeLe: "2026-10-02T12:00:00.000Z" });

  agentLecteur = await connecter(lecteur.email);
  agentAutre = await connecter(autre.email);
  agentMarqueur = await connecter(marqueur.email);
}, 30000);

afterAll(async () => {
  if (organisationId !== undefined) {
    await prisma.notification.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ organisation_id: organisationId }, { utilisateur_id: { in: utilisateurIds } }],
      },
    });
    await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
    await prisma.utilisateur.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.organisation.deleteMany({ where: { id: organisationId } });
  }
  await prisma.$disconnect();
}, 30000);

type ReponseListe = { body: { notifications: { id: string }[] } };

function ids(reponse: ReponseListe): string[] {
  return reponse.body.notifications.map((n) => n.id);
}

describe("liste des notifications", () => {
  it("refuse l'acces sans connexion (401)", async () => {
    await request(app).get("/api/v1/notifications").expect(401);
    await request(app).post("/api/v1/notifications/" + n1 + "/lue").expect(401);
    expect((await lireNotificationEnBase(n1)).lue_le).toBeNull();
  });

  it("liste mes notifications, la plus recente d'abord, avec le compteur de non lues", async () => {
    const reponse = await agentLecteur.get("/api/v1/notifications").expect(200);

    expect(ids(reponse)).toEqual([n3, n2, n1]);
    expect(reponse.body.non_lues).toBe(2);
    expect(reponse.body.pagination).toEqual({ page: 1, limite: 20, total: 3, pages: 1 });
  });

  it("filtre les non lues et les lues sans changer le compteur", async () => {
    const nonLues = await agentLecteur.get("/api/v1/notifications?non_lues=true").expect(200);
    expect(ids(nonLues)).toEqual([n2, n1]);
    expect(nonLues.body.non_lues).toBe(2);

    const lues = await agentLecteur.get("/api/v1/notifications?non_lues=false").expect(200);
    expect(ids(lues)).toEqual([n3]);
    expect(lues.body.non_lues).toBe(2);
  });

  it("decoupe en pages", async () => {
    const page1 = await agentLecteur.get("/api/v1/notifications?limite=2&page=1").expect(200);
    const page2 = await agentLecteur.get("/api/v1/notifications?limite=2&page=2").expect(200);

    expect(ids(page1)).toEqual([n3, n2]);
    expect(ids(page2)).toEqual([n1]);
    expect(page2.body.pagination).toEqual({ page: 2, limite: 2, total: 3, pages: 2 });
  });

  it("ne renvoie aucun champ interne", async () => {
    const reponse = await agentLecteur.get("/api/v1/notifications").expect(200);
    const texte = JSON.stringify(reponse.body);

    expect(texte).not.toContain("organisation_id");
    expect(texte).not.toContain("utilisateur_id");
    expect(texte).not.toContain("email_envoye_le");
  });

  it("ne montre jamais les notifications d'un autre utilisateur, meme dans la meme organisation", async () => {
    const lecteur = await agentLecteur.get("/api/v1/notifications").expect(200);
    expect(ids(lecteur)).not.toContain(g1);

    const autre = await agentAutre.get("/api/v1/notifications").expect(200);
    expect(ids(autre)).toEqual([g1]);
    expect(autre.body.non_lues).toBe(1);
  });

  it("refuse les parametres invalides (400)", async () => {
    const reponse = await agentLecteur.get("/api/v1/notifications?non_lues=peut-etre").expect(400);
    expect(reponse.body.code).toBe("DONNEES_INVALIDES");

    await agentLecteur.get("/api/v1/notifications?limite=1000").expect(400);
    await agentLecteur.get("/api/v1/notifications?page=0").expect(400);
  });
});

describe("marquer une notification comme lue", () => {
  it("marque la notification comme lue et fait baisser le compteur", async () => {
    const m1 = await creerNotification(marqueurId, { titre: "A marquer" });
    const avant = await agentMarqueur.get("/api/v1/notifications").expect(200);

    const reponse = await agentMarqueur.post("/api/v1/notifications/" + m1 + "/lue").expect(200);

    expect(reponse.body.notification.id).toBe(m1);
    expect(reponse.body.notification.lue_le).not.toBeNull();
    expect(JSON.stringify(reponse.body)).not.toContain("organisation_id");
    expect(JSON.stringify(reponse.body)).not.toContain("utilisateur_id");
    expect((await lireNotificationEnBase(m1)).lue_le).not.toBeNull();

    const apres = await agentMarqueur.get("/api/v1/notifications").expect(200);
    expect(apres.body.non_lues).toBe((avant.body.non_lues as number) - 1);
  });

  it("garde la date de premiere lecture si on marque une deuxieme fois", async () => {
    const m2 = await creerNotification(marqueurId, { titre: "Marquee deux fois" });

    const premiere = await agentMarqueur.post("/api/v1/notifications/" + m2 + "/lue").expect(200);
    const deuxieme = await agentMarqueur.post("/api/v1/notifications/" + m2 + "/lue").expect(200);

    expect(deuxieme.body.notification.lue_le).toBe(premiere.body.notification.lue_le);
    const enBase = await lireNotificationEnBase(m2);
    expect(enBase.lue_le?.toISOString()).toBe(premiere.body.notification.lue_le);
  });

  it("refuse (404) de marquer la notification d'un autre utilisateur, qui reste non lue", async () => {
    await agentMarqueur.post("/api/v1/notifications/" + g1 + "/lue").expect(404);
    await agentMarqueur.post("/api/v1/notifications/" + n1 + "/lue").expect(404);

    expect((await lireNotificationEnBase(g1)).lue_le).toBeNull();
    expect((await lireNotificationEnBase(n1)).lue_le).toBeNull();
  });

  it("repond 404 pour une notification inconnue et 400 pour un identifiant invalide", async () => {
    await agentMarqueur.post("/api/v1/notifications/00000000-0000-4000-8000-000000000000/lue").expect(404);
    await agentMarqueur.post("/api/v1/notifications/pas-un-uuid/lue").expect(400);
  });
});