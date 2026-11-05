import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { hash } from "bcryptjs";
import { prisma } from "../../src/configuration/base-de-donnees";

// Isolation entre organisations pour les routes du jour 16 :
// - parametres de l'organisation (GET et PATCH /organisation/parametres),
// - preferences de notification (GET et PATCH /notifications/preferences),
// - logo (POST et DELETE /organisation/logo, fichiers servis sur /api/v1/logos).
// L'organisation A essaie de lire ou de modifier ce qui appartient a B : tout doit etre refuse.
// Les logos sont ecrits dans un dossier temporaire, jamais dans le vrai dossier du projet.

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Isolation-Parametres-2026";
const TAILLE_MAX_LOGO = 1024 * 1024;

type Agent = ReturnType<typeof request.agent>;

type OrganisationDeTest = {
  organisationId: string;
  nom: string;
  responsableId: string;
  gestionnaireId: string;
  agentResponsable: Agent;
  agentGestionnaire: Agent;
};

// Petits fichiers de test : seule la signature (les premiers octets) compte pour le serveur.
const PNG_VALIDE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const AUTRE_PNG = Buffer.concat([PNG_VALIDE, Buffer.from("fin")]);
const JPEG_VALIDE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP_VALIDE = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
  Buffer.from("VP8 ", "ascii"),
]);

let app: Express;
let dossierLogos: string;
let fichierSentinelle: string;
let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;

async function creerOrganisationDeTest(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const nom = "TEST-ISOLATION-PARAMETRES-" + lettre + "-" + suffixe;
  const organisation = await prisma.organisation.create({
    data: { nom, secteur_id: secteur.id, statut: "ACTIF" },
  });

  const motDePasseHash = await hash(MOT_DE_PASSE, 4);
  const emailResponsable = "responsable-" + lettre.toLowerCase() + "-" + suffixe + "@test-parametres.local";
  const emailGestionnaire = "gestionnaire-" + lettre.toLowerCase() + "-" + suffixe + "@test-parametres.local";

  const responsable = await prisma.utilisateur.create({
    data: {
      email: emailResponsable,
      mot_de_passe_hash: motDePasseHash,
      nom: "Responsable " + lettre,
      role: "RESPONSABLE",
      organisation_id: organisation.id,
    },
    select: { id: true },
  });
  const gestionnaire = await prisma.utilisateur.create({
    data: {
      email: emailGestionnaire,
      mot_de_passe_hash: motDePasseHash,
      nom: "Gestionnaire " + lettre,
      role: "GESTIONNAIRE",
      organisation_id: organisation.id,
    },
    select: { id: true },
  });

  // Un "agent" garde le cookie de session entre les requetes.
  const agentResponsable = request.agent(app);
  await agentResponsable
    .post("/api/v1/auth/login")
    .send({ email: emailResponsable, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
  const agentGestionnaire = request.agent(app);
  await agentGestionnaire
    .post("/api/v1/auth/login")
    .send({ email: emailGestionnaire, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);

  return {
    organisationId: organisation.id,
    nom,
    responsableId: responsable.id,
    gestionnaireId: gestionnaire.id,
    agentResponsable,
    agentGestionnaire,
  };
}

beforeAll(async () => {
  // Le dossier des logos est lu au chargement de l'application : on le fixe AVANT de la charger.
  dossierLogos = await fs.mkdtemp(path.join(os.tmpdir(), "logos-test-"));
  fichierSentinelle = path.join(os.tmpdir(), "sentinelle-logos-" + suffixe + ".txt");
  await fs.writeFile(fichierSentinelle, "ne-doit-jamais-etre-supprime");
  process.env["LOGOS_DOSSIER"] = dossierLogos;

  ({ app } = await import("../../src/app"));
  orgA = await creerOrganisationDeTest("A");
  orgB = await creerOrganisationDeTest("B");
}, 30000);

afterAll(async () => {
  const organisationIds = [orgA?.organisationId, orgB?.organisationId].filter(
    (id): id is string => id !== undefined,
  );
  const utilisateurIds = [
    orgA?.responsableId,
    orgA?.gestionnaireId,
    orgB?.responsableId,
    orgB?.gestionnaireId,
  ].filter((id): id is string => id !== undefined);

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
  await prisma.$disconnect();

  delete process.env["LOGOS_DOSSIER"];
  if (dossierLogos !== undefined) {
    await fs.rm(dossierLogos, { recursive: true, force: true });
  }
  if (fichierSentinelle !== undefined) {
    await fs.rm(fichierSentinelle, { force: true });
  }
}, 30000);

async function lireOrganisationEnBase(id: string) {
  return prisma.organisation.findUniqueOrThrow({
    where: { id },
    select: {
      couleur_principale: true,
      seuil_alerte_note: true,
      seuil_alerte_nps: true,
      logo_url: true,
    },
  });
}

async function lirePreferenceEnBase(utilisateurId: string): Promise<boolean> {
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: { alertes_groupees: true },
  });
  return utilisateur.alertes_groupees;
}

async function fichiersDuDossier(): Promise<string[]> {
  return fs.readdir(dossierLogos);
}

async function fichierExiste(chemin: string): Promise<boolean> {
  try {
    await fs.access(chemin);
    return true;
  } catch {
    return false;
  }
}

describe("isolation parametres : acces sans connexion", () => {
  it("toutes les routes du jour 16 refusent un visiteur non connecte (401)", async () => {
    await request(app).get("/api/v1/organisation/parametres").expect(401);
    await request(app).patch("/api/v1/organisation/parametres").send({ seuil_alerte_note: 3 }).expect(401);
    await request(app).get("/api/v1/notifications/preferences").expect(401);
    await request(app).patch("/api/v1/notifications/preferences").send({ alertes_groupees: true }).expect(401);
    await request(app).post("/api/v1/organisation/logo").expect(401);
    await request(app).delete("/api/v1/organisation/logo").expect(401);
  });
});

describe("isolation parametres : roles", () => {
  it("un Gestionnaire ne peut ni lire ni modifier les parametres, ni toucher au logo (403)", async () => {
    await orgA.agentGestionnaire.get("/api/v1/organisation/parametres").expect(403);
    await orgA.agentGestionnaire
      .patch("/api/v1/organisation/parametres")
      .send({ seuil_alerte_note: 4 })
      .expect(403);
    await orgA.agentGestionnaire.post("/api/v1/organisation/logo").expect(403);
    await orgA.agentGestionnaire.delete("/api/v1/organisation/logo").expect(403);

    const apres = await lireOrganisationEnBase(orgA.organisationId);
    expect(apres.seuil_alerte_note).toBe(2);
    expect(apres.logo_url).toBeNull();
  });

  it("un Gestionnaire lit et modifie ses propres preferences de notification (200)", async () => {
    const lecture = await orgA.agentGestionnaire.get("/api/v1/notifications/preferences").expect(200);
    expect(lecture.body).toEqual({ preferences: { alertes_groupees: false } });

    const modification = await orgA.agentGestionnaire
      .patch("/api/v1/notifications/preferences")
      .send({ alertes_groupees: true })
      .expect(200);
    expect(modification.body).toEqual({ preferences: { alertes_groupees: true } });
    expect(await lirePreferenceEnBase(orgA.gestionnaireId)).toBe(true);
  });
});

describe("isolation parametres : parametres de l'organisation", () => {
  it("A lit ses propres parametres, jamais ceux de B", async () => {
    const reponse = await orgA.agentResponsable.get("/api/v1/organisation/parametres").expect(200);
    expect(reponse.body.parametres.nom).toBe(orgA.nom);
    expect(reponse.body.parametres.seuil_alerte_note).toBe(2);
    expect(reponse.body.parametres.seuil_alerte_nps).toBe(6);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.nom);
    expect(JSON.stringify(reponse.body)).not.toContain(orgB.organisationId);
  });

  it("A modifie ses parametres (200) : ceux de B ne changent pas", async () => {
    const reponse = await orgA.agentResponsable
      .patch("/api/v1/organisation/parametres")
      .send({ couleur_principale: "#112233", seuil_alerte_note: 3, seuil_alerte_nps: 7 })
      .expect(200);
    expect(reponse.body.parametres.couleur_principale).toBe("#112233");
    expect(reponse.body.parametres.seuil_alerte_note).toBe(3);
    expect(reponse.body.parametres.seuil_alerte_nps).toBe(7);

    const a = await lireOrganisationEnBase(orgA.organisationId);
    expect(a).toMatchObject({ couleur_principale: "#112233", seuil_alerte_note: 3, seuil_alerte_nps: 7 });

    const b = await lireOrganisationEnBase(orgB.organisationId);
    expect(b).toEqual({ couleur_principale: null, seuil_alerte_note: 2, seuil_alerte_nps: 6, logo_url: null });
  });

  it("envoyer l'organisation de B dans le corps est refuse (400), rien n'est modifie", async () => {
    const avantA = await lireOrganisationEnBase(orgA.organisationId);
    const avantB = await lireOrganisationEnBase(orgB.organisationId);

    const reponse = await orgA.agentResponsable
      .patch("/api/v1/organisation/parametres")
      .send({ organisation_id: orgB.organisationId, seuil_alerte_note: 1 })
      .expect(400);
    expect(reponse.body.code).toBe("DONNEES_INVALIDES");

    expect(await lireOrganisationEnBase(orgA.organisationId)).toEqual(avantA);
    expect(await lireOrganisationEnBase(orgB.organisationId)).toEqual(avantB);
  });

  it("les valeurs hors limites sont refusees (400) et rien n'est modifie", async () => {
    const avant = await lireOrganisationEnBase(orgA.organisationId);
    const refusees = [
      {},
      { seuil_alerte_note: 5 },
      { seuil_alerte_note: 0 },
      { seuil_alerte_note: 2.5 },
      { seuil_alerte_note: "3" },
      { seuil_alerte_nps: 10 },
      { seuil_alerte_nps: -1 },
      { couleur_principale: "rouge" },
      { couleur_principale: "#12345" },
    ];
    for (const corps of refusees) {
      await orgA.agentResponsable.patch("/api/v1/organisation/parametres").send(corps).expect(400);
    }
    expect(await lireOrganisationEnBase(orgA.organisationId)).toEqual(avant);
  });

  it("couleur_principale a null efface la couleur de A seulement", async () => {
    const reponse = await orgA.agentResponsable
      .patch("/api/v1/organisation/parametres")
      .send({ couleur_principale: null })
      .expect(200);
    expect(reponse.body.parametres.couleur_principale).toBeNull();
    expect((await lireOrganisationEnBase(orgA.organisationId)).couleur_principale).toBeNull();
  });

  it("les modifications de A sont dans le journal d'audit de A, et pas dans celui de B", async () => {
    const pourA = await prisma.auditLog.count({
      where: { organisation_id: orgA.organisationId, action: "PARAMETRES_ORGANISATION_MODIFIES" },
    });
    const pourB = await prisma.auditLog.count({
      where: { organisation_id: orgB.organisationId, action: "PARAMETRES_ORGANISATION_MODIFIES" },
    });
    expect(pourA).toBeGreaterThanOrEqual(2);
    expect(pourB).toBe(0);
  });
});

describe("isolation parametres : preferences de notification", () => {
  it("chacun ne lit que ses propres preferences", async () => {
    const reponse = await orgB.agentResponsable.get("/api/v1/notifications/preferences").expect(200);
    expect(reponse.body).toEqual({ preferences: { alertes_groupees: false } });
  });

  it("A change sa preference (200) : celles de B ne changent pas", async () => {
    const reponse = await orgA.agentResponsable
      .patch("/api/v1/notifications/preferences")
      .send({ alertes_groupees: true })
      .expect(200);
    expect(reponse.body).toEqual({ preferences: { alertes_groupees: true } });

    expect(await lirePreferenceEnBase(orgA.responsableId)).toBe(true);
    expect(await lirePreferenceEnBase(orgB.responsableId)).toBe(false);
    expect(await lirePreferenceEnBase(orgB.gestionnaireId)).toBe(false);
  });

  it("envoyer l'identifiant d'un autre utilisateur ou une valeur invalide est refuse (400)", async () => {
    await orgA.agentResponsable
      .patch("/api/v1/notifications/preferences")
      .send({ utilisateur_id: orgB.responsableId, alertes_groupees: true })
      .expect(400);
    await orgA.agentResponsable
      .patch("/api/v1/notifications/preferences")
      .send({ alertes_groupees: "oui" })
      .expect(400);
    await orgA.agentResponsable.patch("/api/v1/notifications/preferences").send({}).expect(400);

    expect(await lirePreferenceEnBase(orgB.responsableId)).toBe(false);
    expect(await lirePreferenceEnBase(orgA.responsableId)).toBe(true);
  });
});

describe("isolation parametres : logo", () => {
  it("A envoie un PNG valide (200) : le fichier est range et servi, B n'a toujours aucun logo", async () => {
    const reponse = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", PNG_VALIDE, { filename: "logo.png", contentType: "image/png" })
      .expect(200);

    const adresse = reponse.body.logo_url as string;
    expect(adresse).toMatch(/^\/api\/v1\/logos\/[0-9a-f-]{36}\.png$/);
    expect((await lireOrganisationEnBase(orgA.organisationId)).logo_url).toBe(adresse);
    expect(await fichiersDuDossier()).toEqual([adresse.slice("/api/v1/logos/".length)]);

    // Le logo est public : on le lit sans etre connecte.
    const fichier = await request(app).get(adresse).expect(200);
    expect(fichier.headers["content-type"]).toContain("image/png");
    expect(Number(fichier.headers["content-length"])).toBe(PNG_VALIDE.length);

    expect((await lireOrganisationEnBase(orgB.organisationId)).logo_url).toBeNull();
    const parametresB = await orgB.agentResponsable.get("/api/v1/organisation/parametres").expect(200);
    expect(parametresB.body.parametres.logo_url).toBeNull();
  });

  it("B retire son logo (il n'en a pas) : 200, et le logo de A reste en place", async () => {
    const avantA = await lireOrganisationEnBase(orgA.organisationId);
    const fichiersAvant = await fichiersDuDossier();

    const reponse = await orgB.agentResponsable.delete("/api/v1/organisation/logo").expect(200);
    expect(reponse.body).toEqual({ logo_url: null });

    expect((await lireOrganisationEnBase(orgA.organisationId)).logo_url).toBe(avantA.logo_url);
    expect(await fichiersDuDossier()).toEqual(fichiersAvant);
  });

  it("A remplace son logo : l'ancien fichier disparait, le nouveau est servi", async () => {
    const ancienne = (await lireOrganisationEnBase(orgA.organisationId)).logo_url as string;

    const reponse = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", AUTRE_PNG, { filename: "nouveau.png", contentType: "image/png" })
      .expect(200);
    const nouvelle = reponse.body.logo_url as string;

    expect(nouvelle).not.toBe(ancienne);
    expect(await fichiersDuDossier()).toEqual([nouvelle.slice("/api/v1/logos/".length)]);
    await request(app).get(ancienne).expect(404);
    await request(app).get(nouvelle).expect(200);
  });

  it("JPEG et WebP sont acceptes, reconnus d'apres leur contenu et non d'apres leur nom", async () => {
    const jpeg = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", JPEG_VALIDE, { filename: "photo.png", contentType: "image/png" })
      .expect(200);
    expect(jpeg.body.logo_url).toMatch(/\.jpg$/);

    const webp = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", WEBP_VALIDE, { filename: "logo.jpg", contentType: "image/jpeg" })
      .expect(200);
    expect(webp.body.logo_url).toMatch(/\.webp$/);

    // Un seul fichier reste : celui du dernier logo.
    expect(await fichiersDuDossier()).toHaveLength(1);
  });

  it("A retire son logo : fichier supprime, adresse vide, B intact ; un second retrait reussit aussi", async () => {
    const reponse = await orgA.agentResponsable.delete("/api/v1/organisation/logo").expect(200);
    expect(reponse.body).toEqual({ logo_url: null });
    expect((await lireOrganisationEnBase(orgA.organisationId)).logo_url).toBeNull();
    expect(await fichiersDuDossier()).toEqual([]);
    expect((await lireOrganisationEnBase(orgB.organisationId)).logo_url).toBeNull();

    await orgA.agentResponsable.delete("/api/v1/organisation/logo").expect(200);
  });

  it("les fichiers invalides sont refuses (400) et rien n'est ecrit", async () => {
    const fauxPng = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", Buffer.from("ceci n'est pas une image"), { filename: "faux.png", contentType: "image/png" })
      .expect(400);
    expect(fauxPng.body.code).toBe("LOGO_FORMAT_INVALIDE");

    // Le SVG est refuse volontairement : il peut contenir du code.
    const svg = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: "logo.svg",
        contentType: "image/svg+xml",
      })
      .expect(400);
    expect(svg.body.code).toBe("LOGO_FORMAT_INVALIDE");

    const gif = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", Buffer.from("GIF89a-contenu"), { filename: "logo.gif", contentType: "image/gif" })
      .expect(400);
    expect(gif.body.code).toBe("LOGO_FORMAT_INVALIDE");

    expect(await fichiersDuDossier()).toEqual([]);
    expect((await lireOrganisationEnBase(orgA.organisationId)).logo_url).toBeNull();
  });

  it("un fichier de plus de 1 Mo est refuse (400 LOGO_TROP_VOLUMINEUX)", async () => {
    const trop = Buffer.concat([PNG_VALIDE, Buffer.alloc(TAILLE_MAX_LOGO)]);
    const reponse = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", trop, { filename: "gros.png", contentType: "image/png" })
      .expect(400);
    expect(reponse.body.code).toBe("LOGO_TROP_VOLUMINEUX");
    expect(await fichiersDuDossier()).toEqual([]);
  });

  it("un envoi sans fichier, avec un autre champ, avec deux fichiers ou sous un autre nom est refuse (400)", async () => {
    const sansFichier = await orgA.agentResponsable.post("/api/v1/organisation/logo").expect(400);
    expect(sansFichier.body.code).toBe("LOGO_MANQUANT");

    const autreNom = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("fichier", PNG_VALIDE, { filename: "logo.png", contentType: "image/png" })
      .expect(400);
    expect(autreNom.body.code).toBe("LOGO_INVALIDE");

    const champEnPlus = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .field("organisation_id", orgB.organisationId)
      .attach("logo", PNG_VALIDE, { filename: "logo.png", contentType: "image/png" })
      .expect(400);
    expect(champEnPlus.body.code).toBe("LOGO_INVALIDE");

    const deuxFichiers = await orgA.agentResponsable
      .post("/api/v1/organisation/logo")
      .attach("logo", PNG_VALIDE, { filename: "un.png", contentType: "image/png" })
      .attach("logo", AUTRE_PNG, { filename: "deux.png", contentType: "image/png" })
      .expect(400);
    expect(deuxFichiers.body.code).toBe("LOGO_INVALIDE");

    expect(await fichiersDuDossier()).toEqual([]);
    expect((await lireOrganisationEnBase(orgA.organisationId)).logo_url).toBeNull();
    expect((await lireOrganisationEnBase(orgB.organisationId)).logo_url).toBeNull();
  });

  it("une adresse de logo qui sort du dossier ne fait supprimer aucun fichier", async () => {
    // Cas extreme : une adresse piegee ecrite directement en base pour B.
    await prisma.organisation.update({
      where: { id: orgB.organisationId },
      data: { logo_url: "/api/v1/logos/../" + path.basename(fichierSentinelle) },
    });

    await orgB.agentResponsable.delete("/api/v1/organisation/logo").expect(200);

    expect(await fichierExiste(fichierSentinelle)).toBe(true);
    expect((await lireOrganisationEnBase(orgB.organisationId)).logo_url).toBeNull();
  });

  it("l'adresse publique des logos ne laisse lire aucun fichier hors du dossier", async () => {
    const reponse = await request(app).get("/api/v1/logos/..%2F" + path.basename(fichierSentinelle));
    expect([400, 403, 404]).toContain(reponse.status);
    expect(JSON.stringify(reponse.body)).not.toContain("ne-doit-jamais");
    expect(reponse.text ?? "").not.toContain("ne-doit-jamais");
  });
});