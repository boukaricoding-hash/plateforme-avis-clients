// Roles : memes valeurs que l'enum RoleUtilisateur du backend (schema.prisma).
export type RoleUtilisateur = 'RESPONSABLE' | 'GESTIONNAIRE' | 'ADMINISTRATEUR'

// Utilisateur renvoye par POST /auth/login et GET /auth/me.
export type Utilisateur = {
  id: string
  email: string
  nom: string
  role: RoleUtilisateur
  organisation_id: string | null
  langue: string
}

// Corps des reponses d'erreur du backend : { code, message, details }.
export type CorpsErreurApi = {
  code: string
  message: string
  details: unknown
}