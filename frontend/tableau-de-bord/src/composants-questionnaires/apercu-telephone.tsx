import { useEffect, useRef, useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { LangueQuestionnaire } from '../types/questionnaires'
import type { DonneesApercu } from '../utilitaires/vers-apercu-public'

// Apercu du questionnaire au format telephone (jour 20), a cote de l'editeur.
// Il montre les VRAIS ecrans de la page d'avis du client : la page /apercu de l'application
// publique est affichee dans un cadre de telephone (iframe) et recoit le questionnaire
// en cours de modification a chaque frappe. Rien n'est enregistre ni envoye au serveur.
//
// Echanges avec la page /apercu (postMessage, voir application-avis-public/src/pages/6-apercu) :
// - apercu -> ici : { type: 'apercu-pret' } quand la page ecoute (a chaque chargement) ;
// - ici -> apercu : { type: 'apercu-donnees', donnees, langue } a chaque modification ;
// - ici -> apercu : { type: 'apercu-recommencer' } pour revenir a l'accueil.
// Seuls les messages venant de CE cadre et de la bonne adresse sont pris en compte,
// et les messages ne partent que vers cette adresse.
//
// Adresse de la page /apercu :
// - en production (Docker) : la meme adresse que le tableau de bord, donc /apercu ;
// - en developpement : la page d'avis tourne a part, sur le port 5173 du meme ordinateur.
//
// Ce composant ne construit pas le questionnaire : la page lui donne les donnees deja converties
// (utilitaires/vers-apercu-public.ts). Les styles sont dans styles/publication-questionnaire.css.

const PORT_PAGE_AVIS_DEV = 5173

const ORIGINE_APERCU = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:${PORT_PAGE_AVIS_DEV}`
  : window.location.origin

const URL_APERCU = `${ORIGINE_APERCU}/apercu`

// Taille d'un telephone courant : sert de repli tant que la feuille de style n'est pas chargee.
const LARGEUR_TELEPHONE = 375
const HAUTEUR_TELEPHONE = 667

const MESSAGE_PRET = 'apercu-pret'
const MESSAGE_DONNEES = 'apercu-donnees'
const MESSAGE_RECOMMENCER = 'apercu-recommencer'

type PropsApercuTelephone = {
  donnees: DonneesApercu
  // Langue montree dans l'apercu (celle du questionnaire, ou celle que la personne veut tester).
  langue: LangueQuestionnaire
}

export function ApercuTelephone({ donnees, langue }: PropsApercuTelephone) {
  const { t } = utiliserLangue()
  const cadreRef = useRef<HTMLIFrameElement>(null)
  // Augmente a chaque fois que la page /apercu dit qu'elle est prete : les donnees repartent alors.
  const [numeroPret, setNumeroPret] = useState(0)
  // Dernier envoi : evite de renvoyer le meme contenu quand rien n'a change.
  const dernierEnvoiRef = useRef<{ numero: number; texte: string } | null>(null)

  // Ecoute le message "pret" de la page /apercu.
  useEffect(() => {
    function recevoir(evenement: MessageEvent): void {
      const cadre = cadreRef.current
      if (cadre === null || evenement.source !== cadre.contentWindow) {
        return
      }
      if (evenement.origin !== ORIGINE_APERCU) {
        return
      }
      const message: unknown = evenement.data
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === MESSAGE_PRET
      ) {
        setNumeroPret((numero) => numero + 1)
      }
    }

    window.addEventListener('message', recevoir)
    return () => window.removeEventListener('message', recevoir)
  }, [])

  // Envoie le questionnaire des que l'apercu est pret, puis a chaque modification.
  useEffect(() => {
    if (numeroPret === 0) {
      return
    }
    const fenetre = cadreRef.current?.contentWindow
    if (!fenetre) {
      return
    }
    const texte = JSON.stringify({ donnees, langue })
    const dernier = dernierEnvoiRef.current
    if (dernier !== null && dernier.numero === numeroPret && dernier.texte === texte) {
      return
    }
    dernierEnvoiRef.current = { numero: numeroPret, texte }
    fenetre.postMessage({ type: MESSAGE_DONNEES, donnees, langue }, ORIGINE_APERCU)
  }, [numeroPret, donnees, langue])

  function recommencer(): void {
    cadreRef.current?.contentWindow?.postMessage({ type: MESSAGE_RECOMMENCER }, ORIGINE_APERCU)
  }

  return (
    <section className="apercu-telephone" aria-label={t('questionnaires.apercu.titre')}>
      <div className="apercu-telephone-entete">
        <h2 className="apercu-telephone-titre">{t('questionnaires.apercu.titre')}</h2>
        <button
          type="button"
          className="apercu-telephone-bouton"
          onClick={recommencer}
          disabled={numeroPret === 0}
        >
          {t('questionnaires.apercu.recommencer')}
        </button>
      </div>

      <div className="apercu-telephone-cadre">
        <iframe
          ref={cadreRef}
          className="apercu-telephone-ecran"
          src={URL_APERCU}
          title={t('questionnaires.apercu.cadre')}
          width={LARGEUR_TELEPHONE}
          height={HAUTEUR_TELEPHONE}
        />
      </div>

      <p className="apercu-telephone-note">{t('questionnaires.apercu.note')}</p>
    </section>
  )
}