import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  MODELES_SECTORIELS,
  THEMES_PAR_SECTEUR,
  type ModeleSectoriel,
  type QuestionModele,
} from "./donnees-initiales/secteurs/modeles-sectoriels";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

const COUT_HACHAGE = 12;
const NOM_ORGANISATION = "Restaurant Demo";
const NOM_SITE = "Salle principale";
const NOMBRE_TABLES = 10;

type SecteurDepart = {
  code: string;
  nom_fr: string;
  nom_en: string;
  vocabulaire: Record<string, string>;
};

// Les themes et les questionnaires types viennent de
// prisma/donnees-initiales/secteurs/modeles-sectoriels.ts (annexe A du cahier des charges).
const SECTEURS: SecteurDepart[] = [
  { code: "restauration", nom_fr: "Restauration", nom_en: "Restaurant", vocabulaire: { point_contact: "table" } },
  { code: "sante", nom_fr: "Santé", nom_en: "Healthcare", vocabulaire: { point_contact: "chambre" } },
  { code: "education", nom_fr: "Éducation", nom_en: "Education", vocabulaire: { point_contact: "salle" } },
  { code: "agroalimentaire", nom_fr: "Agroalimentaire", nom_en: "Food industry", vocabulaire: { point_contact: "produit" } },
  { code: "evenement", nom_fr: "Événement", nom_en: "Event", vocabulaire: { point_contact: "stand" } },
  { code: "general", nom_fr: "Général", nom_en: "General", vocabulaire: { point_contact: "point de contact" } },
];

// Une question du modele devient une question de la base (echelle selon le type).
function questionDepart(
  question: QuestionModele,
  index: number,
  idsThemes: Map<string, string>,
) {
  let theme_id: string | undefined;
  if (question.theme !== undefined) {
    theme_id = idsThemes.get(question.theme);
    if (!theme_id) throw new Error("Theme introuvable : " + question.theme);
  }
  return {
    ordre: index + 1,
    type: question.type,
    libelle: question.libelle,
    obligatoire: question.obligatoire,
    ...(theme_id !== undefined ? { theme_id } : {}),
    ...(question.aide !== undefined ? { aide: question.aide } : {}),
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.type === "ETOILES" ? { echelle_min: 1, echelle_max: 5 } : {}),
    ...(question.type === "NPS" ? { echelle_min: 0, echelle_max: 10 } : {}),
  };
}

// Cree le modele du secteur s'il n'existe pas encore (un modele existant n'est jamais modifie).
async function installerModele(
  modele: ModeleSectoriel,
  secteurId: string,
  idsThemes: Map<string, string>,
): Promise<void> {
  const existant = await prisma.questionnaire.findFirst({
    where: { est_modele: true, secteur_id: secteurId, supprime_le: null },
    select: { id: true },
  });
  if (existant) return;

  await prisma.questionnaire.create({
    data: {
      est_modele: true,
      secteur_id: secteurId,
      titre: modele.titre,
      message_accueil: modele.message_accueil,
      message_remerciement: modele.message_remerciement,
      langue_defaut: "fr",
      statut: "ACTIF",
      versions: {
        create: {
          numero: 1,
          publie_le: new Date(),
          questions: {
            create: modele.questions.map((question, index) =>
              questionDepart(question, index, idsThemes),
            ),
          },
        },
      },
    },
  });
}

function lireVariable(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur || valeur.trim() === "") {
    throw new Error("Variable manquante dans backend/.env : " + nom);
  }
  return valeur.trim();
}

function genererCodePublic(): string {
  // 12 caracteres aleatoires, sans caracteres speciaux (adapte a une adresse web)
  return randomBytes(9).toString("base64url");
}

async function main() {
  const emailAdmin = lireVariable("SEED_ADMIN_EMAIL");
  const mdpAdmin = lireVariable("SEED_ADMIN_MOT_DE_PASSE");
  const emailResponsable = lireVariable("SEED_RESPONSABLE_EMAIL");
  const mdpResponsable = lireVariable("SEED_RESPONSABLE_MOT_DE_PASSE");

  // 1. Secteurs, themes et modeles de questionnaires (relancable sans doublon)
  const idsSecteurs = new Map<string, string>();
  for (const s of SECTEURS) {
    const secteur = await prisma.secteur.upsert({
      where: { code: s.code },
      update: { nom_fr: s.nom_fr, nom_en: s.nom_en, vocabulaire: s.vocabulaire },
      create: {
        code: s.code,
        nom_fr: s.nom_fr,
        nom_en: s.nom_en,
        vocabulaire: s.vocabulaire,
      },
    });
    idsSecteurs.set(s.code, secteur.id);

    const idsThemes = new Map<string, string>();
    for (const [index, t] of (THEMES_PAR_SECTEUR[s.code] ?? []).entries()) {
      const theme = await prisma.theme.upsert({
        where: { secteur_id_code: { secteur_id: secteur.id, code: t.code } },
        update: { libelle_fr: t.libelle_fr, libelle_en: t.libelle_en, ordre: index + 1 },
        create: {
          secteur_id: secteur.id,
          code: t.code,
          libelle_fr: t.libelle_fr,
          libelle_en: t.libelle_en,
          ordre: index + 1,
        },
      });
      idsThemes.set(t.code, theme.id);
    }

    const modele = MODELES_SECTORIELS.find((m) => m.secteur === s.code);
    if (!modele) throw new Error("Modele introuvable pour le secteur : " + s.code);
    await installerModele(modele, secteur.id, idsThemes);
  }

  const idRestauration = idsSecteurs.get("restauration");
  if (!idRestauration) throw new Error("Secteur restauration introuvable.");

  // 2. Organisation fictive (cherchee par nom, creee si absente)
  let organisation = await prisma.organisation.findFirst({
    where: { nom: NOM_ORGANISATION, supprime_le: null },
  });
  if (!organisation) {
    organisation = await prisma.organisation.create({
      data: { nom: NOM_ORGANISATION, secteur_id: idRestauration, statut: "ACTIF" },
    });
  }

  // 3. Utilisateurs (un compte existant n'est jamais modifie)
  await prisma.utilisateur.upsert({
    where: { email: emailAdmin },
    update: {},
    create: {
      email: emailAdmin,
      mot_de_passe_hash: await hash(mdpAdmin, COUT_HACHAGE),
      nom: "Administrateur DTS",
      role: "ADMINISTRATEUR",
    },
  });
  await prisma.utilisateur.upsert({
    where: { email: emailResponsable },
    update: {},
    create: {
      email: emailResponsable,
      mot_de_passe_hash: await hash(mdpResponsable, COUT_HACHAGE),
      nom: "Responsable Demo",
      role: "RESPONSABLE",
      organisation_id: organisation.id,
    },
  });

  // 4. Site
  let site = await prisma.site.findFirst({
    where: { organisation_id: organisation.id, nom: NOM_SITE, supprime_le: null },
  });
  if (!site) {
    site = await prisma.site.create({
      data: { organisation_id: organisation.id, nom: NOM_SITE },
    });
  }

  // 5. Tables 1 a 10, avec un code public aleatoire (seulement celles qui manquent)
  for (let numero = 1; numero <= NOMBRE_TABLES; numero++) {
    const nom = "Table " + numero;
    const existe = await prisma.pointContact.findFirst({
      where: { site_id: site.id, nom, supprime_le: null },
    });
    if (!existe) {
      await prisma.pointContact.create({
        data: {
          organisation_id: organisation.id,
          site_id: site.id,
          nom,
          type: "table",
          code_public: genererCodePublic(),
        },
      });
    }
  }

  console.log("Donnees de depart : ok.");
  console.log("Secteurs : " + (await prisma.secteur.count()));
  console.log("Themes : " + (await prisma.theme.count()));
  console.log(
    "Modeles de questionnaires : " + (await prisma.questionnaire.count({ where: { est_modele: true } })),
  );
  console.log("Organisations : " + (await prisma.organisation.count()));
  console.log("Utilisateurs : " + (await prisma.utilisateur.count()));
  console.log("Sites : " + (await prisma.site.count()));
  console.log("Points de contact : " + (await prisma.pointContact.count()));
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });