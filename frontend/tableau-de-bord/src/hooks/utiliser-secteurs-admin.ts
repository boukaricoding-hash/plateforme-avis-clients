import { useCallback, useEffect, useState } from 'react'
import {
  creerSecteur,
  creerTheme,
  lireSecteur,
  listerQuestionnairesTypes,
  listerSecteurs,
  modifierSecteur,
  modifierTheme,
} from '../services/admin'
import { ErreurService } from '../services/api'
import type {
  CorpsCreationSecteur,
  CorpsCreationTheme,
  CorpsModificationSecteur,
  CorpsModificationTheme,
  QuestionnaireTypeSecteur,
  SecteurDetail,
  SecteurListe,
} from '../types/admin'
import type { EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E18 (modeles sectoriels du back-office DTS, jour 23), au meme endroit :
// - la liste des secteurs (actifs ou non) avec leur nombre de themes et d'organisations ;
// - le secteur choisi : sa fiche (noms, vocabulaire, indicateurs, themes dans l'ordre)
//   et ses questionnaires types (lecture seule) ;
// - les actions (creer un secteur, modifier un secteur, creer ou modifier un theme)
//   avec leur etat : en cours, succes, erreur.
// Seul l'administrateur DTS a acces a cet ecran : le serveur refuse les autres roles (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.
// Un secteur sans modele n'est pas une erreur : la liste des questionnaires types est alors vide.

export type AccesSecteursAdmin = 'administrateur' | 'aucun'

export type ActionCreationSecteur = EtatAction & {
  // Cree le secteur et le choisit. Renvoie la fiche du nouveau secteur, ou null si la creation a echoue.
  creer: (corps: CorpsCreationSecteur) => Promise<SecteurDetail | null>
  // Efface le succes et l'erreur (a l'ouverture ou a la fermeture du formulaire).
  reinitialiser: () => void
}

export type ActionsSecteur = EtatAction & {
  // Noms, vocabulaire, indicateurs suggeres ou actif (au moins un). Renvoie true si c'est fait.
  modifier: (id: string, corps: CorpsModificationSecteur) => Promise<boolean>
  // Ajoute un theme au secteur (en dernier si aucun ordre n'est donne). Renvoie true si c'est fait.
  creerTheme: (secteurId: string, corps: CorpsCreationTheme) => Promise<boolean>
  // Libelles ou ordre d'un theme (au moins un). Renvoie true si c'est fait.
  modifierTheme: (
    secteurId: string,
    themeId: string,
    corps: CorpsModificationTheme,
  ) => Promise<boolean>
  // Efface le succes et l'erreur (quand on ouvre ou ferme un formulaire).
  reinitialiser: () => void
}

export type ResultatSecteursAdmin = {
  acces: AccesSecteursAdmin
  // Secteurs, du nom le plus proche de A au plus proche de Z ; null tant qu'ils ne sont pas charges.
  secteurs: SecteurListe[] | null
  // Vrai tant que la liste attend la reponse du serveur (premier chargement).
  chargement: boolean
  // Erreur du chargement de la liste (null = tout va bien).
  erreur: ErreurService | null
  // Identifiant du secteur choisi ; null = aucun.
  secteurChoisiId: string | null
  choisirSecteur: (id: string | null) => void
  // Fiche du secteur choisi ; null tant qu'elle n'est pas chargee.
  detail: SecteurDetail | null
  chargementDetail: boolean
  erreurDetail: ErreurService | null
  // Questionnaires types du secteur choisi ; null tant qu'ils ne sont pas charges.
  // Liste vide = le secteur n'a pas encore de modele.
  modeles: QuestionnaireTypeSecteur[] | null
  chargementModeles: boolean
  // Un echec ici ne bloque pas la fiche : seuls les modeles sont indisponibles.
  erreurModeles: ErreurService | null
  // Relance tous les chargements (bouton "Reessayer").
  recharger: () => void
  creation: ActionCreationSecteur
  actions: ActionsSecteur
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Tri des secteurs par nom francais.
function trierSecteurs(secteurs: SecteurListe[]): SecteurListe[] {
  return [...secteurs].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr'))
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

export function utiliserSecteursAdmin(): ResultatSecteursAdmin {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesSecteursAdmin =
    utilisateur?.role === 'ADMINISTRATEUR' ? 'administrateur' : 'aucun'

  const [secteurs, setSecteurs] = useState<SecteurListe[] | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [secteurChoisiId, setSecteurChoisiId] = useState<string | null>(null)
  // Chaque reponse garde le secteur auquel elle repond : tant qu'il differe du secteur choisi, on charge.
  const [reponseDetail, setReponseDetail] = useState<{
    secteurId: string
    secteur: SecteurDetail
  } | null>(null)
  const [erreurDetail, setErreurDetail] = useState<{
    secteurId: string
    erreur: ErreurService
  } | null>(null)
  const [reponseModeles, setReponseModeles] = useState<{
    secteurId: string
    modeles: QuestionnaireTypeSecteur[]
  } | null>(null)
  const [erreurModeles, setErreurModeles] = useState<{
    secteurId: string
    erreur: ErreurService
  } | null>(null)
  // Augmente a chaque clic sur "Reessayer" ou apres une action pour recharger.
  // Le contenu deja affiche reste en place pendant le rechargement.
  const [relanceListe, setRelanceListe] = useState(0)
  const [relanceDetail, setRelanceDetail] = useState(0)

  const actionCreation = utiliserAction(seDeconnecter)
  const actionSecteur = utiliserAction(seDeconnecter)

  const recharger = useCallback(() => {
    setErreur(null)
    setErreurDetail(null)
    setErreurModeles(null)
    setRelanceListe((valeur) => valeur + 1)
    setRelanceDetail((valeur) => valeur + 1)
  }, [])

  const choisirSecteur = useCallback((id: string | null) => {
    setSecteurChoisiId(id)
  }, [])

  // --- Chargement de la liste ------------------------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultat = await listerSecteurs()
        if (annule) {
          return
        }
        setSecteurs(trierSecteurs(resultat))
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
  }, [acces, relanceListe, seDeconnecter])

  // --- Chargement de la fiche du secteur choisi --------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun' || secteurChoisiId === null) {
      return
    }

    let annule = false
    const secteurId = secteurChoisiId

    async function charger(): Promise<void> {
      try {
        const secteur = await lireSecteur(secteurId)
        if (annule) {
          return
        }
        setReponseDetail({ secteurId, secteur })
        setErreurDetail(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurDetail({ secteurId, erreur: erreurService })
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, secteurChoisiId, relanceDetail, seDeconnecter])

  // --- Chargement des questionnaires types du secteur choisi ---------------------------------------

  useEffect(() => {
    if (acces === 'aucun' || secteurChoisiId === null) {
      return
    }

    let annule = false
    const secteurId = secteurChoisiId

    async function charger(): Promise<void> {
      try {
        const modeles = await listerQuestionnairesTypes(secteurId)
        if (annule) {
          return
        }
        setReponseModeles({ secteurId, modeles })
        setErreurModeles(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setErreurModeles({ secteurId, erreur: erreurService })
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, secteurChoisiId, relanceDetail, seDeconnecter])

  // --- Creation d'un secteur ---------------------------------------------------------------------

  const { executer: executerCreation, reinitialiserEtat: reinitialiserEtatCreation } =
    actionCreation

  const creer = useCallback(
    async (corps: CorpsCreationSecteur): Promise<SecteurDetail | null> => {
      const secteur = await executerCreation(() => creerSecteur(corps))
      if (secteur === null) {
        return null
      }
      // La fiche est deja connue : on la garde, on choisit le nouveau secteur et on recharge la liste
      // pour qu'il apparaisse avec ses compteurs.
      setReponseDetail({ secteurId: secteur.id, secteur })
      setErreurDetail(null)
      setSecteurChoisiId(secteur.id)
      setRelanceListe((valeur) => valeur + 1)
      return secteur
    },
    [executerCreation],
  )

  // --- Modification d'un secteur et de ses themes -----------------------------------------------

  const { executer: executerSecteur, reinitialiserEtat: reinitialiserEtatSecteur } =
    actionSecteur

  const modifier = useCallback(
    async (id: string, corps: CorpsModificationSecteur): Promise<boolean> => {
      const secteur = await executerSecteur(() => modifierSecteur(id, corps))
      if (secteur === null) {
        return false
      }
      setReponseDetail({ secteurId: secteur.id, secteur })
      setErreurDetail(null)
      // Le nom, l'etat actif ou le vocabulaire ont change dans la liste aussi.
      setRelanceListe((valeur) => valeur + 1)
      return true
    },
    [executerSecteur],
  )

  // Apres un theme cree ou modifie, c'est le serveur qui fixe l'ordre : on recharge la fiche
  // et la liste (nombre de themes) plutot que de recalculer a la main.
  const actualiserApresTheme = useCallback(() => {
    setRelanceDetail((valeur) => valeur + 1)
    setRelanceListe((valeur) => valeur + 1)
  }, [])

  const creerUnTheme = useCallback(
    async (secteurId: string, corps: CorpsCreationTheme): Promise<boolean> => {
      const theme = await executerSecteur(() => creerTheme(secteurId, corps))
      if (theme === null) {
        return false
      }
      actualiserApresTheme()
      return true
    },
    [executerSecteur, actualiserApresTheme],
  )

  const modifierUnTheme = useCallback(
    async (secteurId: string, themeId: string, corps: CorpsModificationTheme): Promise<boolean> => {
      const theme = await executerSecteur(() => modifierTheme(secteurId, themeId, corps))
      if (theme === null) {
        return false
      }
      actualiserApresTheme()
      return true
    },
    [executerSecteur, actualiserApresTheme],
  )

  // --- Valeurs renvoyees ---------------------------------------------------------------------------

  const detail = reponseDetail?.secteurId === secteurChoisiId ? reponseDetail.secteur : null
  const erreurDuDetail = erreurDetail?.secteurId === secteurChoisiId ? erreurDetail.erreur : null
  const modeles = reponseModeles?.secteurId === secteurChoisiId ? reponseModeles.modeles : null
  const erreurDesModeles =
    erreurModeles?.secteurId === secteurChoisiId ? erreurModeles.erreur : null

  return {
    acces,
    secteurs,
    chargement: acces !== 'aucun' && secteurs === null && erreur === null,
    erreur,
    secteurChoisiId,
    choisirSecteur,
    detail,
    chargementDetail:
      acces !== 'aucun' && secteurChoisiId !== null && detail === null && erreurDuDetail === null,
    erreurDetail: erreurDuDetail,
    modeles,
    chargementModeles:
      acces !== 'aucun' &&
      secteurChoisiId !== null &&
      modeles === null &&
      erreurDesModeles === null,
    erreurModeles: erreurDesModeles,
    recharger,
    creation: {
      enCours: actionCreation.enCours,
      succes: actionCreation.succes,
      erreur: actionCreation.erreur,
      creer,
      reinitialiser: reinitialiserEtatCreation,
    },
    actions: {
      enCours: actionSecteur.enCours,
      succes: actionSecteur.succes,
      erreur: actionSecteur.erreur,
      modifier,
      creerTheme: creerUnTheme,
      modifierTheme: modifierUnTheme,
      reinitialiser: reinitialiserEtatSecteur,
    },
  }
}