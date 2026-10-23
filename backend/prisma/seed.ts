import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

const COUT_HACHAGE = 12;
const NOM_ORGANISATION = "Restaurant Demo";
const NOM_SITE = "Salle principale";
const NOMBRE_TABLES = 10;

type ThemeDepart = { code: string; libelle_fr: string; libelle_en: string };
type SecteurDepart = {
  code: string;
  nom_fr: string;
  nom_en: string;
  vocabulaire: Record<string, string>;
  themes: ThemeDepart[];
};

// Les themes des secteurs autres que restauration et general
// seront completes avec l'annexe A du cahier des charges (jour 22).
const SECTEURS: SecteurDepart[] = [
  {
    code: "restauration",
    nom_fr: "Restauration",
    nom_en: "Restaurant",
    vocabulaire: { point_contact: "table" },
    themes: [
      { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
      { code: "service", libelle_fr: "Service", libelle_en: "Service" },
      { code: "qualite_plats", libelle_fr: "Qualite des plats", libelle_en: "Food quality" },
      { code: "proprete", libelle_fr: "Proprete", libelle_en: "Cleanliness" },
      { code: "prix", libelle_fr: "Prix", libelle_en: "Price" },
      { code: "ambiance", libelle_fr: "Ambiance", libelle_en: "Atmosphere" },
    ],
  },
  {
    code: "sante",
    nom_fr: "Sante",
    nom_en: "Healthcare",
    vocabulaire: { point_contact: "chambre" },
    themes: [],
  },
  {
    code: "education",
    nom_fr: "Education",
    nom_en: "Education",
    vocabulaire: { point_contact: "salle" },
    themes: [],
  },
  {
    code: "agroalimentaire",
    nom_fr: "Agroalimentaire",
    nom_en: "Food industry",
    vocabulaire: { point_contact: "produit" },
    themes: [],
  },
  {
    code: "evenement",
    nom_fr: "Evenement",
    nom_en: "Event",
    vocabulaire: { point_contact: "stand" },
    themes: [],
  },
  {
    code: "general",
    nom_fr: "General",
    nom_en: "General",
    vocabulaire: { point_contact: "point de contact" },
    themes: [
      { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
      { code: "service", libelle_fr: "Service", libelle_en: "Service" },
      { code: "proprete", libelle_fr: "Proprete", libelle_en: "Cleanliness" },
      { code: "prix", libelle_fr: "Prix", libelle_en: "Price" },
    ],
  },
];

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

  // 1. Secteurs et themes (cree s'ils n'existent pas, sinon mis a jour)
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

    for (const [index, t] of s.themes.entries()) {
      await prisma.theme.upsert({
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
    }
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