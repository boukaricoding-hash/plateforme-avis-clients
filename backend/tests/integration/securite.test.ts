import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Tests de securite du jour 26 :
// - controle de l'origine des requetes qui portent le cookie de session (protection CSRF) ;
// - limite de scans de QR par minute et par adresse IP.
// Il cree sa propre organisation et son propre utilisateur, supprimes a la fin.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Securite-2026";
const ORIGINE_AUTORISEE = "https://avis.exemple-test.local";
const ORIGINE_PIRATE = "https://site-pirate.exemple-test.local";
const HOTE_DU_SITE = "plateforme.exemple-test.local";

const VARIABLES = ["ORIGINES_AUTORISEES", "LIMITE_SCAN_PAR_MINUTE"] as const;
const anciennesValeurs: Record<string, string | undefined> = {};

let organisationId: string;
let utilisateurId: string;
let email: string;

// Connexion : l'agent garde le cookie de session pour les appels suivants.
async function seConnecter() {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  return agent;
}

beforeAll(async () => {
  // Les deux reglages sont lus a chaque requete : on peut les poser ici.
  for (const nom of VARIABLES) {
    anciennesValeurs[nom] = process.env[nom];
  }
  process.env["ORIGINES_AUTORISEES"] = ORIGINE_AUTORISEE;
  process.env["LIMITE_SCAN_PAR_MINUTE"] = "3";

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-SECURITE-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;

  email = "responsable-" + suffixe + "@test-securite.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: "Responsable Securite",
      role: "RESPONSABLE",
      organisation_id: organisationId,
    },
  });
  utilisateurId = utilisateur.id;
}, 30000);

afterAll(async () => {
  for (const nom of VARIABLES) {
    const ancienne = anciennesValeurs[nom];
    if (ancienne === undefined) {
      delete process.env[nom];
    } else {
      process.env[nom] = ancienne;
    }
  }
  if (utilisateurId !== undefined) {
    await prisma.session.deleteMany({ where: { utilisateur_id: utilisateurId } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ organisation_id: organisationId }, { utilisateur_id: utilisateurId }] },
    });
    await prisma.utilisateur.deleteMany({ where: { id: utilisateurId } });
  }
  if (organisationId !== undefined) {
    await prisma.organisation.deleteMany({ where: { id: organisationId } });
  }
  await prisma.$disconnect();
}, 30000);

describe("controle de l'origine (CSRF)", () => {
  it("refuse une origine inconnue avec le cookie de session (403) et la session reste valide", async () => {
    const agent = await seConnecter();

    const refus = await agent.post("/api/v1/auth/logout").set("Origin", ORIGINE_PIRATE);
    expect(refus.status).toBe(403);
    expect(refus.body.code).toBe("ORIGINE_REFUSEE");

    // La deconnexion n'a pas eu lieu : la session fonctionne toujours.
    await agent.get("/api/v1/auth/me").expect(200);
  });

  it("accepte une origine de la liste ORIGINES_AUTORISEES (204)", async () => {
    const agent = await seConnecter();
    await agent.post("/api/v1/auth/logout").set("Origin", ORIGINE_AUTORISEE).expect(204);
  });

  it("accepte une origine qui a le meme hote que la requete (204)", async () => {
    const agent = await seConnecter();
    await agent
      .post("/api/v1/auth/logout")
      .set("Host", HOTE_DU_SITE)
      .set("Origin", "https://" + HOTE_DU_SITE)
      .expect(204);
  });

  it("accepte une requete sans en-tete Origin (outils de test, curl) (204)", async () => {
    const agent = await seConnecter();
    await agent.post("/api/v1/auth/logout").expect(204);
  });

  it("ne bloque pas une requete sans cookie de session, meme avec une origine inconnue", async () => {
    // Connexion avec un compte inconnu : 401 normal, surtout pas 403.
    const reponse = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", ORIGINE_PIRATE)
      .send({
        email: "inconnu-" + suffixe + "@test-securite.local",
        mot_de_passe: "Mauvais-Mot-De-Passe-2026",
        se_souvenir: false,
      });
    expect(reponse.status).toBe(401);
    expect(reponse.body.code).toBe("IDENTIFIANTS_INVALIDES");
  });

  it("ne bloque pas les lectures (GET), meme avec une origine inconnue", async () => {
    const agent = await seConnecter();
    await agent.get("/api/v1/auth/me").set("Origin", ORIGINE_PIRATE).expect(200);
  });
});

describe("limite de scans de QR", () => {
  it("repond 429 apres 3 scans par minute, avec le message JSON habituel", async () => {
    // Un code au bon format mais inconnu : 404 tant que la limite n'est pas atteinte.
    const code = randomBytes(9).toString("base64url");
    const statuts: number[] = [];
    let codeDernier: unknown;

    for (let essai = 0; essai < 5; essai += 1) {
      const reponse = await request(app).get("/api/v1/public/q/" + code);
      statuts.push(reponse.status);
      codeDernier = reponse.body.code;
    }

    expect(statuts.slice(0, 3)).not.toContain(429);
    expect(statuts[3]).toBe(429);
    expect(statuts[4]).toBe(429);
    expect(codeDernier).toBe("TROP_DE_REQUETES");
  });
});