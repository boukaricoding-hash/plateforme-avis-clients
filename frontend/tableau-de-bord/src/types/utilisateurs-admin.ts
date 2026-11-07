import type { RoleUtilisateur } from './utilisateur'

// Types de l'ecran E13 (utilisateurs, roles et perimetres, jour 18).
// Ils reproduisent ce que renvoie le backend :
// - GET   /api/v1/utilisateurs                    : { utilisateurs, invitations }
// - POST  /api/v1/utilisateurs/inviter            : 201 { invitation, email_envoye }
// - PATCH /api/v1/utilisateurs/:id                : { utilisateur }
// - POST  /api/v1/utilisateurs/:id/desactiver     : { utilisateur }
// - POST  /api/v1/utilisateurs/:id/activer        : { utilisateur }
// - GET   /api/v1/invitations/verifier?jeton=     : { email, organisation, role }
// - POST  /api/v1/invitations/accepter            : 201 { message }
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// Roles que le Responsable peut donner (ADMINISTRATEUR n'est jamais propose).
export type RoleInvitable = Exclude<RoleUtilisateur, 'ADMINISTRATEUR'>

// Un site du perimetre d'un utilisateur ou d'une invitation.
export type SitePerimetre = {
  id: string
  nom: string
}

// Utilisateur de la liste. Les dates sont des chaines ISO.
export type UtilisateurListe = {
  id: string
  email: string
  nom: string
  role: RoleInvitable
  actif: boolean
  derniere_connexion: string | null
  cree_le: string
  sites: SitePerimetre[]
}

// Invitation en attente (jamais acceptee, jamais expiree).
export type InvitationEnAttente = {
  id: string
  email: string
  role: RoleInvitable
  expire_le: string
  cree_le: string
  invite_par_nom: string | null
  sites: SitePerimetre[]
}

export type ReponseListeUtilisateurs = {
  utilisateurs: UtilisateurListe[]
  invitations: InvitationEnAttente[]
}

export type ReponseUtilisateur = {
  utilisateur: UtilisateurListe
}

// Invitation : un Gestionnaire doit avoir au moins un site.
// Pour un Responsable, site_ids est ignore par le serveur (il voit toute l'organisation).
export type CorpsInvitation = {
  email: string
  role: RoleInvitable
  site_ids: string[]
}

// email_envoye vaut false si le serveur d'e-mails a refuse : l'invitation existe quand meme.
export type ReponseInvitation = {
  invitation: InvitationEnAttente
  email_envoye: boolean
}

// Modification : role et/ou sites (au moins un des deux).
export type CorpsModificationUtilisateur = {
  role?: RoleInvitable
  site_ids?: string[]
}

// Page publique /invitation : ce que renvoie la verification du lien.
// Le champ organisation est lu tel que le renvoie le backend (voir invitations.controleur.ts).
export type ReponseVerificationInvitation = {
  email: string
  organisation: string
  role: RoleInvitable
}

// Page publique /invitation : l'invite donne son nom et choisit son mot de passe.
export type CorpsAcceptationInvitation = {
  jeton: string
  nom: string
  mot_de_passe: string
}

export type ReponseAcceptationInvitation = {
  message: string
}