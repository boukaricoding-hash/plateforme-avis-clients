// Roles : memes valeurs que l'enum RoleUtilisateur du backend (schema.prisma).
export type RoleUtilisateur = 'RESPONSABLE' | 'GESTIONNAIRE' | 'ADMINISTRATEUR'

// Organisation de l'utilisateur connecte : son nom et le lien de son logo (vide si pas de logo).
export type OrganisationUtilisateur = {
  nom: string
  logo_url: string | null
}

// Utilisateur renvoye par POST /auth/login et GET /auth/me.
// organisation vaut null pour l'administrateur DTS (pas d'organisation).
export type Utilisateur = {
  id: string
  email: string
  nom: string
  role: RoleUtilisateur
  organisation_id: string | null
  organisation: OrganisationUtilisateur | null
  langue: string
}

// Corps des reponses d'erreur du backend : { code, message, details }.
export type CorpsErreurApi = {
  code: string
  message: string
  details: unknown
}