import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Test du nom et du logo de l'organisation dans l'utilisateur renvoye par
// POST /auth/login et GET /auth/me (hors planning, refonte de la barre laterale).
// Les organisations et utilisateurs de test sont supprimes a la fin.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Auth-Organisation-2026";
const NOM_AVEC_LOGO = "TEST-AUTH-LOGO-" + suffixe;
const NOM_SANS_LOGO = "TEST-AUTH-SANS-LOGO-" + suffixe;
const LOGO = "https://exemple.test/logo-" + suffixe + ".png";

const organisationIds: string[] = [];
const utilisateurIds: string[] = [];

let organisationAvecLogoId: string;
let emailAvecLogo: string;
let emailSansLogo: string;
let emailAdministrateur: string;

async function seConnecter(email: string) {
  const agent = request.agent(app);
  const reponse = await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false });
  return { agent, reponse };
}

beforeAll(async () => {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const motDePasseHash = await hash(MOT_DE_PASSE, 4);

  const organisationAvecLogo = await prisma.organisation.create({
    data: { nom: NOM_AVEC_LOGO, logo_url: LOGO, secteur_id: secteur.id, statut: "ACTIF" },
  });
  const organisationSansLogo = await prisma.organisation.create({
    data: { nom: NOM_SANS_LOGO, secteur_id: secteur.id, statut: "ACTIF" },
  });
  organisationAvecLogoId = organisationAvecLogo.id;
  organisationIds.push(organisationAvecLogo.id, organisationSansLogo.id);

  emailAvecLogo = "avec-logo-" + suffixe + "@test-auth-organisation.local";
  emailSansLogo = "sans-logo-" + suffixe + "@test-auth-organisation.local";
  emailAdministrateur = "administrateur-" + suffixe + "@test-auth-organisation.local";

  const responsableAvecLogo = await prisma.utilisateur.create({
    data: {
      email: emailAvecLogo,
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable Avec Logo",
      role: "RESPONSABLE",
      organisation_id: organisationAvecLogo.id,
    },
  });
  const responsableSansLogo = await prisma.utilisateur.create({
    data: {
      email: emailSansLogo,
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable Sans Logo",
      role: "RESPONSABLE",
      organisation_id: organisationSansLogo.id,
    },
  });
  // Administrateur DTS : aucune organisation.
  const administrateur = await prisma.utilisateur.create({
    data: {
      email: emailAdministrateur,
      mot_de_passe_hash: motDePasseHash,
      nom: "Administrateur DTS",
      role: "ADMINISTRATEUR",
    },
  });
  utilisateurIds.push(responsableAvecLogo.id, responsableSansLogo.id, administrateur.id);
}, 30000);

afterAll(async () => {
  await prisma.session.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { organisation_id: { in: organisationIds } },
        { utilisateur_id: { in: utilisateurIds } },
      ],
    },
  });
  await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
  await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
});

describe("Organisation dans l'utilisateur connecte", () => {
  it("la connexion renvoie le nom et le logo de l'organisation", async () => {
    const { reponse } = await seConnecter(emailAvecLogo);

    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur.organisation_id).toBe(organisationAvecLogoId);
    expect(reponse.body.utilisateur.organisation).toEqual({ nom: NOM_AVEC_LOGO, logo_url: LOGO });
  });

  it("GET /auth/me renvoie le meme nom et le meme logo", async () => {
    const { agent } = await seConnecter(emailAvecLogo);
    const reponse = await agent.get("/api/v1/auth/me");

    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur.organisation).toEqual({ nom: NOM_AVEC_LOGO, logo_url: LOGO });
  });

  it("une organisation sans logo renvoie logo_url a null", async () => {
    const { agent, reponse } = await seConnecter(emailSansLogo);
    const moi = await agent.get("/api/v1/auth/me");

    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur.organisation).toEqual({ nom: NOM_SANS_LOGO, logo_url: null });
    expect(moi.status).toBe(200);
    expect(moi.body.utilisateur.organisation).toEqual({ nom: NOM_SANS_LOGO, logo_url: null });
  });

  it("l'administrateur DTS n'a pas d'organisation : null a la connexion et sur /auth/me", async () => {
    const { agent, reponse } = await seConnecter(emailAdministrateur);
    const moi = await agent.get("/api/v1/auth/me");

    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur.organisation_id).toBeNull();
    expect(reponse.body.utilisateur.organisation).toBeNull();
    expect(moi.status).toBe(200);
    expect(moi.body.utilisateur.organisation).toBeNull();
  });
});