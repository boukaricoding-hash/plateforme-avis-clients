import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerSites } from '../services/sites'
import {
  activerUtilisateur,
  desactiverUtilisateur,
  inviterUtilisateur,
  listerUtilisateurs,
  modifierUtilisateur,
} from '../services/utilisateurs'
import type { Site } from '../types/sites-points'
import type {
  CorpsInvitation,
  CorpsModificationUtilisateur,
  InvitationEnAttente,
  ReponseInvitation,
  UtilisateurListe,
} from '../types/utilisateurs-admin'
import type { EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E13 (utilisateurs, roles et perimetres, jour 18), au meme endroit :
// - les utilisateurs de l'organisation (actifs ou non) et les invitations en attente ;
// - les sites de l'organisation, pour choisir le perimetre d'un Gestionnaire ;
// - les actions (inviter, modifier, activer ou desactiver) avec leur etat : en cours, succes, erreur.
// Seul le Responsable a acces a cet ecran : le serveur refuse le Gestionnaire (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

export type AccesUtilisateurs = 'responsable' | 'aucun'

export type ActionInviter = EtatAction & {
  // Derniere invitation envoyee avec succes (email_envoye false = e-mail refuse) ; sinon null.
  resultat: ReponseInvitation | null
  // Cree l'invitation. Une invitation deja en attente pour la meme adresse est remplacee.
  // Renvoie true si c'est fait.
  inviter: (corps: CorpsInvitation) => Promise<boolean>
  // Efface le resultat et l'erreur (a l'ouverture ou a la fermeture du formulaire).
  reinitialiser: () => void
}

export type ActionsUtilisateurs = EtatAction & {
  // Seuls role et site_ids peuvent changer (au moins un). Renvoie true si c'est fait.
  modifier: (id: string, corps: CorpsModificationUtilisateur) => Promise<boolean>
  // true : activer le compte ; false : le desactiver. Renvoie true si c'est fait.
  changerStatut: (id: string, actif: boolean) => Promise<boolean>
}

export type ResultatUtilisateurs = {
  acces: AccesUtilisateurs
  // Identifiant du compte connecte : le serveur refuse de le modifier ou de le desactiver.
  moiId: string | null
  // Utilisateurs de l'organisation ; null tant qu'ils ne sont pas charges.
  utilisateurs: UtilisateurListe[] | null
  // Invitations en attente ; null tant qu'elles ne sont pas chargees.
  invitations: InvitationEnAttente[] | null
  chargement: boolean
  // Erreur du chargement de la liste (null = tout va bien).
  erreur: ErreurService | null
  // Sites de l'organisation ; null tant qu'ils ne sont pas charges.
  // Un echec ici ne bloque pas la liste : seul le choix du perimetre est indisponible.
  sites: Site[] | null
  erreurSites: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  invitation: ActionInviter
  actions: ActionsUtilisateurs
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Tri des utilisateurs par nom, comme le serveur.
function trierUtilisateurs(utilisateurs: UtilisateurListe[]): UtilisateurListe[] {
  return [...utilisateurs].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Tri des sites par nom, comme le serveur.
function trierSites(sites: Site[]): Site[] {
  return [...sites].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Etat commun d'une action (en cours, succes, erreur) et son execution.
// Une session expiree (401) deconnecte l'utilisateur ; l'action renvoie alors null.
function utiliserAction(seDeconnecter: () => Promise<void>) {
  const [enCours, setEnCours] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState<ErreurService | null>(null)

  const executer = useCallback(
    async <T>(appel: () => Promise<T>): Promise<T | null> => {
      setSucces(false)
      setErreur(null)
      setEnCours(true)
      try {
        const resultat = await appel()
        setSucces(true)
        return resultat
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return null
        }
        setErreur(erreurService)
        return null
      } finally {
        setEnCours(false)
      }
    },
    [seDeconnecter],
  )

  const reinitialiserEtat = useCallback(() => {
    setSucces(false)
    setErreur(null)
  }, [])

  return { enCours, succes, erreur, executer, reinitialiserEtat }
}

export function utiliserListeUtilisateurs(): ResultatUtilisateurs {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesUtilisateurs = utilisateur?.role === 'RESPONSABLE' ? 'responsable' : 'aucun'

  const [utilisateurs, setUtilisateurs] = useState<UtilisateurListe[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationEnAttente[] | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [sites, setSites] = useState<Site[] | null>(null)
  const [erreurSites, setErreurSites] = useState<ErreurService | null>(null)
  const [resultatInvitation, setResultatInvitation] = useState<ReponseInvitation | null>(null)
  // Augmente a chaque clic sur "Reessayer" ou apres une invitation pour recharger la liste.
  const [relance, setRelance] = useState(0)

  const actionInvitation = utiliserAction(seDeconnecter)
  const actionUtilisateur = utiliserAction(seDeconnecter)

  const recharger = useCallback(() => {
    setErreur(null)
    setErreurSites(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- Chargement des utilisateurs et des invitations ----------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const reponse = await listerUtilisateurs()
        if (annule) {
          return
        }
        setUtilisateurs(trierUtilisateurs(reponse.utilisateurs))
        setInvitations(reponse.invitations)
        setErreur(null)
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
        setErreur(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Chargement des sites (pour choisir le perimetre) --------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerSites()
        if (annule) {
          return
        }
        setSites(trierSites(resultat))
        setErreurSites(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurSites(erreurService)
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Invitation --------------------------------------------------------------------------------

  const { executer: executerInvitation, reinitialiserEtat: reinitialiserEtatInvitation } =
    actionInvitation

  const inviter = useCallback(
    async (corps: CorpsInvitation): Promise<boolean> => {
      setResultatInvitation(null)
      const reponse = await executerInvitation(() => inviterUtilisateur(corps))
      if (reponse === null) {
        return false
      }
      setResultatInvitation(reponse)
      // Une invitation en attente pour la meme adresse est remplacee par le serveur :
      // on recharge la liste plutot que de deviner la nouvelle.
      setRelance((valeur) => valeur + 1)
      return true
    },
    [executerInvitation],
  )

  const reinitialiserInvitation = useCallback(() => {
    setResultatInvitation(null)
    reinitialiserEtatInvitation()
  }, [reinitialiserEtatInvitation])

  // --- Modification, activation et desactivation ---------------------------------------------

  const { executer: executerUtilisateur } = actionUtilisateur

  const remplacerUtilisateur = useCallback((modifie: UtilisateurListe) => {
    setUtilisateurs((avant) =>
      avant === null
        ? avant
        : trierUtilisateurs(avant.map((u) => (u.id === modifie.id ? modifie : u))),
    )
  }, [])

  const modifierUnUtilisateur = useCallback(
    async (id: string, corps: CorpsModificationUtilisateur): Promise<boolean> => {
      const modifie = await executerUtilisateur(() => modifierUtilisateur(id, corps))
      if (modifie === null) {
        return false
      }
      remplacerUtilisateur(modifie)
      return true
    },
    [executerUtilisateur, remplacerUtilisateur],
  )

  const changerStatut = useCallback(
    async (id: string, actif: boolean): Promise<boolean> => {
      const modifie = await executerUtilisateur(() =>
        actif ? activerUtilisateur(id) : desactiverUtilisateur(id),
      )
      if (modifie === null) {
        return false
      }
      remplacerUtilisateur(modifie)
      return true
    },
    [executerUtilisateur, remplacerUtilisateur],
  )

  return {
    acces,
    moiId: utilisateur?.id ?? null,
    utilisateurs,
    invitations,
    chargement: acces !== 'aucun' && utilisateurs === null && erreur === null,
    erreur,
    sites,
    erreurSites,
    recharger,
    invitation: {
      enCours: actionInvitation.enCours,
      succes: actionInvitation.succes,
      erreur: actionInvitation.erreur,
      resultat: resultatInvitation,
      inviter,
      reinitialiser: reinitialiserInvitation,
    },
    actions: {
      enCours: actionUtilisateur.enCours,
      succes: actionUtilisateur.succes,
      erreur: actionUtilisateur.erreur,
      modifier: modifierUnUtilisateur,
      changerStatut,
    },
  }
}