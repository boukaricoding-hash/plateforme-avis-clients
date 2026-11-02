import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { cleTexteStatut, STATUTS_AVIS } from '../utilitaires/statuts-avis'
import { IconeCoche, IconeEnregistrer } from './icones-avis'

// Bloc "Traitement de l'avis" du detail d'un avis (page unique, jour 15 design).
// Version compacte de l'ecran E9 : une seule zone de texte pour les deux actions.
// - Un clic sur un des 4 statuts change le statut et joint le texte tape comme commentaire,
//   enregistre dans l'historique avec le changement.
// - Le bouton "Enregistrer" ajoute le texte comme note interne (visible seulement par l'equipe).
// Ce composant n'appelle pas l'API : les actions viennent de utiliserFicheAvis, qui met la
// fiche a jour apres chaque succes. Ici on garde seulement ce que la personne tape et les
// messages (succes, texte vide ou trop long). Les erreurs de l'API sont donnees par le hook.
// Le style vient de styles/avis.css (classes avis-panneau, avis-statuts, avis-statut-bouton,
// avis-champ, avis-bouton-principal).

const LONGUEUR_MAX = 2000

type Proprietes = {
  statutActuel: StatutTraitement
  changerStatut: (statut: StatutTraitement, commentaire: string) => Promise<boolean>
  statutEnCours: boolean
  erreurStatut: ErreurService | null
  ajouterNote: (commentaire: string) => Promise<boolean>
  noteEnCours: boolean
  erreurNote: ErreurService | null
}

type PropsErreur = {
  erreur: ErreurService
  cleGenerale: string
}

// Message d'une erreur de l'API : pas de reseau (statut 0) ou erreur generale de l'action.
function MessageErreur({ erreur, cleGenerale }: PropsErreur) {
  const { t } = utiliserLangue()

  return (
    <p role="alert" className="m-0 text-xs text-erreur">
      {erreur.statut === 0 ? t('commun.erreurReseau') : t(cleGenerale)}
    </p>
  )
}

export function PanneauSuivi({
  statutActuel,
  changerStatut,
  statutEnCours,
  erreurStatut,
  ajouterNote,
  noteEnCours,
  erreurNote,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idTexte = useId()
  const idAide = useId()

  const [texte, setTexte] = useState('')
  const [statutModifie, setStatutModifie] = useState(false)
  const [noteAjoutee, setNoteAjoutee] = useState(false)
  // Erreur de saisie (vide), avant tout appel a l'API.
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null)

  const texteNettoye = texte.trim()
  const tropLong = texteNettoye.length > LONGUEUR_MAX
  // Texte trop long : le message apparait des la saisie, et les statuts sont bloques.
  const messageSaisie = erreurSaisie ?? (tropLong ? t('avis.fiche.suivi.note.tropLongue') : null)

  async function choisirStatut(statut: StatutTraitement): Promise<void> {
    if (statut === statutActuel) {
      return
    }
    setStatutModifie(false)
    setNoteAjoutee(false)
    const reussi = await changerStatut(statut, texte)
    if (reussi) {
      setTexte('')
      setStatutModifie(true)
    }
  }

  async function enregistrerNote(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setStatutModifie(false)
    setNoteAjoutee(false)
    if (texteNettoye === '') {
      setErreurSaisie(t('avis.fiche.suivi.note.vide'))
      return
    }
    if (tropLong) {
      setErreurSaisie(t('avis.fiche.suivi.note.tropLongue'))
      return
    }
    setErreurSaisie(null)
    const reussi = await ajouterNote(texteNettoye)
    if (reussi) {
      setTexte('')
      setNoteAjoutee(true)
    }
  }

  // Etat de l'action en cours ou terminee : annonce aux lecteurs d'ecran (role status)
  function messageEtat(): string {
    if (statutEnCours) {
      return t('avis.fiche.suivi.enregistrement')
    }
    if (noteEnCours) {
      return t('avis.fiche.suivi.note.ajout')
    }
    if (statutModifie) {
      return t('avis.fiche.suivi.statutModifie')
    }
    if (noteAjoutee) {
      return t('avis.fiche.suivi.note.ajoutee')
    }
    return ''
  }

  return (
    <section aria-labelledby="titre-suivi-avis" className="avis-panneau">
      <h3 id="titre-suivi-avis" className="avis-panneau-titre">
        <IconeCoche />
        {t('avis.fiche.suivi.titre')}
      </h3>

      {/* Changement de statut : le statut actuel est mis en avant */}
      <div role="group" aria-label={t('avis.fiche.suivi.changerStatut')} className="avis-statuts">
        {STATUTS_AVIS.map((statut) => {
          const estActuel = statut === statutActuel
          return (
            <button
              key={statut}
              type="button"
              aria-pressed={estActuel}
              disabled={statutEnCours || tropLong}
              onClick={() => void choisirStatut(statut)}
              className={estActuel ? 'avis-statut-bouton avis-statut-bouton--actuel' : 'avis-statut-bouton'}
            >
              {t(cleTexteStatut(statut))}
            </button>
          )
        })}
      </div>

      {/* Zone de texte commune : commentaire du changement de statut, ou note interne */}
      <form onSubmit={(evenement) => void enregistrerNote(evenement)} className="mt-2 flex flex-col gap-2">
        <label htmlFor={idTexte} className="sr-only">
          {t('avis.fiche.suivi.note.titre')}
        </label>
        <textarea
          id={idTexte}
          rows={2}
          value={texte}
          placeholder={t('avis.fiche.suivi.note.placeholder')}
          aria-describedby={idAide}
          aria-invalid={messageSaisie !== null}
          onChange={(evenement) => {
            setTexte(evenement.target.value)
            setStatutModifie(false)
            setNoteAjoutee(false)
            setErreurSaisie(null)
          }}
          className="avis-champ"
        />
        <p id={idAide} className="sr-only">
          {t('avis.fiche.suivi.commentaireStatutAide')} {t('avis.fiche.suivi.note.aide')}
        </p>
        <button
          type="submit"
          disabled={noteEnCours || statutEnCours}
          aria-busy={noteEnCours}
          className="avis-bouton-principal"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <IconeEnregistrer width={16} height={16} />
            {t('avis.detail.enregistrer')}
          </span>
        </button>
        <p role="status" className="m-0 min-h-4 text-xs text-texte-secondaire">
          {messageEtat()}
        </p>
        {messageSaisie !== null && (
          <p role="alert" className="m-0 text-xs text-erreur">
            {messageSaisie}
          </p>
        )}
        {erreurStatut !== null && (
          <MessageErreur erreur={erreurStatut} cleGenerale="avis.fiche.suivi.erreurStatut" />
        )}
        {erreurNote !== null && (
          <MessageErreur erreur={erreurNote} cleGenerale="avis.fiche.suivi.note.erreur" />
        )}
      </form>
    </section>
  )
}