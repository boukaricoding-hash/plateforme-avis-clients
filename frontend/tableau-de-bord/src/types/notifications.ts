// Types des notifications (jour 16) : la cloche de la barre du haut et les preferences d'alerte.
// Ils reproduisent ce que renvoie le backend :
// - GET   /api/v1/notifications              : la liste, le compteur de non lues et la pagination
// - POST  /api/v1/notifications/:id/lue      : marquer une notification comme lue
// - GET et PATCH /api/v1/notifications/preferences : alertes groupees ou immediates
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// Une notification appartient a un seul utilisateur (la liste ne renvoie que les siennes).
export type NotificationRecue = {
  id: string
  // Avis concerne ; null si la notification n'est liee a aucun avis.
  avis_id: string | null
  // Pour l'instant toujours ALERTE_AVIS : on garde un texte libre pour les types futurs.
  type: string
  titre: string
  message: string | null
  // Date de premiere lecture (texte ISO) ; null = pas encore lue.
  lue_le: string | null
  cree_le: string
}

export type PaginationNotifications = {
  page: number
  limite: number
  total: number
  pages: number
}

export type ReponseListeNotifications = {
  notifications: NotificationRecue[]
  // Compteur de la cloche : il ne depend pas du filtre demande.
  non_lues: number
  pagination: PaginationNotifications
}

export type ReponseNotificationLue = {
  notification: NotificationRecue
}

// true : un seul resume par jour, a 08h00. false : un e-mail tout de suite par avis negatif.
export type PreferencesNotifications = {
  alertes_groupees: boolean
}

export type ReponsePreferencesNotifications = {
  preferences: PreferencesNotifications
}