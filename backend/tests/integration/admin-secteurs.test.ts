import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { hash } from "bcryptjs";
import { app } from "../../src/app";
import { prisma } from "../../src/configuration/base-de-donnees";

// Jour 22 : back-office DTS, routes /api/v1/admin/secteurs.
// - creation, lecture, liste et modification d'un secteur (vocabulaire, indicateurs suggeres) ;
// - themes d'un secteur (creation, modification, isolation entre secteurs) ;
// - questionnaires types : les 6 modeles du seed (annexe A) sont lisibles et coherents.
// Les controles d'acces (visiteur, Responsable) sont dans isolation-admin.test.ts.
// Prerequis : le seed a ete lance (secteurs, themes et modeles sectoriels).
// Attention : la connexion est limitee a 10 essais par minute. Ce fichier en fait 1.
// Les secteurs, themes, organisations et comptes de test sont supprimes a la fin.

// Delai large : sous charge, le hachage bcrypt est lent
vi.setConfig({ testTimeout: 30000 });

const suffixe = randomBytes(4).toString("hex");
const MOT_DE_PASSE = "Test-Admin-Secteurs-2026";
const MESSAGE_SANTE = "Ne mentionnez aucune information médicale personnelle.";
const ID_INCONNU = "00000000-0000-4000-8000-000000000000";

type Agent = ReturnType<typeof request.agent>;

let agentAdmin: Agent;
let adminId = "";

// Ce que les tests creent (nettoye a la fin)
const secteurIds: string[] = [];
const organisationIds: string[] = [];

// Secteur A (actif, sert aux themes) et secteur B (cree inactif)
const codeA = "test_" + suffixe;
const codeB = "test_inactif_" + suffixe;
let idA = "";
let idB = "";

type Theme = { id: string; code: string; libelle_fr: string; libelle_en: string; ordre: number };
type Question = {
  ordre: number;
  type: string;
  obligatoire: boolean;
  libelle: { fr: string; en?: string };
  options: { fr: string; en?: string }[] | null;
  theme: { code: string } | null;
};
type ModeleType = {
  titre: { fr: string; en: string };
  message_accueil: { fr: string; en: string };
  questions: Question[];
};

async function idSecteurParCode(code: string): Promise<string> {
  const secteur = await prisma.secteur.findUniqueOrThrow({ where: { code }, select: { id: true } });
  return secteur.id;
}

// Cree un secteur par l'API et le note pour le nettoyage.
async function creerSecteurParApi(corps: Record<string, unknown>) {
  const reponse = await agentAdmin.post("/api/v1/admin/secteurs").send(corps);
  const id = reponse.body?.secteur?.id;
  if (typeof id === "string") {
    secteurIds.push(id);
  }
  return reponse;
}

async function lireThemes(secteurId: string): Promise<Theme[]> {
  const reponse = await agentAdmin.get("/api/v1/admin/secteurs/" + secteurId).expect(200);
  return reponse.body.secteur.themes as Theme[];
}

async function lireModeles(secteurId: string): Promise<ModeleType[]> {
  const reponse = await agentAdmin
    .get("/api/v1/admin/secteurs/" + secteurId + "/questionnaires-types")
    .expect(200);
  return reponse.body.questionnaires_types as ModeleType[];
}

// Lignes du journal ecrites par cet administrateur pour une action (et un secteur si indique).
async function lignesAudit(action: string, secteurId?: string) {
  const lignes = await prisma.auditLog.findMany({
    where: { action, utilisateur_id: adminId },
    select: { details: true },
  });
  if (secteurId === undefined) {
    return lignes;
  }
  return lignes.filter((ligne) => (ligne.details as { secteur_id?: string } | null)?.secteur_id === secteurId);
}

beforeAll(async () => {
  const admin = await prisma.utilisateur.create({
    data: {
      email: "admin-" + suffixe + "@test-admin-secteurs.local",
      mot_de_passe_hash: await hash(MOT_DE_PASSE, 4),
      nom: "Admin test secteurs",
      role: "ADMINISTRATEUR",
    },
    select: { id: true },
  });
  adminId = admin.id;

  agentAdmin = request.agent(app);
  await agentAdmin
    .post("/api/v1/auth/login")
    .send({ email: "admin-" + suffixe + "@test-admin-secteurs.local", mot_de_passe: MOT_DE_PASSE, se_souvenir: false })
    .expect(200);
}, 60000);

afterAll(async () => {
  if (organisationIds.length > 0) {
    await prisma.question.deleteMany({
      where: { version: { questionnaire: { organisation_id: { in: organisationIds } } } },
    });
    await prisma.questionnaireVersion.deleteMany({
      where: { questionnaire: { organisation_id: { in: organisationIds } } },
    });
    await prisma.questionnaire.deleteMany({ where: { organisation_id: { in: organisationIds } } });
  }
  if (adminId) {
    await prisma.auditLog.deleteMany({
      where: { OR: [{ utilisateur_id: adminId }, { organisation_id: { in: organisationIds } }] },
    });
    await prisma.session.deleteMany({ where: { utilisateur_id: adminId } });
    await prisma.utilisateur.deleteMany({ where: { id: adminId } });
  }
  if (organisationIds.length > 0) {
    await prisma.organisation.deleteMany({ where: { id: { in: organisationIds } } });
  }
  if (secteurIds.length > 0) {
    await prisma.theme.deleteMany({ where: { secteur_id: { in: secteurIds } } });
    await prisma.secteur.deleteMany({ where: { id: { in: secteurIds } } });
  }
  await prisma.$disconnect();
}, 60000);

// ------------------------------------------------------------
// Creation d'un secteur
// ------------------------------------------------------------

describe("admin secteurs : creation", () => {
  it("cree un secteur avec son vocabulaire et ses indicateurs, puis un secteur inactif par defaut", async () => {
    const reponse = await creerSecteurParApi({
      code: codeA,
      nom_fr: "Secteur test " + suffixe,
      nom_en: "Test sector " + suffixe,
      vocabulaire: { point_contact: "salle", personne: "élève" },
      indicateurs_suggeres: ["nps", "note_moyenne"],
    });
    expect(reponse.status).toBe(201);
    const secteur = reponse.body.secteur;
    idA = secteur.id as string;
    expect(secteur.code).toBe(codeA);
    expect(secteur.vocabulaire).toEqual({ point_contact: "salle", personne: "élève" });
    expect(secteur.indicateurs_suggeres).toEqual(["nps", "note_moyenne"]);
    expect(secteur.actif).toBe(true);
    expect(secteur.themes).toEqual([]);

    // Valeurs par defaut : sans indicateurs, une liste vide ; actif peut etre mis a faux
    const inactif = await creerSecteurParApi({
      code: codeB,
      nom_fr: "Secteur inactif " + suffixe,
      nom_en: "Inactive sector " + suffixe,
      vocabulaire: { point_contact: "stand" },
      actif: false,
    });
    expect(inactif.status).toBe(201);
    idB = inactif.body.secteur.id as string;
    expect(inactif.body.secteur.indicateurs_suggeres).toEqual([]);
    expect(inactif.body.secteur.actif).toBe(false);

    expect((await lignesAudit("SECTEUR_CREE")).length).toBe(2);
  });

  it("refuse un code deja utilise (409), y compris celui d'un secteur du seed", async () => {
    const corps = {
      nom_fr: "Doublon",
      nom_en: "Duplicate",
      vocabulaire: { point_contact: "salle" },
    };
    const doublon = await agentAdmin.post("/api/v1/admin/secteurs").send({ ...corps, code: codeA });
    expect(doublon.status).toBe(409);
    expect(doublon.body.code).toBe("CODE_DEJA_UTILISE");

    const seed = await agentAdmin.post("/api/v1/admin/secteurs").send({ ...corps, code: "restauration" });
    expect(seed.status).toBe(409);
    expect(seed.body.code).toBe("CODE_DEJA_UTILISE");
  });

  it("refuse les donnees invalides sans rien creer", async () => {
    const codeRefuse = "test_refuse_" + suffixe;
    const base = {
      code: codeRefuse,
      nom_fr: "Refusé",
      nom_en: "Refused",
      vocabulaire: { point_contact: "salle" },
    };
    const onzeMots = {
      point_contact: "salle",
      ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["mot" + i, "x"])),
    };
    const sansNomEn: Record<string, unknown> = { ...base };
    delete sansNomEn["nom_en"];

    const invalides: Record<string, unknown>[] = [
      { ...base, code: "Majuscules" },
      { ...base, code: "a" },
      { ...base, code: "1abc" },
      { ...base, code: "x".repeat(41) },
      sansNomEn,
      { ...base, vocabulaire: {} },
      { ...base, vocabulaire: { salle: "x" } },
      { ...base, vocabulaire: "table" },
      { ...base, vocabulaire: onzeMots },
      { ...base, indicateurs_suggeres: ["nps", "nps"] },
      { ...base, indicateurs_suggeres: ["NPS"] },
      { ...base, actif: "oui" },
      // Les themes ne se creent pas avec le secteur : tout champ inconnu est refuse
      { ...base, themes: [] },
    ];
    for (const corps of invalides) {
      const reponse = await agentAdmin.post("/api/v1/admin/secteurs").send(corps);
      expect(reponse.status).toBe(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
    }
    expect(await prisma.secteur.count({ where: { code: codeRefuse } })).toBe(0);
  });
});

// ------------------------------------------------------------
// Lecture et liste
// ------------------------------------------------------------

describe("admin secteurs : lecture et liste", () => {
  it("liste les secteurs avec leurs themes et leurs organisations, et filtre sur actif", async () => {
    const liste = await agentAdmin.get("/api/v1/admin/secteurs").expect(200);
    const secteurs = liste.body.secteurs as {
      id: string;
      code: string;
      actif: boolean;
      nombre_themes: number;
      nombre_organisations: number;
    }[];

    // Les 6 secteurs du seed, avec au moins leurs themes de depart
    const attendus: Record<string, number> = {
      restauration: 6,
      sante: 6,
      education: 6,
      agroalimentaire: 6,
      evenement: 6,
      general: 4,
    };
    for (const [code, themes] of Object.entries(attendus)) {
      const secteur = secteurs.find((s) => s.code === code);
      expect(secteur, "secteur " + code).toBeDefined();
      expect(secteur?.nombre_themes).toBeGreaterThanOrEqual(themes);
      expect(typeof secteur?.nombre_organisations).toBe("number");
    }
    expect(secteurs.find((s) => s.code === codeA)?.nombre_themes).toBe(0);

    const actifs = await agentAdmin.get("/api/v1/admin/secteurs?actif=true").expect(200);
    const idsActifs = (actifs.body.secteurs as { id: string }[]).map((s) => s.id);
    expect(idsActifs).toContain(idA);
    expect(idsActifs).not.toContain(idB);

    const inactifs = await agentAdmin.get("/api/v1/admin/secteurs?actif=false").expect(200);
    const idsInactifs = (inactifs.body.secteurs as { id: string }[]).map((s) => s.id);
    expect(idsInactifs).toContain(idB);
    expect(idsInactifs).not.toContain(idA);

    await agentAdmin.get("/api/v1/admin/secteurs?actif=oui").expect(400);
  });

  it("lit un secteur du seed avec ses themes dans l'ordre, et refuse un identifiant inconnu ou mal forme", async () => {
    const restauration = await idSecteurParCode("restauration");
    const lecture = await agentAdmin.get("/api/v1/admin/secteurs/" + restauration).expect(200);
    expect(lecture.body.secteur.code).toBe("restauration");
    expect(lecture.body.secteur.vocabulaire.point_contact).toBe("table");

    const themes = lecture.body.secteur.themes as Theme[];
    expect(themes.map((t) => t.code)).toEqual(
      expect.arrayContaining(["accueil", "qualite_plats", "rapidite", "proprete", "prix", "ambiance"]),
    );
    const ordres = themes.map((t) => t.ordre);
    expect(ordres).toEqual([...ordres].sort((a, b) => a - b));

    const inconnu = await agentAdmin.get("/api/v1/admin/secteurs/" + ID_INCONNU).expect(404);
    expect(inconnu.body.code).toBe("NON_TROUVE");
    const malForme = await agentAdmin.get("/api/v1/admin/secteurs/abc").expect(400);
    expect(malForme.body.code).toBe("DONNEES_INVALIDES");
  });
});

// ------------------------------------------------------------
// Modification d'un secteur
// ------------------------------------------------------------

describe("admin secteurs : modification", () => {
  it("modifie les noms, le vocabulaire, les indicateurs et l'etat, mais jamais le code", async () => {
    const modifie = await agentAdmin
      .patch("/api/v1/admin/secteurs/" + idA)
      .send({
        nom_fr: "Secteur test modifié",
        vocabulaire: { point_contact: "stand" },
        indicateurs_suggeres: ["nps"],
        actif: false,
      })
      .expect(200);
    expect(modifie.body.secteur.code).toBe(codeA);
    expect(modifie.body.secteur.nom_fr).toBe("Secteur test modifié");
    expect(modifie.body.secteur.nom_en).toBe("Test sector " + suffixe);
    expect(modifie.body.secteur.vocabulaire).toEqual({ point_contact: "stand" });
    expect(modifie.body.secteur.indicateurs_suggeres).toEqual(["nps"]);
    expect(modifie.body.secteur.actif).toBe(false);

    // Le journal garde les noms des champs changes, pas leur contenu
    const lignes = await lignesAudit("SECTEUR_MODIFIE", idA);
    expect(lignes).toHaveLength(1);
    const champs = (lignes[0]?.details as { champs?: string } | null)?.champs ?? "";
    expect(champs).toContain("nom_fr");
    expect(champs).toContain("actif");
    expect(champs).not.toContain("code");

    // Refuses : le code, un corps vide, un vocabulaire sans point_contact, un actif qui n'est pas booleen
    const refuses: Record<string, unknown>[] = [
      { code: "autre_code" },
      {},
      { vocabulaire: { salle: "x" } },
      { actif: "non" },
    ];
    for (const corps of refuses) {
      const reponse = await agentAdmin.patch("/api/v1/admin/secteurs/" + idA).send(corps);
      expect(reponse.status).toBe(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
    }
    expect((await prisma.secteur.findUniqueOrThrow({ where: { id: idA } })).code).toBe(codeA);

    await agentAdmin.patch("/api/v1/admin/secteurs/" + ID_INCONNU).send({ nom_fr: "Inconnu" }).expect(404);
  });

  it("un secteur desactive n'est plus propose a la creation d'une organisation, reactive il l'est de nouveau", async () => {
    const corps = { nom: "TEST-ADMIN-SECTEURS-" + suffixe, secteur_id: idA };

    // Le secteur A est inactif (test precedent)
    const refus = await agentAdmin.post("/api/v1/admin/organisations").send(corps);
    expect(refus.status).toBe(400);
    expect(refus.body.code).toBe("SECTEUR_INVALIDE");

    const reactive = await agentAdmin.patch("/api/v1/admin/secteurs/" + idA).send({ actif: true }).expect(200);
    expect(reactive.body.secteur.actif).toBe(true);

    // Ce secteur n'a pas de modele : l'organisation est creee, sans questionnaire copie
    const creation = await agentAdmin.post("/api/v1/admin/organisations").send(corps);
    expect(creation.status).toBe(201);
    organisationIds.push(creation.body.organisation.id as string);
    expect(creation.body.organisation.secteur.code).toBe(codeA);
    expect(creation.body.questionnaire_id).toBeNull();
  });
});

// ------------------------------------------------------------
// Themes
// ------------------------------------------------------------

describe("admin secteurs : themes", () => {
  it("cree des themes (ordre automatique ou choisi) et refuse les doublons et les donnees invalides", async () => {
    const adresseA = "/api/v1/admin/secteurs/" + idA + "/themes";

    const premier = await agentAdmin
      .post(adresseA)
      .send({ code: "accueil_test", libelle_fr: "Accueil test", libelle_en: "Test welcome" })
      .expect(201);
    expect(premier.body.theme.code).toBe("accueil_test");
    expect(premier.body.theme.ordre).toBe(1);

    const deuxieme = await agentAdmin
      .post(adresseA)
      .send({ code: "rapidite_test", libelle_fr: "Rapidité test", libelle_en: "Test speed" })
      .expect(201);
    expect(deuxieme.body.theme.ordre).toBe(2);

    const choisi = await agentAdmin
      .post(adresseA)
      .send({ code: "prix_test", libelle_fr: "Prix test", libelle_en: "Test price", ordre: 10 })
      .expect(201);
    expect(choisi.body.theme.ordre).toBe(10);

    // Le meme code est refuse dans le meme secteur, mais permis dans un autre
    const doublon = await agentAdmin
      .post(adresseA)
      .send({ code: "accueil_test", libelle_fr: "Autre", libelle_en: "Other" });
    expect(doublon.status).toBe(409);
    expect(doublon.body.code).toBe("CODE_DEJA_UTILISE");
    await agentAdmin
      .post("/api/v1/admin/secteurs/" + idB + "/themes")
      .send({ code: "accueil_test", libelle_fr: "Accueil test", libelle_en: "Test welcome" })
      .expect(201);

    const valide = { code: "theme_valide", libelle_fr: "Thème valide", libelle_en: "Valid theme" };
    const invalides: Record<string, unknown>[] = [
      { ...valide, code: "Accueil" },
      { ...valide, libelle_fr: "A" },
      { ...valide, ordre: -1 },
      { ...valide, ordre: 1.5 },
      { ...valide, questions: [] },
    ];
    for (const corps of invalides) {
      const reponse = await agentAdmin.post(adresseA).send(corps);
      expect(reponse.status).toBe(400);
      expect(reponse.body.code).toBe("DONNEES_INVALIDES");
    }

    await agentAdmin.post("/api/v1/admin/secteurs/" + ID_INCONNU + "/themes").send(valide).expect(404);
    await agentAdmin.post("/api/v1/admin/secteurs/abc/themes").send(valide).expect(400);

    // Les themes sortent dans l'ordre, et chaque creation est dans le journal (3 en A, 1 en B)
    const themes = await lireThemes(idA);
    expect(themes.map((t) => t.code)).toEqual(["accueil_test", "rapidite_test", "prix_test"]);
    expect((await lignesAudit("THEME_CREE")).length).toBe(4);
  });

  it("modifie un theme sans changer son code, et refuse le theme d'un autre secteur", async () => {
    const themes = await lireThemes(idA);
    const accueil = themes.find((t) => t.code === "accueil_test");
    expect(accueil).toBeDefined();
    const adresseTheme = "/api/v1/admin/secteurs/" + idA + "/themes/" + (accueil?.id ?? "");

    const modifie = await agentAdmin
      .patch(adresseTheme)
      .send({ libelle_fr: "Accueil modifié", ordre: 5 })
      .expect(200);
    expect(modifie.body.theme.code).toBe("accueil_test");
    expect(modifie.body.theme.libelle_fr).toBe("Accueil modifié");
    expect(modifie.body.theme.libelle_en).toBe("Test welcome");
    expect(modifie.body.theme.ordre).toBe(5);
    expect((await lireThemes(idA)).map((t) => t.code)).toEqual(["rapidite_test", "accueil_test", "prix_test"]);

    // Refuses : le code et un corps vide
    await agentAdmin.patch(adresseTheme).send({ code: "autre" }).expect(400);
    await agentAdmin.patch(adresseTheme).send({}).expect(400);

    // Un theme du secteur restauration n'est pas modifiable depuis le secteur A
    const restauration = await idSecteurParCode("restauration");
    const themeRestauration = await prisma.theme.findFirstOrThrow({
      where: { secteur_id: restauration, code: "accueil" },
      select: { id: true, libelle_fr: true },
    });
    const autreSecteur = await agentAdmin
      .patch("/api/v1/admin/secteurs/" + idA + "/themes/" + themeRestauration.id)
      .send({ libelle_fr: "Piratage" });
    expect(autreSecteur.status).toBe(404);
    expect(autreSecteur.body.code).toBe("NON_TROUVE");
    const apres = await prisma.theme.findUniqueOrThrow({
      where: { id: themeRestauration.id },
      select: { libelle_fr: true },
    });
    expect(apres.libelle_fr).toBe(themeRestauration.libelle_fr);

    await agentAdmin
      .patch("/api/v1/admin/secteurs/" + idA + "/themes/" + ID_INCONNU)
      .send({ libelle_fr: "Inconnu" })
      .expect(404);
    await agentAdmin
      .patch("/api/v1/admin/secteurs/" + idA + "/themes/abc")
      .send({ libelle_fr: "Inconnu" })
      .expect(400);
  });
});

// ------------------------------------------------------------
// Questionnaires types
// ------------------------------------------------------------

describe("admin secteurs : questionnaires types", () => {
  it("les 6 secteurs du seed ont leur modele, avec des questions et des themes coherents", async () => {
    for (const code of ["restauration", "sante", "education", "agroalimentaire", "evenement", "general"]) {
      const id = await idSecteurParCode(code);
      const modeles = await lireModeles(id);
      expect(modeles.length, "modeles du secteur " + code).toBeGreaterThanOrEqual(1);

      const codesThemes = (await lireThemes(id)).map((t) => t.code);
      const questions = modeles[0]?.questions ?? [];
      expect(questions.length, "questions du secteur " + code).toBeGreaterThanOrEqual(5);

      // Questions dans l'ordre, une question NPS, et chaque theme est un theme du secteur
      const ordres = questions.map((q) => q.ordre);
      expect(ordres).toEqual([...ordres].sort((a, b) => a - b));
      expect(questions.some((q) => q.type === "NPS"), "NPS du secteur " + code).toBe(true);
      for (const question of questions) {
        if (question.theme !== null) {
          expect(codesThemes, "theme " + question.theme.code + " du secteur " + code).toContain(question.theme.code);
        }
      }
    }
  });

  it("le contenu des modeles suit l'annexe A : sante, education, agroalimentaire, evenement, general", async () => {
    const modele = async (code: string, titre: string): Promise<ModeleType> => {
      const trouve = (await lireModeles(await idSecteurParCode(code))).find((m) => m.titre.fr === titre);
      if (!trouve) {
        throw new Error("Modele introuvable : " + titre);
      }
      return trouve;
    };

    // A2. Sante : avertissement affiche, 7 questions, temps d'attente en 4 choix
    const sante = await modele("sante", "Avis établissement de santé");
    expect(sante.message_accueil.fr).toContain(MESSAGE_SANTE);
    expect(sante.message_accueil.en).toContain("personal medical information");
    expect(sante.questions).toHaveLength(7);
    expect(sante.questions[1]?.type).toBe("CHOIX_UNIQUE");
    expect(sante.questions[1]?.options).toHaveLength(4);
    expect(sante.questions[1]?.options?.[0]?.fr).toBe("Moins de 15 min");

    // A3. Education : segmentation etudiant, eleve ou parent, puis la filiere (facultative)
    const education = await modele("education", "Avis établissement d'enseignement");
    expect(education.questions).toHaveLength(9);
    expect(education.questions[0]?.type).toBe("CHOIX_UNIQUE");
    expect(education.questions[0]?.options?.map((o) => o.fr)).toEqual(["Étudiant(e)", "Élève", "Parent"]);
    expect(education.questions[1]?.type).toBe("TEXTE_LIBRE");
    expect(education.questions[1]?.obligatoire).toBe(false);

    // A4. Agroalimentaire : disponibilite en 3 choix, question oui/non sur un probleme
    const agro = await modele("agroalimentaire", "Avis produit");
    expect(agro.questions).toHaveLength(7);
    const disponibilite = agro.questions.find((q) => q.theme?.code === "disponibilite");
    expect(disponibilite?.type).toBe("CHOIX_UNIQUE");
    expect(disponibilite?.options).toHaveLength(3);
    expect(agro.questions.some((q) => q.type === "OUI_NON")).toBe(true);

    // A5. Evenement : 8 questions, la derniere (stand ou session) est un choix facultatif
    const evenement = await modele("evenement", "Avis événement");
    expect(evenement.questions).toHaveLength(8);
    expect(evenement.questions[7]?.type).toBe("CHOIX_UNIQUE");
    expect(evenement.questions[7]?.obligatoire).toBe(false);

    // General : 4 themes en etoiles et le NPS
    const general = await modele("general", "Avis client");
    expect(general.questions).toHaveLength(5);
    expect(general.questions[4]?.type).toBe("NPS");
  });

  it("un secteur sans modele renvoie une liste vide, un secteur inconnu est refuse", async () => {
    expect(await lireModeles(idA)).toEqual([]);

    const inconnu = await agentAdmin
      .get("/api/v1/admin/secteurs/" + ID_INCONNU + "/questionnaires-types")
      .expect(404);
    expect(inconnu.body.code).toBe("NON_TROUVE");
    await agentAdmin.get("/api/v1/admin/secteurs/abc/questionnaires-types").expect(400);
  });
});