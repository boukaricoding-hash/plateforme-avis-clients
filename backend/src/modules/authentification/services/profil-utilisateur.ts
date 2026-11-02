import { prisma } from "../../../configuration/base-de-donnees";

// Champs de l'utilisateur dont on a besoin pour construire le profil.
type UtilisateurConnecte = {
  id: string;
  email: string;
  nom: string;
  role: string;
  organisation_id: string | null;
  langue: string;
};

// Organisation affichee dans l'en-tete du menu : son nom et le lien de son logo.
export type OrganisationProfil = {
  nom: string;
  logo_url: string | null;
};

// Utilisateur renvoye par POST /auth/login et GET /auth/me.
export type ProfilUtilisateur = UtilisateurConnecte & {
  organisation: OrganisationProfil | null;
};

// Construit l'objet utilisateur renvoye au tableau de bord.
// L'organisation vient de la base, a partir de l'organisation de l'utilisateur.
// Pas d'organisation (administrateur DTS) ou organisation supprimee : organisation = null.
export async function construireProfilUtilisateur(
  utilisateur: UtilisateurConnecte,
): Promise<ProfilUtilisateur> {
  let organisation: OrganisationProfil | null = null;

  if (utilisateur.organisation_id !== null) {
    const trouvee = await prisma.organisation.findFirst({
      where: { id: utilisateur.organisation_id, supprime_le: null },
      select: { nom: true, logo_url: true },
    });
    if (trouvee !== null) {
      organisation = { nom: trouvee.nom, logo_url: trouvee.logo_url };
    }
  }

  return {
    id: utilisateur.id,
    email: utilisateur.email,
    nom: utilisateur.nom,
    role: utilisateur.role,
    organisation_id: utilisateur.organisation_id,
    langue: utilisateur.langue,
    organisation,
  };
}