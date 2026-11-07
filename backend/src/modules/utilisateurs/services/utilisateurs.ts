import { prisma } from "../../../configuration/base-de-donnees";
import type { DonneesModificationUtilisateur } from "../validations/utilisateurs";

type Role = "RESPONSABLE" | "GESTIONNAIRE" | "ADMINISTRATEUR";

// Un Responsable ne gere que les Responsables et les Gestionnaires de son organisation.
// Les administrateurs DTS n'ont pas d'organisation et ne passent jamais par ici.
const ROLES_GERES = ["RESPONSABLE", "GESTIONNAIRE"] as const;

// Les champs lus en base : jamais le mot de passe, ni organisation_id, ni supprime_le.
// Seuls les sites non supprimes sont comptes dans le perimetre.
const CHAMPS_UTILISATEUR = {
  id: true,
  email: true,
  nom: true,
  role: true,
  actif: true,
  derniere_connexion: true,
  cree_le: true,
  utilisateurs_sites: {
    where: { site: { supprime_le: null } },
    select: { site: { select: { id: true, nom: true } } },
  },
} as const;

type LigneUtilisateur = {
  id: string;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  derniere_connexion: Date | null;
  cree_le: Date;
  utilisateurs_sites: { site: { id: string; nom: string } }[];
};

// La forme renvoyee au navigateur : les sites a plat, tries par nom.
export type UtilisateurListe = {
  id: string;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  derniere_connexion: Date | null;
  cree_le: Date;
  sites: { id: string; nom: string }[];
};

function formater(ligne: LigneUtilisateur): UtilisateurListe {
  return {
    id: ligne.id,
    email: ligne.email,
    nom: ligne.nom,
    role: ligne.role,
    actif: ligne.actif,
    derniere_connexion: ligne.derniere_connexion,
    cree_le: ligne.cree_le,
    sites: ligne.utilisateurs_sites
      .map((lien) => lien.site)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  };
}

async function lireLigne(
  organisationId: string,
  utilisateurId: string,
): Promise<LigneUtilisateur | null> {
  return prisma.utilisateur.findFirst({
    where: {
      id: utilisateurId,
      organisation_id: organisationId,
      supprime_le: null,
      role: { in: [...ROLES_GERES] },
    },
    select: CHAMPS_UTILISATEUR,
  });
}

// Renvoie null si l'utilisateur n'existe pas dans CETTE organisation.
export async function lireUtilisateur(
  organisationId: string,
  utilisateurId: string,
): Promise<UtilisateurListe | null> {
  const ligne = await lireLigne(organisationId, utilisateurId);
  return ligne ? formater(ligne) : null;
}

// Tous les utilisateurs de l'organisation, actifs ou non (les inactifs restent visibles
// pour pouvoir les reactiver), tries par nom.
export async function listerUtilisateurs(organisationId: string): Promise<UtilisateurListe[]> {
  const lignes: LigneUtilisateur[] = await prisma.utilisateur.findMany({
    where: {
      organisation_id: organisationId,
      supprime_le: null,
      role: { in: [...ROLES_GERES] },
    },
    select: CHAMPS_UTILISATEUR,
    orderBy: { nom: "asc" },
  });
  return lignes.map(formater);
}

export type ResultatModification =
  | { etat: "ok"; utilisateur: UtilisateurListe; ancien_role: Role }
  | { etat: "introuvable" }
  | { etat: "soi_meme" }
  | { etat: "sites_requis" }
  | { etat: "sites_invalides" };

// Change le role et/ou les sites. Regles :
// - on ne modifie pas son propre compte (pas de perte de droits par erreur) ;
// - un Gestionnaire garde au moins un site ;
// - un Responsable n'a pas de sites (il voit toute l'organisation) : ses liens sont vides ;
// - tous les sites doivent appartenir a CETTE organisation.
// Le role est relu en base a chaque requete : pas besoin de fermer les sessions.
export async function modifierUtilisateur(
  organisationId: string,
  acteurId: string,
  utilisateurId: string,
  donnees: DonneesModificationUtilisateur,
): Promise<ResultatModification> {
  const actuel = await lireLigne(organisationId, utilisateurId);
  if (!actuel) {
    return { etat: "introuvable" };
  }
  if (actuel.id === acteurId) {
    return { etat: "soi_meme" };
  }

  const roleFinal: Role = donnees.role ?? actuel.role;
  const sitesFinal: string[] =
    roleFinal === "RESPONSABLE"
      ? []
      : (donnees.site_ids ?? actuel.utilisateurs_sites.map((lien) => lien.site.id));

  if (roleFinal === "GESTIONNAIRE" && sitesFinal.length === 0) {
    return { etat: "sites_requis" };
  }

  if (sitesFinal.length > 0) {
    const trouves = await prisma.site.count({
      where: { id: { in: sitesFinal }, organisation_id: organisationId, supprime_le: null },
    });
    if (trouves !== sitesFinal.length) {
      return { etat: "sites_invalides" };
    }
  }

  const applique = await prisma.$transaction(async (tx) => {
    const maj = await tx.utilisateur.updateMany({
      where: {
        id: utilisateurId,
        organisation_id: organisationId,
        supprime_le: null,
        role: { in: [...ROLES_GERES] },
      },
      data: { role: roleFinal },
    });
    if (maj.count === 0) {
      return false;
    }

    await tx.utilisateurSite.deleteMany({ where: { utilisateur_id: utilisateurId } });
    if (sitesFinal.length > 0) {
      await tx.utilisateurSite.createMany({
        data: sitesFinal.map((siteId) => ({ utilisateur_id: utilisateurId, site_id: siteId })),
      });
    }
    return true;
  });
  if (!applique) {
    return { etat: "introuvable" };
  }

  const utilisateur = await lireUtilisateur(organisationId, utilisateurId);
  if (!utilisateur) {
    return { etat: "introuvable" };
  }
  return { etat: "ok", utilisateur, ancien_role: actuel.role };
}

export type ResultatDesactivation =
  | { etat: "ok"; utilisateur: UtilisateurListe }
  | { etat: "introuvable" }
  | { etat: "soi_meme" };

// Desactiver ne supprime rien : les avis, notes et historiques restent lies au compte.
// Le compte ne peut plus se connecter et ses sessions ouvertes sont fermees tout de suite.
// On ne peut pas desactiver son propre compte : l'organisation garde toujours un Responsable.
export async function desactiverUtilisateur(
  organisationId: string,
  acteurId: string,
  utilisateurId: string,
): Promise<ResultatDesactivation> {
  const actuel = await lireLigne(organisationId, utilisateurId);
  if (!actuel) {
    return { etat: "introuvable" };
  }
  if (actuel.id === acteurId) {
    return { etat: "soi_meme" };
  }

  const applique = await prisma.$transaction(async (tx) => {
    const maj = await tx.utilisateur.updateMany({
      where: {
        id: utilisateurId,
        organisation_id: organisationId,
        supprime_le: null,
        role: { in: [...ROLES_GERES] },
      },
      data: { actif: false },
    });
    if (maj.count === 0) {
      return false;
    }
    await tx.session.deleteMany({ where: { utilisateur_id: utilisateurId } });
    return true;
  });
  if (!applique) {
    return { etat: "introuvable" };
  }

  const utilisateur = await lireUtilisateur(organisationId, utilisateurId);
  return utilisateur ? { etat: "ok", utilisateur } : { etat: "introuvable" };
}

export type ResultatReactivation =
  | { etat: "ok"; utilisateur: UtilisateurListe }
  | { etat: "introuvable" };

// Reactiver remet "actif" a vrai et efface les echecs de connexion et le verrouillage.
export async function reactiverUtilisateur(
  organisationId: string,
  utilisateurId: string,
): Promise<ResultatReactivation> {
  const maj = await prisma.utilisateur.updateMany({
    where: {
      id: utilisateurId,
      organisation_id: organisationId,
      supprime_le: null,
      role: { in: [...ROLES_GERES] },
    },
    data: { actif: true, tentatives_echec: 0, verrouille_jusqua: null },
  });
  if (maj.count === 0) {
    return { etat: "introuvable" };
  }

  const utilisateur = await lireUtilisateur(organisationId, utilisateurId);
  return utilisateur ? { etat: "ok", utilisateur } : { etat: "introuvable" };
}