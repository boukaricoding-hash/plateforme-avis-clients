import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import type { EmailAEnvoyer } from "../../src/utilitaires/envoi-email";

// Les e-mails ne partent pas vraiment : on les garde en memoire pour lire le lien d'invitation.
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

// Jour 18 : utilisateurs et invitations.
// - routes /utilisateurs : reservees au Responsable, isolees par organisation ;
// - routes publiques /invitations : verification du lien, acceptation (usage unique) ;
// - desactivation et reactivation d'un compte.
// L'organisation A essaie de lire ou de modifier ce qui appartient a B : tout doit etre refuse.
// Les deux organisations de test et tous leurs comptes sont supprimes a la fin.
// Attention : la connexion est limitee a 10 essais par minute (sans variable d'environnement).
// Ce fichier en fait 7 : il ne faut pas en ajouter sans en retirer.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Utilisateurs-2026";
const MOT_DE_PASSE_INVITE = "Invite-Utilisateurs-2026";

type Agent = ReturnType<typeof request.agent>;
type Compte = { id: string; email: string };

type OrganisationDeTest = {
  id: string;
  nom: string;
  siteIds: string[];
  responsable: Compte;
  gestionnaire: Compte;
  responsableBis: Compte;
  inactif: Compte;
  cible: Compte;
  agentResponsable: Agent;
};

let motDePasseHash: string;
let orgA: OrganisationDeTest;
let orgB: OrganisationDeTest;
let agentGestionnaireA: Agent;

function adresse(etiquette: string): string {
  return etiquette + "-" + suffixe + "@test-utilisateurs.local";
}

async function creerCompte(
  organisationId: string,
  etiquette: string,
  role: "RESPONSABLE" | "GESTIONNAIRE",
  siteIds: string[],
  actif = true,
): Promise<Compte> {
  const email = adresse(etiquette);
  const utilisateur = await prisma.utilisateur.create({
    data: {
      email,
      mot_de_passe_hash: motDePasseHash,
      nom: "Test " + etiquette,
      role,
      actif,
      organisation_id: organisationId,
    },
    select: { id: true },
  });
  if (siteIds.length > 0) {
    await prisma.utilisateurSite.createMany({
      data: siteIds.map((siteId) => ({ utilisateur_id: utilisateur.id, site_id: siteId })),
    });
  }
  return { id: utilisateur.id, email };
}

// Un "agent" garde le cookie de session entre les requetes.
async function connecterAgent(email: string, motDePasse: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email, mot_de_passe: motDePasse, se_souvenir: false })
    .expect(200);
  return agent;
}

async function creerOrganisation(lettre: "A" | "B"): Promise<OrganisationDeTest> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code: "restauration" } });
  const nom = "TEST-UTILISATEURS-" + lettre + "-" + suffixe;
  const organisation = await prisma.organisation.create({
    data: { nom, secteur_id: secteur.id, statut: "ACTIF" },
    select: { id: true },
  });

  const siteIds: string[] = [];
  for (const numero of [1, 2]) {
    const site = await prisma.site.create({
      data: { organisation_id: organisation.id, nom: "Site " + lettre + numero + " " + suffixe },
      select: { id: true },
    });
    siteIds.push(site.id);
  }
  const premierSite = siteIds[0] as string;
  const minuscule = lettre.toLowerCase();

  const responsable = await creerCompte(organisation.id, "responsable-" + minuscule, "RESPONSABLE", []);
  const gestionnaire = await creerCompte(organisation.id, "gestionnaire-" + minuscule, "GESTIONNAIRE", [premierSite]);
  const responsableBis = await creerCompte(organisation.id, "responsable-bis-" + minuscule, "RESPONSABLE", []);
  const inactif = await creerCompte(organisation.id, "inactif-" + minuscule, "GESTIONNAIRE", [premierSite], false);
  const cible = await creerCompte(organisation.id, "cible-" + minuscule, "GESTIONNAIRE", [premierSite]);

  return {
    id: organisation.id,
    nom,
    siteIds,
    responsable,
    gestionnaire,
    responsableBis,
    inactif,
    cible,
    agentResponsable: await connecterAgent(responsable.email, MOT_DE_PASSE),
  };
}

beforeAll(async () => {
  // Limites hautes : les tests ne doivent pas se bloquer eux-memes (sauf le dernier test).
  process.env["LIMITE_INVITATION_VERIFICATION_MAX"] = "1000";
  process.env["LIMITE_INVITATION_ACCEPTATION_MAX"] = "1000";

  motDePasseHash = await hash(MOT_DE_PASSE, 4);
  orgA = await creerOrganisation("A");
  orgB = await creerOrganisation("B");
  agentGestionnaireA = await connecterAgent(orgA.gestionnaire.email, MOT_DE_PASSE);
}, 30000);

afterAll(async () => {
  delete process.env["LIMITE_INVITATION_VERIFICATION_MAX"];
  delete process.env["LIMITE_INVITATION_ACCEPTATION_MAX"];

  const organisationIds = [orgA?.id, orgB?.id].filter((id): id is string => id !== undefined);
  if (organisationIds.length > 0) {
    // Tous les comptes des deux organisations, y compris ceux crees par une invitation.
    const comptes = await prisma.utilisateur.findMany({
      where: { organisation_id: { in: organisationIds } },
      select: { id: true },
    });
    const utilisateurIds = comptes.map((compte) => compte.id);

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
    await prisma.utilisateurSite.deleteMany({ where: { utilisateur_id: { in: utilisateurIds } } });
    await prisma.utilisateur.deleteMany({ where: { id: { in: utilisateurIds } } });
    await prisma.site.deleteMany({ where: { organisation_id: { in: organisationIds } } });
    await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  }
  await prisma.$disconnect();
}, 30000);

// ------------------------------------------------------------
// Petits outils
// ------------------------------------------------------------

function triees(liste: string[]): string[] {
  return [...liste].sort();
}

async function lireEnBase(utilisateurId: string) {
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: {
      role: true,
      actif: true,
      tentatives_echec: true,
      verrouille_jusqua: true,
      utilisateurs_sites: { select: { site_id: true } },
    },
  });
  return {
    role: utilisateur.role,
    actif: utilisateur.actif,
    tentatives_echec: utilisateur.tentatives_echec,
    verrouille_jusqua: utilisateur.verrouille_jusqua,
    sites: triees(utilisateur.utilisateurs_sites.map((lien) => lien.site_id)),
  };
}

async function compterInvitations(email: string): Promise<number> {
  return prisma.jetonInvitation.count({ where: { email } });
}

async function compterAudit(organisationId: string, actions: string[]): Promise<number> {
  return prisma.auditLog.count({
    where: { organisation_id: organisationId, action: { in: actions } },
  });
}

// Lit le jeton dans le dernier e-mail envoye a cette adresse.
function lireJeton(email: string): string {
  const courrier = [...emailsEnvoyes].reverse().find((message) => message.a === email);
  if (!courrier) {
    throw new Error("Aucun e-mail intercepte pour " + email);
  }
  const jeton = /jeton=([\w-]+)/.exec(courrier.texte)?.[1];
  if (!jeton) {
    throw new Error("Aucun jeton dans l'e-mail");
  }
  return jeton;
}

function inviter(agent: Agent, corps: Record<string, unknown>) {
  return agent.post("/api/v1/utilisateurs/inviter").send(corps);
}

function verifier(jeton?: string) {
  const adresseApi = "/api/v1/invitations/verifier";
  return request(app).get(jeton === undefined ? adresseApi : adresseApi + "?jeton=" + encodeURIComponent(jeton));
}

function accepter(corps: Record<string, unknown>) {
  return request(app).post("/api/v1/invitations/accepter").send(corps);
}

// ------------------------------------------------------------
// Acces et roles
// ------------------------------------------------------------

describe("utilisateurs : acces sans connexion", () => {
  it("les cinq routes du Responsable refusent un visiteur non connecte (401)", async () => {
    const id = orgA.responsable.id;
    await request(app).get("/api/v1/utilisateurs").expect(401);
    await request(app)
      .post("/api/v1/utilisateurs/inviter")
      .send({ email: adresse("anonyme"), role: "RESPONSABLE" })
      .expect(401);
    await request(app).patch("/api/v1/utilisateurs/" + id).send({ role: "RESPONSABLE" }).expect(401);
    await request(app).post("/api/v1/utilisateurs/" + id + "/desactiver").expect(401);
    await request(app).post("/api/v1/utilisateurs/" + id + "/activer").expect(401);
  });

  it("les routes d'invitation sont publiques : un lien absent donne LIEN_INVALIDE, pas 401", async () => {
    const reponse = await verifier().expect(400);
    expect(reponse.body.code).toBe("LIEN_INVALIDE");
  });
});

describe("utilisateurs : roles", () => {
  it("un Gestionnaire n'a acces a aucune route de gestion des utilisateurs (403)", async () => {
    const cible = orgA.responsableBis;
    const avant = await lireEnBase(cible.id);
    const emailInconnu = adresse("refuse-gestionnaire");

    await agentGestionnaireA.get("/api/v1/utilisateurs").expect(403);
    await inviter(agentGestionnaireA, {
      email: emailInconnu,
      role: "GESTIONNAIRE",
      site_ids: [orgA.siteIds[0]],
    }).expect(403);
    await agentGestionnaireA.patch("/api/v1/utilisateurs/" + cible.id).send({ role: "GESTIONNAIRE" }).expect(403);
    await agentGestionnaireA.post("/api/v1/utilisateurs/" + cible.id + "/desactiver").expect(403);
    await agentGestionnaireA.post("/api/v1/utilisateurs/" + cible.id + "/activer").expect(403);

    expect(await lireEnBase(cible.id)).toEqual(avant);
    expect(await compterInvitations(emailInconnu)).toBe(0);
  });
});

// ------------------------------------------------------------
// Isolation entre organisations
// ------------------------------------------------------------

describe("utilisateurs : isolation entre organisations", () => {
  it("A liste ses utilisateurs et ses invitations, jamais ceux de B", async () => {
    // B invite quelqu'un : cette invitation ne doit jamais apparaitre chez A.
    const emailInviteB = adresse("invite-b");
    const invitationB = await inviter(orgB.agentResponsable, {
      email: emailInviteB,
      role: "GESTIONNAIRE",
      site_ids: [orgB.siteIds[0]],
    }).expect(201);
    expect(invitationB.body.invitation.email).toBe(emailInviteB);

    const reponse = await orgA.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    const idsRecus = (reponse.body.utilisateurs as { id: string }[]).map((utilisateur) => utilisateur.id);
    expect(triees(idsRecus)).toEqual(
      triees([
        orgA.responsable.id,
        orgA.gestionnaire.id,
        orgA.responsableBis.id,
        orgA.inactif.id,
        orgA.cible.id,
      ]),
    );

    const texte = JSON.stringify(reponse.body);
    expect(texte).not.toContain(orgB.nom);
    expect(texte).not.toContain(orgB.id);
    expect(texte).not.toContain(emailInviteB);
    expect(texte).not.toContain(orgB.responsable.email);
    for (const siteId of orgB.siteIds) {
      expect(texte).not.toContain(siteId);
    }
    expect(texte).not.toContain("mot_de_passe");

    const reponseB = await orgB.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    const invitationsB = reponseB.body.invitations as { email: string }[];
    expect(invitationsB.map((invitation) => invitation.email)).toEqual([emailInviteB]);
  });

  it("A ne peut ni modifier, ni desactiver, ni activer un utilisateur de B (404)", async () => {
    const actifB = orgB.gestionnaire;
    const inactifB = orgB.inactif;
    const avantActif = await lireEnBase(actifB.id);
    const avantInactif = await lireEnBase(inactifB.id);

    const modification = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + actifB.id)
      .send({ role: "RESPONSABLE" })
      .expect(404);
    expect(modification.body.code).toBe("NON_TROUVE");
    await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + actifB.id)
      .send({ site_ids: [orgA.siteIds[0]] })
      .expect(404);
    await orgA.agentResponsable.post("/api/v1/utilisateurs/" + actifB.id + "/desactiver").expect(404);
    await orgA.agentResponsable.post("/api/v1/utilisateurs/" + inactifB.id + "/activer").expect(404);

    expect(await lireEnBase(actifB.id)).toEqual(avantActif);
    expect(await lireEnBase(inactifB.id)).toEqual(avantInactif);
    expect(avantInactif.actif).toBe(false);

    // Rien n'est ecrit dans le journal de B.
    expect(
      await compterAudit(orgB.id, ["UTILISATEUR_MODIFIE", "UTILISATEUR_DESACTIVE", "UTILISATEUR_REACTIVE"]),
    ).toBe(0);
  });

  it("un identifiant inconnu donne 404, un identifiant mal forme donne 400", async () => {
    const inconnu = "00000000-0000-4000-8000-000000000000";
    await orgA.agentResponsable.patch("/api/v1/utilisateurs/" + inconnu).send({ role: "RESPONSABLE" }).expect(404);
    await orgA.agentResponsable.post("/api/v1/utilisateurs/" + inconnu + "/desactiver").expect(404);
    await orgA.agentResponsable.post("/api/v1/utilisateurs/" + inconnu + "/activer").expect(404);

    const mauvais = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/pas-un-identifiant")
      .send({ role: "RESPONSABLE" })
      .expect(400);
    expect(mauvais.body.code).toBe("DONNEES_INVALIDES");
  });

  it("un site d'une autre organisation est refuse (400), a l'invitation comme a la modification", async () => {
    const emailSiteB = adresse("site-autre-org");
    const emailMixte = adresse("site-mixte");

    const seul = await inviter(orgA.agentResponsable, {
      email: emailSiteB,
      role: "GESTIONNAIRE",
      site_ids: [orgB.siteIds[0]],
    }).expect(400);
    expect(seul.body.code).toBe("SITES_INVALIDES");
    await inviter(orgA.agentResponsable, {
      email: emailMixte,
      role: "GESTIONNAIRE",
      site_ids: [orgA.siteIds[0], orgB.siteIds[0]],
    }).expect(400);
    expect(await compterInvitations(emailSiteB)).toBe(0);
    expect(await compterInvitations(emailMixte)).toBe(0);

    const avant = await lireEnBase(orgA.cible.id);
    const modification = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.cible.id)
      .send({ site_ids: [orgB.siteIds[0]] })
      .expect(400);
    expect(modification.body.code).toBe("SITES_INVALIDES");
    await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.cible.id)
      .send({ site_ids: [orgA.siteIds[0], orgB.siteIds[0]] })
      .expect(400);
    expect(await lireEnBase(orgA.cible.id)).toEqual(avant);
  });

  it("une adresse deja utilisee est refusee (409), sans rien reveler sur une autre organisation", async () => {
    const dejaMembre = await inviter(orgA.agentResponsable, {
      email: orgA.gestionnaire.email,
      role: "RESPONSABLE",
    }).expect(409);
    expect(dejaMembre.body.code).toBe("DEJA_MEMBRE");

    // Meme adresse en majuscules : c'est la meme adresse.
    const majuscules = await inviter(orgA.agentResponsable, {
      email: orgA.gestionnaire.email.toUpperCase(),
      role: "RESPONSABLE",
    }).expect(409);
    expect(majuscules.body.code).toBe("DEJA_MEMBRE");

    const desactive = await inviter(orgA.agentResponsable, {
      email: orgA.inactif.email,
      role: "RESPONSABLE",
    }).expect(409);
    expect(desactive.body.code).toBe("COMPTE_DESACTIVE");

    const autreOrganisation = await inviter(orgA.agentResponsable, {
      email: orgB.gestionnaire.email,
      role: "RESPONSABLE",
    }).expect(409);
    expect(autreOrganisation.body.code).toBe("ADRESSE_INDISPONIBLE");
    expect(JSON.stringify(autreOrganisation.body)).not.toContain(orgB.nom);

    for (const email of [
      orgA.gestionnaire.email,
      orgA.inactif.email,
      orgB.gestionnaire.email,
    ]) {
      expect(await compterInvitations(email)).toBe(0);
    }
  });
});

// ------------------------------------------------------------
// Regles sur son propre compte, le role et les sites
// ------------------------------------------------------------

describe("utilisateurs : son propre compte", () => {
  it("modifier ou desactiver son propre compte est interdit (403)", async () => {
    const avant = await lireEnBase(orgA.responsable.id);

    const modification = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.responsable.id)
      .send({ role: "GESTIONNAIRE", site_ids: [orgA.siteIds[0]] })
      .expect(403);
    expect(modification.body.code).toBe("ACTION_SUR_SOI_INTERDITE");
    const desactivation = await orgA.agentResponsable
      .post("/api/v1/utilisateurs/" + orgA.responsable.id + "/desactiver")
      .expect(403);
    expect(desactivation.body.code).toBe("ACTION_SUR_SOI_INTERDITE");

    expect(await lireEnBase(orgA.responsable.id)).toEqual(avant);
    expect(avant.role).toBe("RESPONSABLE");
    expect(avant.actif).toBe(true);
    // La session du Responsable est toujours ouverte.
    await orgA.agentResponsable.get("/api/v1/auth/me").expect(200);
  });
});

describe("utilisateurs : role et sites", () => {
  it("les donnees invalides sont refusees (400) : role, sites, e-mail, cle inconnue", async () => {
    const emailTest = adresse("donnees-invalides");

    const sansSite = await inviter(orgA.agentResponsable, {
      email: emailTest,
      role: "GESTIONNAIRE",
      site_ids: [],
    }).expect(400);
    expect(sansSite.body.code).toBe("DONNEES_INVALIDES");
    const champs = (sansSite.body.details as { champ: string }[]).map((detail) => detail.champ);
    expect(champs).toContain("site_ids");

    await inviter(orgA.agentResponsable, { email: emailTest, role: "GESTIONNAIRE" }).expect(400);
    await inviter(orgA.agentResponsable, { email: emailTest, role: "ADMINISTRATEUR" }).expect(400);
    await inviter(orgA.agentResponsable, { email: "pas-une-adresse", role: "RESPONSABLE" }).expect(400);
    await inviter(orgA.agentResponsable, {
      email: emailTest,
      role: "RESPONSABLE",
      organisation_id: orgB.id,
    }).expect(400);
    expect(await compterInvitations(emailTest)).toBe(0);

    await orgA.agentResponsable.patch("/api/v1/utilisateurs/" + orgA.cible.id).send({}).expect(400);
    await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.cible.id)
      .send({ role: "ADMINISTRATEUR" })
      .expect(400);
  });

  it("un Gestionnaire garde au moins un site (400 SITES_REQUIS)", async () => {
    const avantGestionnaire = await lireEnBase(orgA.gestionnaire.id);
    const retrait = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.gestionnaire.id)
      .send({ site_ids: [] })
      .expect(400);
    expect(retrait.body.code).toBe("SITES_REQUIS");
    expect(await lireEnBase(orgA.gestionnaire.id)).toEqual(avantGestionnaire);

    // Un Responsable (sans site) ne devient pas Gestionnaire sans qu'on lui donne un site.
    const avantResponsable = await lireEnBase(orgA.responsableBis.id);
    const promotion = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.responsableBis.id)
      .send({ role: "GESTIONNAIRE" })
      .expect(400);
    expect(promotion.body.code).toBe("SITES_REQUIS");
    expect(await lireEnBase(orgA.responsableBis.id)).toEqual(avantResponsable);
  });

  it("changer de role et de sites : un Responsable n'a jamais de site", async () => {
    const [site1, site2] = orgA.siteIds as [string, string];

    const versGestionnaire = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.responsableBis.id)
      .send({ role: "GESTIONNAIRE", site_ids: [site2] })
      .expect(200);
    expect(versGestionnaire.body.utilisateur.role).toBe("GESTIONNAIRE");
    expect((versGestionnaire.body.utilisateur.sites as { id: string }[]).map((site) => site.id)).toEqual([site2]);
    expect(await lireEnBase(orgA.responsableBis.id)).toMatchObject({ role: "GESTIONNAIRE", sites: [site2] });

    // Retour a Responsable : les sites envoyes sont ignores, les liens sont effaces.
    const versResponsable = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.responsableBis.id)
      .send({ role: "RESPONSABLE", site_ids: [site1] })
      .expect(200);
    expect(versResponsable.body.utilisateur.role).toBe("RESPONSABLE");
    expect(versResponsable.body.utilisateur.sites).toEqual([]);
    expect(await lireEnBase(orgA.responsableBis.id)).toMatchObject({ role: "RESPONSABLE", sites: [] });

    // Un Gestionnaire peut avoir plusieurs sites de son organisation.
    const deuxSites = await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.gestionnaire.id)
      .send({ site_ids: [site1, site2] })
      .expect(200);
    expect(deuxSites.body.utilisateur.sites).toHaveLength(2);
    await orgA.agentResponsable
      .patch("/api/v1/utilisateurs/" + orgA.gestionnaire.id)
      .send({ site_ids: [site1] })
      .expect(200);
    expect((await lireEnBase(orgA.gestionnaire.id)).sites).toEqual([site1]);

    expect(await compterAudit(orgA.id, ["UTILISATEUR_MODIFIE"])).toBeGreaterThanOrEqual(4);
  });
});

// ------------------------------------------------------------
// Invitation : de l'e-mail a la connexion
// ------------------------------------------------------------

describe("invitations : parcours complet", () => {
  const emailInvite = adresse("nouvel-invite");
  let jeton = "";
  let agentInvite: Agent;

  it("A invite un Gestionnaire du site 1 : e-mail envoye, jeton jamais stocke en clair", async () => {
    const site1 = orgA.siteIds[0] as string;
    const reponse = await inviter(orgA.agentResponsable, {
      email: emailInvite,
      role: "GESTIONNAIRE",
      site_ids: [site1, site1],
    }).expect(201);

    expect(reponse.body.email_envoye).toBe(true);
    expect(reponse.body.invitation.email).toBe(emailInvite);
    expect(reponse.body.invitation.role).toBe("GESTIONNAIRE");
    // Le doublon de site est retire.
    expect((reponse.body.invitation.sites as { id: string }[]).map((site) => site.id)).toEqual([site1]);

    jeton = lireJeton(emailInvite);
    const lignes = await prisma.jetonInvitation.findMany({ where: { email: emailInvite } });
    expect(lignes).toHaveLength(1);
    const ligne = lignes[0];
    expect(ligne?.token_hash).toBe(empreinteJeton(jeton));
    expect(ligne?.token_hash).not.toBe(jeton);
    expect(ligne?.organisation_id).toBe(orgA.id);
    expect(ligne?.utilise_le).toBeNull();

    // Valable environ 7 jours.
    const joursRestants = ((ligne?.expire_le.getTime() ?? 0) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(joursRestants).toBeGreaterThan(6.9);
    expect(joursRestants).toBeLessThan(7.1);

    // Le journal ne contient jamais l'adresse de l'invite.
    const audits = await prisma.auditLog.findMany({
      where: { organisation_id: orgA.id, action: "UTILISATEUR_INVITE" },
      select: { details: true },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(audits)).not.toContain(emailInvite);

    // L'invitation est listee chez A, sans le jeton.
    const liste = await orgA.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    expect((liste.body.invitations as { email: string }[]).map((invitation) => invitation.email)).toContain(
      emailInvite,
    );
    expect(JSON.stringify(liste.body)).not.toContain(jeton);
  });

  it("le lien se verifie sans connexion ; un lien faux ou absent est refuse (400)", async () => {
    const reponse = await verifier(jeton).expect(200);
    expect(reponse.body).toEqual({ email: emailInvite, organisation: orgA.nom, role: "GESTIONNAIRE" });

    const faux = await verifier("jeton-qui-n-existe-pas").expect(400);
    expect(faux.body.code).toBe("LIEN_INVALIDE");
    await verifier().expect(400);
    await verifier("").expect(400);
  });

  it("un mot de passe refuse ou un nom manquant ne consomme pas le lien", async () => {
    const courant = await accepter({ jeton, nom: "Nouvel Invite", mot_de_passe: "12345678" }).expect(400);
    expect(courant.body.code).toBe("MOT_DE_PASSE_INVALIDE");
    const identique = await accepter({ jeton, nom: "Nouvel Invite", mot_de_passe: emailInvite }).expect(400);
    expect(identique.body.code).toBe("MOT_DE_PASSE_INVALIDE");
    const court = await accepter({ jeton, nom: "Nouvel Invite", mot_de_passe: "abc" }).expect(400);
    expect(court.body.code).toBe("MOT_DE_PASSE_INVALIDE");
    const sansNom = await accepter({ jeton, mot_de_passe: MOT_DE_PASSE_INVITE }).expect(400);
    expect(sansNom.body.code).toBe("DONNEES_INVALIDES");

    await verifier(jeton).expect(200);
    expect(await prisma.utilisateur.count({ where: { email: emailInvite } })).toBe(0);
  });

  it("l'acceptation cree le compte (role, organisation, sites) sans connecter l'invite", async () => {
    const reponse = await accepter({ jeton, nom: "Nouvel Invite", mot_de_passe: MOT_DE_PASSE_INVITE }).expect(201);
    expect(typeof reponse.body.message).toBe("string");
    // L'invite n'est pas connecte : aucun cookie de session n'est pose.
    expect(reponse.headers["set-cookie"]).toBeUndefined();

    const compte = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: emailInvite },
      select: {
        id: true,
        nom: true,
        role: true,
        actif: true,
        organisation_id: true,
        mot_de_passe_hash: true,
      },
    });
    expect(compte.nom).toBe("Nouvel Invite");
    expect(compte.role).toBe("GESTIONNAIRE");
    expect(compte.actif).toBe(true);
    expect(compte.organisation_id).toBe(orgA.id);
    expect(compte.mot_de_passe_hash).not.toContain(MOT_DE_PASSE_INVITE);
    expect(compte.mot_de_passe_hash.startsWith("$2")).toBe(true);
    expect((await lireEnBase(compte.id)).sites).toEqual([orgA.siteIds[0]]);
    expect(await compterAudit(orgA.id, ["INVITATION_ACCEPTEE"])).toBe(1);

    // Le nouveau compte peut se connecter avec son mot de passe.
    agentInvite = await connecterAgent(emailInvite, MOT_DE_PASSE_INVITE);
    await agentInvite.get("/api/v1/auth/me").expect(200);
  });

  it("le lien est a usage unique", async () => {
    const reutilisation = await accepter({
      jeton,
      nom: "Autre Personne",
      mot_de_passe: "Autre-Mot-De-Passe-2026",
    }).expect(400);
    expect(reutilisation.body.code).toBe("LIEN_INVALIDE");
    await verifier(jeton).expect(400);
    expect(await prisma.utilisateur.count({ where: { email: emailInvite } })).toBe(1);
  });

  it("le nouveau Gestionnaire n'a pas acces a la gestion des utilisateurs (403)", async () => {
    await agentInvite.get("/api/v1/utilisateurs").expect(403);
  });
});

describe("invitations : cas particuliers", () => {
  it("inviter de nouveau la meme adresse remplace l'ancien lien", async () => {
    const email = adresse("reinvite");
    const site1 = orgA.siteIds[0] as string;

    await inviter(orgA.agentResponsable, { email, role: "RESPONSABLE", site_ids: [site1] }).expect(201);
    const premierJeton = lireJeton(email);
    const seconde = await inviter(orgA.agentResponsable, { email, role: "RESPONSABLE" }).expect(201);
    const secondJeton = lireJeton(email);

    expect(secondJeton).not.toBe(premierJeton);
    // Pour un Responsable, les sites sont ignores.
    expect(seconde.body.invitation.sites).toEqual([]);
    expect(await prisma.jetonInvitation.count({ where: { email, utilise_le: null } })).toBe(1);

    await verifier(premierJeton).expect(400);
    const valide = await verifier(secondJeton).expect(200);
    expect(valide.body.role).toBe("RESPONSABLE");

    const liste = await orgA.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    const emails = (liste.body.invitations as { email: string }[]).map((invitation) => invitation.email);
    expect(emails.filter((adresseListee) => adresseListee === email)).toHaveLength(1);
  });

  it("un lien expire est refuse partout et n'est plus liste", async () => {
    const email = adresse("expire");
    await inviter(orgA.agentResponsable, { email, role: "RESPONSABLE" }).expect(201);
    const jeton = lireJeton(email);
    await verifier(jeton).expect(200);

    await prisma.jetonInvitation.updateMany({
      where: { email },
      data: { expire_le: new Date(Date.now() - 1000) },
    });

    await verifier(jeton).expect(400);
    const reponse = await accepter({ jeton, nom: "Trop Tard", mot_de_passe: MOT_DE_PASSE_INVITE }).expect(400);
    expect(reponse.body.code).toBe("LIEN_INVALIDE");
    expect(await prisma.utilisateur.count({ where: { email } })).toBe(0);

    const liste = await orgA.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    const emails = (liste.body.invitations as { email: string }[]).map((invitation) => invitation.email);
    expect(emails).not.toContain(email);
  });

  it("si les sites d'un Gestionnaire ont disparu, le lien le dit (SITES_INDISPONIBLES)", async () => {
    const email = adresse("sites-disparus");
    const site2 = orgA.siteIds[1] as string;
    await inviter(orgA.agentResponsable, { email, role: "GESTIONNAIRE", site_ids: [site2] }).expect(201);
    const jeton = lireJeton(email);
    await verifier(jeton).expect(200);

    await prisma.site.update({ where: { id: site2 }, data: { supprime_le: new Date() } });
    try {
      const verification = await verifier(jeton).expect(400);
      expect(verification.body.code).toBe("SITES_INDISPONIBLES");
      const acceptation = await accepter({
        jeton,
        nom: "Sans Site",
        mot_de_passe: MOT_DE_PASSE_INVITE,
      }).expect(400);
      expect(acceptation.body.code).toBe("SITES_INDISPONIBLES");
      expect(await prisma.utilisateur.count({ where: { email } })).toBe(0);
    } finally {
      await prisma.site.update({ where: { id: site2 }, data: { supprime_le: null } });
    }
  });
});

// ------------------------------------------------------------
// Desactivation et reactivation
// ------------------------------------------------------------

describe("utilisateurs : desactivation et reactivation", () => {
  let agentCible: Agent;

  it("un compte desactive est deconnecte, ne peut plus se connecter, et reste dans la liste", async () => {
    const cible = orgA.cible;
    agentCible = await connecterAgent(cible.email, MOT_DE_PASSE);
    await agentCible.get("/api/v1/auth/me").expect(200);

    const reponse = await orgA.agentResponsable
      .post("/api/v1/utilisateurs/" + cible.id + "/desactiver")
      .expect(200);
    expect(reponse.body.utilisateur.actif).toBe(false);
    expect(reponse.body.utilisateur.id).toBe(cible.id);

    // Les sessions sont fermees tout de suite, le compte et son historique restent en base.
    expect(await prisma.session.count({ where: { utilisateur_id: cible.id } })).toBe(0);
    await agentCible.get("/api/v1/auth/me").expect(401);
    const connexion = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: cible.email, mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
      .expect(401);
    expect(connexion.body.code).toBe("IDENTIFIANTS_INVALIDES");
    expect((await lireEnBase(cible.id)).sites).toEqual([orgA.siteIds[0]]);

    const liste = await orgA.agentResponsable.get("/api/v1/utilisateurs").expect(200);
    const ligne = (liste.body.utilisateurs as { id: string; actif: boolean }[]).find(
      (utilisateur) => utilisateur.id === cible.id,
    );
    expect(ligne?.actif).toBe(false);
    expect(await compterAudit(orgA.id, ["UTILISATEUR_DESACTIVE"])).toBeGreaterThanOrEqual(1);
  });

  it("la reactivation remet le compte en service et efface echecs et verrouillage", async () => {
    const cible = orgA.cible;
    await prisma.utilisateur.update({
      where: { id: cible.id },
      data: { tentatives_echec: 5, verrouille_jusqua: new Date(Date.now() + 15 * 60 * 1000) },
    });

    const reponse = await orgA.agentResponsable
      .post("/api/v1/utilisateurs/" + cible.id + "/activer")
      .expect(200);
    expect(reponse.body.utilisateur.actif).toBe(true);

    const apres = await lireEnBase(cible.id);
    expect(apres.actif).toBe(true);
    expect(apres.tentatives_echec).toBe(0);
    expect(apres.verrouille_jusqua).toBeNull();

    await connecterAgent(cible.email, MOT_DE_PASSE);
    expect(await compterAudit(orgA.id, ["UTILISATEUR_REACTIVE"])).toBeGreaterThanOrEqual(1);
  });
});

// ------------------------------------------------------------
// Limite de requetes (a garder en dernier)
// ------------------------------------------------------------

describe("invitations : limite de requetes", () => {
  it("trop d'essais sur les routes publiques donnent 429", async () => {
    // Les appels precedents comptent deja : un maximum de 1 est donc depasse tout de suite.
    process.env["LIMITE_INVITATION_VERIFICATION_MAX"] = "1";
    process.env["LIMITE_INVITATION_ACCEPTATION_MAX"] = "1";

    const verification = await verifier("jeton-quelconque").expect(429);
    expect(verification.body.code).toBe("TROP_DE_REQUETES");
    const acceptation = await accepter({
      jeton: "jeton-quelconque",
      nom: "Test",
      mot_de_passe: MOT_DE_PASSE_INVITE,
    }).expect(429);
    expect(acceptation.body.code).toBe("TROP_DE_REQUETES");

    process.env["LIMITE_INVITATION_VERIFICATION_MAX"] = "1000";
    process.env["LIMITE_INVITATION_ACCEPTATION_MAX"] = "1000";
  });
});