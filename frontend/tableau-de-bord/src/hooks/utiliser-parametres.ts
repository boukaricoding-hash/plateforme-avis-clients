import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  lirePreferencesNotifications,
  modifierPreferencesNotifications,
} from '../services/notifications'
import {
  envoyerLogo,
  lireParametres,
  modifierParametres,
  retirerLogo,
} from '../services/parametres'
import type { PreferencesNotifications } from '../types/notifications'
import {
  TAILLE_MAX_LOGO,
  TYPES_LOGO_ACCEPTES,
  type CorpsModificationParametres,
  type ParametresOrganisation,
} from '../types/parametres'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E14 (parametres de l'organisation, jour 16), au meme endroit :
// - les parametres de l'organisation (logo, couleur, seuils d'alerte), pour le Responsable seulement ;
// - la preference d'alerte de l'utilisateur (e-mail tout de suite ou un resume par jour),
//   pour le Responsable et le Gestionnaire ;
// - les actions de chaque section (logo, couleur et seuils, preference), avec leur etat :
//   en cours, succes, erreur. Chaque section a son propre etat : une erreur du logo
//   n'efface pas le message de succes des seuils.
// Le hook ne fait aucun appel a l'API pour l'administrateur DTS : il n'a pas d'organisation,
// l'API lui refuse ces routes. La page doit le renvoyer ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

// Qui voit quoi : le Responsable voit tout l'ecran, le Gestionnaire seulement sa preference.
export type AccesParametres = 'responsable' | 'gestionnaire' | 'aucun'

// Raison d'un echec du logo : les 4 textes d'erreur de la section.
export type ErreurLogo = 'format' | 'taille' | 'envoi' | 'retrait'

export type EtatLogo = {
  // Action en cours (les boutons se bloquent) ; null = rien en cours.
  enCours: 'envoi' | 'retrait' | null
  // Derniere action reussie ; null des qu'une nouvelle action commence.
  succes: 'envoi' | 'retrait' | null
  erreur: ErreurLogo | null
  // Renvoie true si le logo a ete envoye. Le format et la taille sont verifies avant l'envoi.
  envoyer: (fichier: File) => Promise<boolean>
  // Renvoie true si le logo a ete retire (ou s'il n'y en avait pas).
  retirer: () => Promise<boolean>
}

export type EtatAlertes = {
  enCours: boolean
  succes: boolean
  erreur: ErreurService | null
  // Seuls les champs a changer sont envoyes (au moins un). Renvoie true si c'est enregistre.
  enregistrer: (corps: CorpsModificationParametres) => Promise<boolean>
}

export type EtatPreferences = {
  enCours: boolean
  succes: boolean
  erreur: ErreurService | null
  // true : un resume par jour a 08h00. false : un e-mail tout de suite. Renvoie true si c'est enregistre.
  changer: (alertesGroupees: boolean) => Promise<boolean>
}

export type ResultatParametres = {
  acces: AccesParametres
  // Parametres de l'organisation (Responsable seulement) ; null tant qu'ils ne sont pas charges.
  parametres: ParametresOrganisation | null
  chargementParametres: boolean
  // Erreur du chargement des parametres (null = tout va bien).
  erreurParametres: ErreurService | null
  // Preference d'alerte de l'utilisateur ; null tant qu'elle n'est pas chargee.
  preferences: PreferencesNotifications | null
  chargementPreferences: boolean
  // Erreur du chargement de la preference (null = tout va bien).
  erreurPreferences: ErreurService | null
  // Relance les chargements en echec (bouton "Reessayer").
  recharger: () => void
  logo: EtatLogo
  alertes: EtatAlertes
  notifications: EtatPreferences
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Texte d'erreur a afficher pour un echec d'envoi du logo, d'apres le code du backend.
function erreurEnvoiLogo(erreur: ErreurService): ErreurLogo {
  if (erreur.code === 'LOGO_TROP_VOLUMINEUX') {
    return 'taille'
  }
  if (erreur.code === 'LOGO_FORMAT_INVALIDE') {
    return 'format'
  }
  return 'envoi'
}

export function utiliserParametres(): ResultatParametres {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const role = utilisateur?.role ?? null
  const acces: AccesParametres =
    role === 'RESPONSABLE' ? 'responsable' : role === 'GESTIONNAIRE' ? 'gestionnaire' : 'aucun'

  const [parametres, setParametres] = useState<ParametresOrganisation | null>(null)
  const [erreurParametres, setErreurParametres] = useState<ErreurService | null>(null)
  const [preferences, setPreferences] = useState<PreferencesNotifications | null>(null)
  const [erreurPreferences, setErreurPreferences] = useState<ErreurService | null>(null)
  // Augmente a chaque clic sur "Reessayer" pour relancer les chargements.
  const [relance, setRelance] = useState(0)

  const [logoEnCours, setLogoEnCours] = useState<'envoi' | 'retrait' | null>(null)
  const [logoSucces, setLogoSucces] = useState<'envoi' | 'retrait' | null>(null)
  const [logoErreur, setLogoErreur] = useState<ErreurLogo | null>(null)

  const [alertesEnCours, setAlertesEnCours] = useState(false)
  const [alertesSucces, setAlertesSucces] = useState(false)
  const [alertesErreur, setAlertesErreur] = useState<ErreurService | null>(null)

  const [preferencesEnCours, setPreferencesEnCours] = useState(false)
  const [preferencesSucces, setPreferencesSucces] = useState(false)
  const [preferencesErreur, setPreferencesErreur] = useState<ErreurService | null>(null)

  const recharger = useCallback(() => {
    setErreurParametres(null)
    setErreurPreferences(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement des parametres de l'organisation (Responsable seulement) ---------------

  useEffect(() => {
    if (acces !== 'responsable') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await lireParametres()
        if (annule) {
          return
        }
        setParametres(resultat)
        setErreurParametres(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          // Session expiree : retour a la page de connexion.
          void seDeconnecter()
          return
        }
        setErreurParametres(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Chargement de la preference d'alerte (Responsable et Gestionnaire) -----------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await lirePreferencesNotifications()
        if (annule) {
          return
        }
        setPreferences(resultat)
        setErreurPreferences(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurPreferences(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Logo ---------------------------------------------------------------------------------

  const televerserLogo = useCallback(
    async (fichier: File): Promise<boolean> => {
      setLogoSucces(null)
      setLogoErreur(null)

      // Verification avant l'envoi, pour prevenir tout de suite. Un type inconnu du navigateur
      // (texte vide) part quand meme : le serveur lit le vrai contenu du fichier et decide.
      if (fichier.type !== '' && !TYPES_LOGO_ACCEPTES.includes(fichier.type)) {
        setLogoErreur('format')
        return false
      }
      if (fichier.size > TAILLE_MAX_LOGO) {
        setLogoErreur('taille')
        return false
      }

      setLogoEnCours('envoi')
      try {
        const logoUrl = await envoyerLogo(fichier)
        setParametres((avant) => (avant === null ? avant : { ...avant, logo_url: logoUrl }))
        setLogoSucces('envoi')
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setLogoErreur(erreurEnvoiLogo(erreurService))
        return false
      } finally {
        setLogoEnCours(null)
      }
    },
    [seDeconnecter],
  )

  const supprimerLogo = useCallback(async (): Promise<boolean> => {
    setLogoSucces(null)
    setLogoErreur(null)
    setLogoEnCours('retrait')
    try {
      const logoUrl = await retirerLogo()
      setParametres((avant) => (avant === null ? avant : { ...avant, logo_url: logoUrl }))
      setLogoSucces('retrait')
      return true
    } catch (e) {
      const erreurService = versErreurService(e)
      if (erreurService.statut === 401) {
        void seDeconnecter()
        return false
      }
      setLogoErreur('retrait')
      return false
    } finally {
      setLogoEnCours(null)
    }
  }, [seDeconnecter])

  // --- Couleur et seuils d'alerte -----------------------------------------------------------

  const enregistrerAlertes = useCallback(
    async (corps: CorpsModificationParametres): Promise<boolean> => {
      setAlertesSucces(false)
      setAlertesErreur(null)
      setAlertesEnCours(true)
      try {
        const misAJour = await modifierParametres(corps)
        setParametres(misAJour)
        setAlertesSucces(true)
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setAlertesErreur(erreurService)
        return false
      } finally {
        setAlertesEnCours(false)
      }
    },
    [seDeconnecter],
  )

  // --- Preference d'alerte --------------------------------------------------------------------

  const changerPreference = useCallback(
    async (alertesGroupees: boolean): Promise<boolean> => {
      setPreferencesSucces(false)
      setPreferencesErreur(null)
      setPreferencesEnCours(true)
      try {
        const misAJour = await modifierPreferencesNotifications(alertesGroupees)
        setPreferences(misAJour)
        setPreferencesSucces(true)
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setPreferencesErreur(erreurService)
        return false
      } finally {
        setPreferencesEnCours(false)
      }
    },
    [seDeconnecter],
  )

  return {
    acces,
    parametres,
    chargementParametres: acces === 'responsable' && parametres === null && erreurParametres === null,
    erreurParametres,
    preferences,
    chargementPreferences: acces !== 'aucun' && preferences === null && erreurPreferences === null,
    erreurPreferences,
    recharger,
    logo: {
      enCours: logoEnCours,
      succes: logoSucces,
      erreur: logoErreur,
      envoyer: televerserLogo,
      retirer: supprimerLogo,
    },
    alertes: {
      enCours: alertesEnCours,
      succes: alertesSucces,
      erreur: alertesErreur,
      enregistrer: enregistrerAlertes,
    },
    notifications: {
      enCours: preferencesEnCours,
      succes: preferencesSucces,
      erreur: preferencesErreur,
      changer: changerPreference,
    },
  }
}