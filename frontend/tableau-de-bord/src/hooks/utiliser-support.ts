import { useCallback, useEffect, useState } from 'react'
import { ErreurService } from '../services/api'
import {
  lireFicheSupport,
  lireIndicateursSupport,
  listerAvisSupport,
  listerPointsContactSupport,
  listerSitesSupport,
  listerUtilisateursSupport,
} from '../services/suivi-dts'
import type { OrganisationAdmin } from '../types/admin'
import type { PointContact, Site } from '../types/sites-points'
import {
  CODE_ACCES_SUPPORT_NON_ACCORDE,
  type ReponseAvisSupport,
  type ReponseIndicateursSupport,
} from '../types/suivi-dts'
import type { UtilisateurListe } from '../types/utilisateurs-admin'
import { utiliserUtilisateur } from './utiliser-utilisateur'

// Toutes les donnees de la page de consultation de support (jour 24), au meme endroit :
// la fiche de l'organisation, les indicateurs, les avis (par page), les sites, les points de
// contact et les utilisateurs. Tout se lit seulement : aucune action n'existe ici.
// Seul l'administrateur DTS a acces a cet ecran : le serveur refuse les autres roles (403).
// Le hook ne fait aucun appel a l'API pour les autres roles ; la page doit les renvoyer
// ailleurs (acces = 'aucun').
// Le serveur verifie l'accord de l'organisation a CHAQUE lecture (accord existant, non expire,
// non retire) et ecrit chaque lecture dans le journal. On lit donc d'abord la fiche :
// - 403 ACCES_SUPPORT_NON_ACCORDE : statut 'sans-accord', les autres parties ne sont pas lues ;
// - 404 : statut 'introuvable' ;
// - autre erreur : statut 'erreur' ;
// - sinon les autres parties se chargent et le statut passe a 'pret'.
// Une session expiree (401) renvoie a la page de connexion.
// Les coordonnees des clients sont masquees par le serveur (contact toujours null).

export type AccesSupport = 'administrateur' | 'aucun'

export type StatutSupport = 'chargement' | 'sans-accord' | 'introuvable' | 'erreur' | 'pret'

// Nombre d'avis par page dans la consultation.
export const AVIS_PAR_PAGE_SUPPORT = 10

// Les parties lues apres la fiche. Chacune peut echouer sans bloquer les autres.
export type PartieSupportChargee = 'indicateurs' | 'avis' | 'sites' | 'pointsContact' | 'utilisateurs'

export type ErreursPartiesSupport = Record<PartieSupportChargee, ErreurService | null>

export type ResultatSupport = {
  acces: AccesSupport
  statut: StatutSupport
  // La fiche de l'organisation ; null tant qu'elle n'est pas chargee (ou si elle est refusee).
  organisation: OrganisationAdmin | null
  // Erreur de la fiche (null = tout va bien).
  erreur: ErreurService | null
  // Indicateurs des 30 derniers jours ; null = pas encore lus ou en erreur.
  indicateurs: ReponseIndicateursSupport | null
  sites: Site[]
  pointsContact: PointContact[]
  utilisateurs: UtilisateurListe[]
  // Vrai tant que les parties attendent la reponse du serveur.
  chargementParties: boolean
  // Erreur de chaque partie (null = tout va bien).
  erreursParties: ErreursPartiesSupport
  // Une page d'avis ; null tant qu'elle n'est pas chargee.
  avis: ReponseAvisSupport | null
  chargementAvis: boolean
  pageAvis: number
  // Change de page (ignore si la page n'existe pas).
  changerPageAvis: (page: number) => void
  // Relance tout le chargement (bouton "Reessayer" ou "Actualiser").
  recharger: () => void
}

type EtatFiche = {
  cle: string
  organisation: OrganisationAdmin | null
  erreur: ErreurService | null
}

type EtatParties = {
  cle: string
  indicateurs: ReponseIndicateursSupport | null
  sites: Site[]
  pointsContact: PointContact[]
  utilisateurs: UtilisateurListe[]
  erreurs: Omit<ErreursPartiesSupport, 'avis'>
}

type EtatAvis = {
  cle: string
  page: number
  reponse: ReponseAvisSupport | null
  erreur: ErreurService | null
}

const AUCUNE_ERREUR: ErreursPartiesSupport = {
  indicateurs: null,
  avis: null,
  sites: null,
  pointsContact: null,
  utilisateurs: null,
}

function versErreurService(erreur: unknown): ErreurService {
  if (erreur instanceof ErreurService) {
    return erreur
  }
  return new ErreurService(0, 'ERREUR_INCONNUE', 'Une erreur est survenue.', null)
}

// Vrai si l'organisation n'a pas donne son accord (ou s'il est expire ou retire).
function estRefusSupport(erreur: ErreurService | null): boolean {
  return erreur !== null && erreur.statut === 403 && erreur.code === CODE_ACCES_SUPPORT_NON_ACCORDE
}

// Resultat d'une partie lue avec Promise.allSettled : la valeur, ou l'erreur.
function lireResultat<T>(resultat: PromiseSettledResult<T>): { valeur: T | null; erreur: ErreurService | null } {
  if (resultat.status === 'fulfilled') {
    return { valeur: resultat.value, erreur: null }
  }
  return { valeur: null, erreur: versErreurService(resultat.reason) }
}

export function utiliserSupport(organisationId: string): ResultatSupport {
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()

  const acces: AccesSupport = utilisateur?.role === 'ADMINISTRATEUR' ? 'administrateur' : 'aucun'

  // Augmente a chaque clic sur "Reessayer" ou "Actualiser" pour tout recharger.
  const [relance, setRelance] = useState(0)
  const [pageAvis, setPageAvis] = useState(1)
  // Chaque lecture garde la cle de la relance a laquelle elle repond : tant qu'elles different, on charge.
  const cle = `${organisationId}:${relance}`

  const [fiche, setFiche] = useState<EtatFiche | null>(null)
  const [parties, setParties] = useState<EtatParties | null>(null)
  const [lectureAvis, setLectureAvis] = useState<EtatAvis | null>(null)

  const recharger = useCallback(() => {
    setPageAvis(1)
    setRelance((valeur) => valeur + 1)
  }, [])

  // --- 1. La fiche : elle verifie l'accord avant toute autre lecture ------------------------------

  useEffect(() => {
    if (acces === 'aucun' || organisationId === '') {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const organisation = await lireFicheSupport(organisationId)
        if (annule) {
          return
        }
        setFiche({ cle, organisation, erreur: null })
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
        setFiche({ cle, organisation: null, erreur: erreurService })
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, organisationId, cle, seDeconnecter])

  const ficheLue = fiche !== null && fiche.cle === cle ? fiche : null
  const ficheReussie = ficheLue !== null && ficheLue.erreur === null

  // --- 2. Les autres parties, seulement si la fiche est lue (donc l'accord existe) --------------

  useEffect(() => {
    if (acces === 'aucun' || !ficheReussie) {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      const [indicateurs, sites, pointsContact, utilisateurs] = await Promise.allSettled([
        lireIndicateursSupport(organisationId),
        listerSitesSupport(organisationId),
        listerPointsContactSupport(organisationId),
        listerUtilisateursSupport(organisationId),
      ])
      if (annule) {
        return
      }

      const lecture = {
        indicateurs: lireResultat(indicateurs),
        sites: lireResultat(sites),
        pointsContact: lireResultat(pointsContact),
        utilisateurs: lireResultat(utilisateurs),
      }
      const erreurs = {
        indicateurs: lecture.indicateurs.erreur,
        sites: lecture.sites.erreur,
        pointsContact: lecture.pointsContact.erreur,
        utilisateurs: lecture.utilisateurs.erreur,
      }

      // Session expiree pendant la lecture : retour a la page de connexion.
      if (Object.values(erreurs).some((erreur) => erreur !== null && erreur.statut === 401)) {
        void seDeconnecter()
        return
      }

      setParties({
        cle,
        indicateurs: lecture.indicateurs.valeur,
        sites: lecture.sites.valeur ?? [],
        pointsContact: lecture.pointsContact.valeur ?? [],
        utilisateurs: lecture.utilisateurs.valeur ?? [],
        erreurs,
      })
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, ficheReussie, organisationId, cle, seDeconnecter])

  // --- 3. Les avis : une page a la fois ------------------------------------------------------------

  useEffect(() => {
    if (acces === 'aucun' || !ficheReussie) {
      return
    }

    let annule = false

    async function charger(): Promise<void> {
      try {
        const reponse = await listerAvisSupport(organisationId, {
          page: pageAvis,
          limite: AVIS_PAR_PAGE_SUPPORT,
        })
        if (annule) {
          return
        }
        setLectureAvis({ cle, page: pageAvis, reponse, erreur: null })
      } catch (e) {
        if (annule) {
          return
        }
        const erreurService = versErreurService(e)
        if (erreurService.statut === 401) {
          void seDeconnecter()
          return
        }
        setLectureAvis({ cle, page: pageAvis, reponse: null, erreur: erreurService })
      }
    }

    void charger()

    return () => {
      annule = true
    }
  }, [acces, ficheReussie, organisationId, cle, pageAvis, seDeconnecter])

  const changerPageAvis = useCallback(
    (page: number) => {
      const pages = lectureAvis?.reponse?.pagination.pages ?? 1
      if (page < 1 || page > pages) {
        return
      }
      setPageAvis(page)
    },
    [lectureAvis],
  )

  // --- Resultat ----------------------------------------------------------------------------------

  const partiesLues = parties !== null && parties.cle === cle ? parties : null
  const avisLus = lectureAvis !== null && lectureAvis.cle === cle && lectureAvis.page === pageAvis ? lectureAvis : null

  const erreursParties: ErreursPartiesSupport = {
    ...AUCUNE_ERREUR,
    ...(partiesLues?.erreurs ?? {}),
    avis: avisLus?.erreur ?? null,
  }

  // L'accord a pu expirer ou etre retire entre deux lectures : une partie refusee donne aussi 'sans-accord'.
  const refuseEnCours = Object.values(erreursParties).some(estRefusSupport)

  let statut: StatutSupport
  if (ficheLue === null) {
    statut = 'chargement'
  } else if (estRefusSupport(ficheLue.erreur) || refuseEnCours) {
    statut = 'sans-accord'
  } else if (ficheLue.erreur !== null && ficheLue.erreur.statut === 404) {
    statut = 'introuvable'
  } else if (ficheLue.erreur !== null) {
    statut = 'erreur'
  } else {
    statut = 'pret'
  }

  return {
    acces,
    statut: acces === 'aucun' ? 'chargement' : statut,
    organisation: statut === 'sans-accord' ? null : (ficheLue?.organisation ?? null),
    erreur: ficheLue?.erreur ?? null,
    indicateurs: partiesLues?.indicateurs ?? null,
    sites: partiesLues?.sites ?? [],
    pointsContact: partiesLues?.pointsContact ?? [],
    utilisateurs: partiesLues?.utilisateurs ?? [],
    chargementParties: acces !== 'aucun' && ficheReussie && partiesLues === null,
    erreursParties,
    avis: avisLus?.reponse ?? null,
    chargementAvis: acces !== 'aucun' && ficheReussie && avisLus === null,
    pageAvis,
    changerPageAvis,
    recharger,
  }
}