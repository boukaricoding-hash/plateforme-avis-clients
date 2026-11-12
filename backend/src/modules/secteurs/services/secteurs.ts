import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import type {
  DonneesCreationSecteur,
  DonneesCreationTheme,
  DonneesModificationSecteur,
  DonneesModificationTheme,
  FiltresSecteurs,
} from "../validations/secteurs";

// Les champs d'un secteur renvoyes au navigateur.
export const CHAMPS_SECTEUR = {
  id: true,
  code: true,
  nom_fr: true,
  nom_en: true,
  vocabulaire: true,
  indicateurs_suggeres: true,
  actif: true,
  cree_le: true,
} as const;

const CHAMPS_THEME = {
  id: true,
  code: true,
  libelle_fr: true,
  libelle_en: true,
  ordre: true,
} as const;

// Les actions sont faites par un administrateur DTS : on garde qui et d'ou (IP).
type Acteur = { utilisateurId: string; ip: string | undefined };

// ------------------------------------------------------------
// Lecture
// ------------------------------------------------------------

// Liste des secteurs avec le nombre de themes et d'organisations de chacun.
export async function listerSecteurs(filtres: FiltresSecteurs) {
  const secteurs = await prisma.secteur.findMany({
    where: filtres.actif !== undefined ? { actif: filtres.actif } : {},
    select: {
      ...CHAMPS_SECTEUR,
      _count: {
        select: {
          themes: true,
          organisations: { where: { supprime_le: null } },
        },
      },
    },
    orderBy: { cree_le: "asc" },
  });

  return secteurs.map(({ _count, ...secteur }) => ({
    ...secteur,
    nombre_themes: _count.themes,
    nombre_organisations: _count.organisations,
  }));
}

// Un secteur avec ses themes dans l'ordre. Renvoie null s'il n'existe pas.
export async function lireSecteur(secteurId: string) {
  return prisma.secteur.findUnique({
    where: { id: secteurId },
    select: {
      ...CHAMPS_SECTEUR,
      themes: { select: CHAMPS_THEME, orderBy: [{ ordre: "asc" }, { code: "asc" }] },
    },
  });
}

// ------------------------------------------------------------
// Creation et modification d'un secteur
// ------------------------------------------------------------

export type ResultatCreationSecteur =
  | { etat: "ok"; secteur: NonNullable<Awaited<ReturnType<typeof lireSecteur>>> }
  | { etat: "code_deja_utilise" };

export async function creerSecteur(
  acteur: Acteur,
  donnees: DonneesCreationSecteur,
): Promise<ResultatCreationSecteur> {
  const existant = await prisma.secteur.findUnique({
    where: { code: donnees.code },
    select: { id: true },
  });
  if (existant) {
    return { etat: "code_deja_utilise" };
  }

  const cree = await prisma.secteur.create({
    data: {
      code: donnees.code,
      nom_fr: donnees.nom_fr,
      nom_en: donnees.nom_en,
      vocabulaire: donnees.vocabulaire,
      indicateurs_suggeres: donnees.indicateurs_suggeres,
      actif: donnees.actif,
    },
    select: { id: true },
  });

  await enregistrerAudit({
    action: "SECTEUR_CREE",
    utilisateurId: acteur.utilisateurId,
    ip: acteur.ip,
    details: { secteur_id: cree.id, code: donnees.code, actif: donnees.actif },
  });

  const secteur = await lireSecteur(cree.id);
  if (!secteur) {
    // Ne devrait jamais arriver : le secteur vient d'etre cree.
    throw new Error("Secteur introuvable juste apres sa creation.");
  }
  return { etat: "ok", secteur };
}

// Seuls les champs envoyes changent. Renvoie null si le secteur n'existe pas.
// Le code ne change jamais. Un secteur desactive n'est plus propose a la creation d'une organisation.
export async function modifierSecteur(
  acteur: Acteur,
  secteurId: string,
  donnees: DonneesModificationSecteur,
) {
  const existant = await prisma.secteur.findUnique({
    where: { id: secteurId },
    select: { id: true },
  });
  if (!existant) {
    return null;
  }

  const modifications = {
    ...(donnees.nom_fr !== undefined ? { nom_fr: donnees.nom_fr } : {}),
    ...(donnees.nom_en !== undefined ? { nom_en: donnees.nom_en } : {}),
    ...(donnees.vocabulaire !== undefined ? { vocabulaire: donnees.vocabulaire } : {}),
    ...(donnees.indicateurs_suggeres !== undefined
      ? { indicateurs_suggeres: donnees.indicateurs_suggeres }
      : {}),
    ...(donnees.actif !== undefined ? { actif: donnees.actif } : {}),
  };

  await prisma.secteur.update({ where: { id: secteurId }, data: modifications });

  // Le journal garde les noms des champs changes (pas leur contenu, qui peut etre une liste).
  await enregistrerAudit({
    action: "SECTEUR_MODIFIE",
    utilisateurId: acteur.utilisateurId,
    ip: acteur.ip,
    details: { secteur_id: secteurId, champs: Object.keys(modifications).join(",") },
  });

  return lireSecteur(secteurId);
}

// ------------------------------------------------------------
// Themes
// ------------------------------------------------------------

export type ResultatCreationTheme =
  | { etat: "ok"; theme: { id: string; code: string; libelle_fr: string; libelle_en: string; ordre: number } }
  | { etat: "secteur_introuvable" }
  | { etat: "code_deja_utilise" };

// Sans ordre envoye, le nouveau theme passe en dernier.
export async function creerTheme(
  acteur: Acteur,
  secteurId: string,
  donnees: DonneesCreationTheme,
): Promise<ResultatCreationTheme> {
  const secteur = await prisma.secteur.findUnique({
    where: { id: secteurId },
    select: { id: true },
  });
  if (!secteur) {
    return { etat: "secteur_introuvable" };
  }

  const memeCode = await prisma.theme.findUnique({
    where: { secteur_id_code: { secteur_id: secteurId, code: donnees.code } },
    select: { id: true },
  });
  if (memeCode) {
    return { etat: "code_deja_utilise" };
  }

  let ordre = donnees.ordre;
  if (ordre === undefined) {
    const dernier = await prisma.theme.findFirst({
      where: { secteur_id: secteurId },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    });
    ordre = (dernier?.ordre ?? 0) + 1;
  }

  const theme = await prisma.theme.create({
    data: {
      secteur_id: secteurId,
      code: donnees.code,
      libelle_fr: donnees.libelle_fr,
      libelle_en: donnees.libelle_en,
      ordre,
    },
    select: CHAMPS_THEME,
  });

  await enregistrerAudit({
    action: "THEME_CREE",
    utilisateurId: acteur.utilisateurId,
    ip: acteur.ip,
    details: { secteur_id: secteurId, theme_id: theme.id, code: donnees.code },
  });

  return { etat: "ok", theme };
}

// Renvoie null si le theme n'existe pas dans ce secteur. Le code ne change jamais.
export async function modifierTheme(
  acteur: Acteur,
  secteurId: string,
  themeId: string,
  donnees: DonneesModificationTheme,
) {
  const existant = await prisma.theme.findFirst({
    where: { id: themeId, secteur_id: secteurId },
    select: { id: true },
  });
  if (!existant) {
    return null;
  }

  const modifications = {
    ...(donnees.libelle_fr !== undefined ? { libelle_fr: donnees.libelle_fr } : {}),
    ...(donnees.libelle_en !== undefined ? { libelle_en: donnees.libelle_en } : {}),
    ...(donnees.ordre !== undefined ? { ordre: donnees.ordre } : {}),
  };

  const theme = await prisma.theme.update({
    where: { id: themeId },
    data: modifications,
    select: CHAMPS_THEME,
  });

  await enregistrerAudit({
    action: "THEME_MODIFIE",
    utilisateurId: acteur.utilisateurId,
    ip: acteur.ip,
    details: {
      secteur_id: secteurId,
      theme_id: themeId,
      champs: Object.keys(modifications).join(","),
    },
  });

  return theme;
}

// ------------------------------------------------------------
// Questionnaires types (lecture seule)
// ------------------------------------------------------------

// Les modeles du secteur avec leurs questions (derniere version), dans l'ordre.
// Renvoie null si le secteur n'existe pas.
export async function listerQuestionnairesTypes(secteurId: string) {
  const secteur = await prisma.secteur.findUnique({
    where: { id: secteurId },
    select: { id: true },
  });
  if (!secteur) {
    return null;
  }

  const modeles = await prisma.questionnaire.findMany({
    where: { est_modele: true, secteur_id: secteurId, supprime_le: null },
    select: {
      id: true,
      titre: true,
      message_accueil: true,
      message_remerciement: true,
      langue_defaut: true,
      statut: true,
      versions: {
        orderBy: { numero: "desc" },
        take: 1,
        select: {
          numero: true,
          questions: {
            orderBy: { ordre: "asc" },
            select: {
              id: true,
              ordre: true,
              type: true,
              libelle: true,
              aide: true,
              obligatoire: true,
              options: true,
              echelle_min: true,
              echelle_max: true,
              libelles_extremites: true,
              condition: true,
              theme: { select: { code: true, libelle_fr: true, libelle_en: true } },
            },
          },
        },
      },
    },
    orderBy: { cree_le: "asc" },
  });

  return modeles.map(({ versions, ...modele }) => ({
    ...modele,
    version: versions[0]?.numero ?? null,
    questions: versions[0]?.questions ?? [],
  }));
}