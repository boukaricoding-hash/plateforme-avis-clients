import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import { listerPointsContact } from '../services/points-contact'
import { listerStatistiquesQr, revoquerQr } from '../services/qr-codes'
import { listerSites } from '../services/sites'
import {
  LIMITE_PLANCHE,
  type LigneQr,
  type ReponseRevocationQr,
  type StatistiquesQr,
} from '../types/qr-codes'
import type { PointContact, Site } from '../types/sites-points'
import type { AccesSitesPoints, EtatAction } from './utiliser-sites-points'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de l'ecran E11 (QR codes et chevalets, jour 17), au meme endroit :
// - les points de contact et leurs statistiques (scans, avis, taux de conversion), fusionnes
//   en une liste de lignes, pour tous les sites ou pour un seul (filtre) ;
// - la pagination de cette liste (POINTS_PAR_PAGE cartes par page) ;
// - le nombre de chevalets de la planche A4, pour prevenir avant un telechargement impossible ;
// - l'action "revoquer" ou "regenerer" un QR, avec son etat : en cours, succes, erreur.
// Le Responsable peut revoquer et regenerer ; le Gestionnaire telecharge seulement (le serveur
// refuse sa revocation avec un 403, et la page cache les boutons).
// Le hook ne fait aucun appel a l'API pour l'administrateur DTS : il n'a pas d'organisation,
// l'API lui refuse ces routes. La page doit le renvoyer ailleurs (acces = 'aucun').
// Une session expiree (401) renvoie a la page de connexion.

// Nombre de cartes par page : les apercus se chargent au defilement (loading="lazy").
export const POINTS_PAR_PAGE = 12

export type ActionRevocation = EtatAction & {
  // Point concerne par la derniere action (reussie ou non) ; null avant toute action.
  pointId: string | null
  // Reponse du serveur apres une action reussie : revoque ou regenere ; sinon null.
  resultat: ReponseRevocationQr | null
  // regenerer = false : revoque seulement ; regenerer = true : nouveau code, l'ancien chevalet
  // imprime n'est plus reconnu. Renvoie true si c'est fait.
  changer: (pointId: string, regenerer: boolean) => Promise<boolean>
}

export type ResultatQrCodes = {
  acces: AccesSitesPoints
  // Vrai pour le Responsable : lui seul voit les boutons Revoquer et Regenerer.
  peutModifier: boolean
  // Sites pour le filtre ; null tant qu'ils ne sont pas charges (ou si le chargement a echoue :
  // le filtre est alors seulement indisponible, la liste reste affichee).
  sites: Site[] | null
  // Site choisi dans le filtre ; '' = tous les sites.
  filtreSite: string
  choisirSite: (id: string) => void
  // Tous les points du filtre ; null tant qu'ils ne sont pas charges.
  lignes: LigneQr[] | null
  // Les cartes de la page affichee.
  lignesPage: LigneQr[]
  chargement: boolean
  // Erreur du chargement (null = tout va bien).
  erreur: ErreurService | null
  // Numero de la page affichee, a partir de 0.
  pageCourante: number
  nbPages: number
  allerPage: (page: number) => void
  // Chevalets de la planche A4 : points actifs et non revoques du filtre (comme le serveur).
  nbPointsPlanche: number
  // Faux s'il n'y a aucun chevalet ou plus de LIMITE_PLANCHE : le serveur refuserait la planche.
  planchePossible: boolean
  // Relance les chargements (bouton "Reessayer").
  recharger: () => void
  // Augmente pour un point chaque fois que son QR est regenere : la carte s'en sert pour
  // recharger l'apercu (meme adresse, nouvelle image).
  versionsQr: Record<string, number>
  revocation: ActionRevocation
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Tri des sites par nom, comme le serveur.
function trierSites(sites: Site[]): Site[] {
  return [...sites].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Un point et ses chiffres, dans l'ordre naturel : Table 2 avant Table 10.
function fusionner(points: PointContact[], statistiques: StatistiquesQr[]): LigneQr[] {
  const parPoint = new Map(statistiques.map((ligne) => [ligne.point_contact_id, ligne]))
  return [...points]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
    .map((point) => ({ point, statistiques: parPoint.get(point.id) ?? null }))
}

export function utiliserQrCodes(): ResultatQrCodes {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const role = utilisateur?.role ?? null
  const acces: AccesSitesPoints =
    role === 'RESPONSABLE' ? 'responsable' : role === 'GESTIONNAIRE' ? 'gestionnaire' : 'aucun'

  const [sites, setSites] = useState<Site[] | null>(null)
  const [filtreSite, setFiltreSite] = useState('')
  // Les lignes sont gardees avec le filtre auquel elles appartiennent : celles d'un autre site
  // ne s'affichent jamais.
  const [donnees, setDonnees] = useState<{ filtre: string; lignes: LigneQr[] } | null>(null)
  const [erreur, setErreur] = useState<ErreurService | null>(null)
  const [page, setPage] = useState(0)
  // Augmente a chaque clic sur "Reessayer" pour relancer les chargements.
  const [relance, setRelance] = useState(0)
  // Augmente apres une revocation ou une regeneration pour recharger la liste sans l'effacer.
  const [relanceDonnees, setRelanceDonnees] = useState(0)
  const [versionsQr, setVersionsQr] = useState<Record<string, number>>({})

  // Etat de l'action revoquer / regenerer.
  const [enCours, setEnCours] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreurAction, setErreurAction] = useState<ErreurService | null>(null)
  const [pointAction, setPointAction] = useState<string | null>(null)
  const [resultat, setResultat] = useState<ReponseRevocationQr | null>(null)

  const choisirSite = useCallback((id: string) => {
    setErreur(null)
    setPage(0)
    setFiltreSite(id)
  }, [])

  const recharger = useCallback(() => {
    setErreur(null)
    setRelance((valeur) => valeur + 1)
  }, [])

  const allerPage = useCallback((numero: number) => {
    setPage(Math.max(0, numero))
  }, [])

  // --- Chargement des sites (pour le filtre) -----------------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const resultatSites = await listerSites()
        if (annule) {
          return
        }
        setSites(trierSites(resultatSites))
      } catch (e) {
        if (annule) {
          return
        }
        if (versErreurService(e).statut === 401) {
          // Session expiree : retour a la page de connexion.
          void seDeconnecter()
        }
        // Autre echec : le filtre par site est indisponible, la liste reste affichee.
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, relance, seDeconnecter])

  // --- Chargement des points et de leurs statistiques --------------------------------------

  useEffect(() => {
    if (acces === 'aucun') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      const siteId = filtreSite === '' ? undefined : filtreSite
      try {
        const [points, statistiques] = await Promise.all([
          listerPointsContact(siteId),
          listerStatistiquesQr(siteId),
        ])
        if (annule) {
          return
        }
        setDonnees({ filtre: filtreSite, lignes: fusionner(points, statistiques) })
        setErreur(null)
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
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
  }, [acces, filtreSite, relance, relanceDonnees, seDeconnecter])

  // --- Revoquer ou regenerer un QR code ----------------------------------------------------

  const changer = useCallback(
    async (pointId: string, regenerer: boolean): Promise<boolean> => {
      setPointAction(pointId)
      setSucces(false)
      setErreurAction(null)
      setResultat(null)
      setEnCours(true)
      try {
        const reponse = await revoquerQr(pointId, regenerer)
        setResultat(reponse)
        setSucces(true)
        if (reponse.action === 'regenere') {
          setVersionsQr((avant) => ({ ...avant, [pointId]: (avant[pointId] ?? 0) + 1 }))
        }
        // La liste se recharge : l'etat revoque du point change.
        setRelanceDonnees((valeur) => valeur + 1)
        return true
      } catch (e) {
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return false
        }
        setErreurAction(erreurService)
        return false
      } finally {
        setEnCours(false)
      }
    },
    [seDeconnecter],
  )

  // --- Ce que la page affiche --------------------------------------------------------------

  const lignes = donnees !== null && donnees.filtre === filtreSite ? donnees.lignes : null
  const nbPages = Math.max(1, Math.ceil((lignes?.length ?? 0) / POINTS_PAR_PAGE))
  const pageCourante = Math.min(page, nbPages - 1)
  const lignesPage =
    lignes?.slice(pageCourante * POINTS_PAR_PAGE, (pageCourante + 1) * POINTS_PAR_PAGE) ?? []
  const nbPointsPlanche =
    lignes === null
      ? 0
      : lignes.filter((ligne) => ligne.point.actif && ligne.point.revoque_le === null).length

  return {
    acces,
    peutModifier: acces === 'responsable',
    sites,
    filtreSite,
    choisirSite,
    lignes,
    lignesPage,
    chargement: acces !== 'aucun' && lignes === null && erreur === null,
    erreur,
    pageCourante,
    nbPages,
    allerPage,
    nbPointsPlanche,
    planchePossible: nbPointsPlanche > 0 && nbPointsPlanche <= LIMITE_PLANCHE,
    recharger,
    versionsQr,
    revocation: { enCours, succes, erreur: erreurAction, pointId: pointAction, resultat, changer },
  }
}