import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import type { EmailAEnvoyer } from "../../src/utilitaires/envoi-email";

// Les e-mails ne partent pas vraiment : on les garde en memoire pour lire le lien.
const { emailsEnvoyes } = vi.hoisted(() => ({ emailsEnvoyes: [] as EmailAEnvoyer[] }));

vi.mock("../../src/utilitaires/envoi-email", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/utilitaires/envoi-email")>();
  return {
    ...original,
    envoyerEmail: vi.fn(async (email: EmailAEnvoyer) => {
      emailsEnvoyes.push(email);
      return true;
    }),
  };
});

import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";
import { empreinteJeton } from "../../src/modules/authentification/services/sessions";

// Test de la reinitialisation du mot de passe (jour 13, etape 9).
// L'organisation de test et ses utilisateurs sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const ANCIEN_MDP = "Ancien-Mdp-2026";
const NOUVEAU_MDP = "Nouveau-Mdp-2026";
const debutTest = new Date();

let organisationId: string;
const utilisateurIds: string[] = [];

async function creerUtilisateur(etiquette: string): Promise<{ id: string; email: string }> {
  const email = etiquette + "-" + suffixe + "@test-reinit.local";
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: await hash(ANCIEN_MDP, 4),
      nom: "Test " + etiquette,
      role: "RESPONSABLE",
      organisation_id: organisationId,
    },
  });
  utilisateurIds.push(utilisateur.id);
  return { id: utilisateur.id, email };
}

function demander(email: string) {
  return request(app).post("/api/v1/auth/forgot-password").send({ email });
}

function reinitialiser(jeton: string, motDePasse: string) {
  return request(app)
    .post("/api/v1/auth/reset-password")
    .send({ jeton, mot_de_passe: motDePasse });
}

function connecter(email: string, motDePasse: string) {
  return request(app)
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: motDePasse, se_souvenir: false });
}

// Demande un lien puis renvoie le jeton lu dans l'e-mail intercepte.
async function obtenirJeton(email: string): Promise<string> {
  const reponse = await demander(email);
  expect(reponse.status).toBe(200);
  const courrier = [...emailsEnvoyes].reverse().find((m) => m.a === email);
  if (!courrier) {
    throw new Error("Aucun e-mail intercepte pour " + email);
  }
  const jeton = /jeton=([\w-]+)/.exec(courrier.texte)?.[1];
  if (!jeton) {
    throw new Error("Aucun jeton dans l'e-mail");
  }
  return jeton;
}

beforeAll(async () => {
  // Limites hautes : les tests ne doivent pas se bloquer eux-memes.
  process.env["LIMITE_REINITIALISATION_DEMANDE_MAX"] = "1000";
  process.env["LIMITE_REINITIALISATION_MAX"] = "1000";

  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const organisation = await prisma.organisation.create({
    data: { nom: "TEST-REINIT-" + suffixe, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationId = organisation.id;
}, 30000);

afterAll(async () => {
  delete process.env["LIMITE_REINITIALISATION_DEMANDE_MAX"];
  delete process.env["LIMITE_REINITIALISATION_MAX"];

  if (organisationId !== undefined) {
    await prisma.jetonReinitialisationMdp.deleteMany({
      where: { utilisateur_id: { in: utilisateurIds } },
    });
    await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { organisation_id: organisationId },
          { utilisateur_id: { in: utilisateurIds } },
          // Demandes pour une adresse inconnue : aucune organisation, aucun utilisateur.
          {
            utilisateur_id: null,
            organisation_id: null,
            action: "REINITIALISATION_DEMANDEE",
            cree_le: { gte: debutTest },
          },
        ],
      },
    });
    await prisma.utilisateur.deleteMany({ where: { organisation_id: organisationId } });
    await prisma.organisation.deleteMany({ where: { id: organisationId } });
  }
  await prisma.$disconnect();
}, 30000);

describe("reinitialisation du mot de passe", () => {
  it("parcours complet : demande, lien, nouveau mot de passe, connexion", async () => {
    const utilisateur = await creerUtilisateur("parcours");
    const jeton = await obtenirJeton(utilisateur.email);

    const reponse = await reinitialiser(jeton, NOUVEAU_MDP);
    expect(reponse.status).toBe(200);
    expect(typeof reponse.body.message).toBe("string");

    const avecNouveau = await connecter(utilisateur.email, NOUVEAU_MDP);
    expect(avecNouveau.status).toBe(200);
    const avecAncien = await connecter(utilisateur.email, ANCIEN_MDP);
    expect(avecAncien.status).toBe(401);

    const audit = await prisma.auditLog.findMany({
      where: { utilisateur_id: utilisateur.id, action: "MOT_DE_PASSE_REINITIALISE" },
    });
    expect(audit).toHaveLength(1);
  });

  it("refuse un jeton utilise deux fois", async () => {
    const utilisateur = await creerUtilisateur("deuxfois");
    const jeton = await obtenirJeton(utilisateur.email);

    const premiere = await reinitialiser(jeton, NOUVEAU_MDP);
    expect(premiere.status).toBe(200);

    const seconde = await reinitialiser(jeton, "Autre-Mdp-2026-xyz");
    expect(seconde.status).toBe(400);
    expect(seconde.body.code).toBe("LIEN_INVALIDE");
  });

  it("refuse un jeton expire", async () => {
    const utilisateur = await creerUtilisateur("expire");
    const jeton = await obtenirJeton(utilisateur.email);

    await prisma.jetonReinitialisationMdp.updateMany({
      where: { token_hash: empreinteJeton(jeton) },
      data: { expire_le: new Date(Date.now() - 1000) },
    });

    const reponse = await reinitialiser(jeton, NOUVEAU_MDP);
    expect(reponse.status).toBe(400);
    expect(reponse.body.code).toBe("LIEN_INVALIDE");
  });

  it("refuse un jeton absent ou inconnu", async () => {
    const sansJeton = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ mot_de_passe: NOUVEAU_MDP });
    expect(sansJeton.status).toBe(400);
    expect(sansJeton.body.code).toBe("LIEN_INVALIDE");

    const inconnu = await reinitialiser("jeton-qui-n-existe-pas", NOUVEAU_MDP);
    expect(inconnu.status).toBe(400);
    expect(inconnu.body.code).toBe("LIEN_INVALIDE");
  });

  it("adresse inconnue : meme reponse, aucun e-mail", async () => {
    const utilisateur = await creerUtilisateur("connue");
    const nombreAvant = emailsEnvoyes.length;

    const inconnue = await demander("personne-" + suffixe + "@test-reinit.local");
    expect(inconnue.status).toBe(200);
    expect(emailsEnvoyes.length).toBe(nombreAvant);

    const connue = await demander(utilisateur.email);
    expect(connue.status).toBe(200);
    expect(emailsEnvoyes.length).toBe(nombreAvant + 1);

    expect(inconnue.body).toEqual(connue.body);
  });

  it("supprime les sessions ouvertes apres la reinitialisation", async () => {
    const utilisateur = await creerUtilisateur("sessions");
    const agent = request.agent(app);

    const connexion = await agent
      .post("/api/v1/auth/login")
      .send({ email: utilisateur.email, mot_de_passe: ANCIEN_MDP, se_souvenir: false });
    expect(connexion.status).toBe(200);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);

    const jeton = await obtenirJeton(utilisateur.email);
    expect((await reinitialiser(jeton, NOUVEAU_MDP)).status).toBe(200);

    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
    const restantes = await prisma.session.count({ where: { utilisateur_id: utilisateur.id } });
    expect(restantes).toBe(0);
  });

  it("refuse un mot de passe trop courant, puis accepte un bon avec le meme jeton", async () => {
    const utilisateur = await creerUtilisateur("courant");
    const jeton = await obtenirJeton(utilisateur.email);

    const refuse = await reinitialiser(jeton, "password123");
    expect(refuse.status).toBe(400);
    expect(refuse.body.code).toBe("MOT_DE_PASSE_INVALIDE");
    expect(typeof refuse.body.message).toBe("string");

    const trop_court = await reinitialiser(jeton, "abc");
    expect(trop_court.status).toBe(400);
    expect(trop_court.body.code).toBe("MOT_DE_PASSE_INVALIDE");

    // Le jeton n'a pas ete consomme par les refus.
    const accepte = await reinitialiser(jeton, NOUVEAU_MDP);
    expect(accepte.status).toBe(200);
  });

  it("remet a zero le verrouillage du compte", async () => {
    const utilisateur = await creerUtilisateur("verrouille");
    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { tentatives_echec: 5, verrouille_jusqua: new Date(Date.now() + 15 * 60 * 1000) },
    });

    const bloque = await connecter(utilisateur.email, ANCIEN_MDP);
    expect(bloque.status).toBe(401);

    const jeton = await obtenirJeton(utilisateur.email);
    expect((await reinitialiser(jeton, NOUVEAU_MDP)).status).toBe(200);

    const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateur.id } });
    expect(apres.tentatives_echec).toBe(0);
    expect(apres.verrouille_jusqua).toBeNull();

    expect((await connecter(utilisateur.email, NOUVEAU_MDP)).status).toBe(200);
  });

  it("garde seulement l'empreinte du jeton en base, valable 30 minutes", async () => {
    const utilisateur = await creerUtilisateur("empreinte");
    const jeton = await obtenirJeton(utilisateur.email);

    const enClair = await prisma.jetonReinitialisationMdp.count({ where: { token_hash: jeton } });
    expect(enClair).toBe(0);

    const ligne = await prisma.jetonReinitialisationMdp.findFirstOrThrow({
      where: { token_hash: empreinteJeton(jeton) },
    });
    expect(ligne.utilisateur_id).toBe(utilisateur.id);
    expect(ligne.utilise_le).toBeNull();

    const minutes = (ligne.expire_le.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(28);
    expect(minutes).toBeLessThanOrEqual(30);
  });

  // Ces deux tests doivent rester les derniers : ils baissent les limites a 1,
  // et les compteurs sont deja remplis par les tests precedents.
  it("limite les demandes de lien (429)", async () => {
    process.env["LIMITE_REINITIALISATION_DEMANDE_MAX"] = "1";
    const nombreAvant = emailsEnvoyes.length;

    const reponse = await demander("limite-" + suffixe + "@test-reinit.local");
    expect(reponse.status).toBe(429);
    expect(reponse.body.code).toBe("TROP_DE_REQUETES");
    expect(emailsEnvoyes.length).toBe(nombreAvant);
  });

  it("limite les essais de nouveau mot de passe (429)", async () => {
    process.env["LIMITE_REINITIALISATION_MAX"] = "1";

    const reponse = await reinitialiser("jeton-quelconque", NOUVEAU_MDP);
    expect(reponse.status).toBe(429);
    expect(reponse.body.code).toBe("TROP_DE_REQUETES");
  });
});