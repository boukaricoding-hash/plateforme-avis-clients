import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { StatutTraitement } from '../types/tableau-de-bord'
import { cleTexteStatut, STATUTS_AVIS } from '../utilitaires/statuts-avis'
import { PastilleStatut } from './pastille-statut'

// Bloc "Traitement de l'avis" de la fiche d'un avis (E9) :
// - les 4 boutons de statut, avec un commentaire facultatif enregistre dans l'historique ;
// - le formulaire de note interne.
// Ce composant n'appelle pas l'API : les actions viennent de utiliserFicheAvis, qui met la
// fiche a jour apres chaque succes. Ici on garde seulement ce que la personne tape et les
// messages (succes, champ vide ou trop long). Les erreurs de l'API sont donnees par le hook.

const LONGUEUR_MAX = 2000

const CLASSES_CHAMP =
  'w-full rounded-md border border-bordure-champ bg-surface px-3 py-2 text-base text-texte placeholder:text-texte-discret'
const CLASSES_BOUTON_STATUT =
  'min-h-11 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'

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
    <p role="alert" className="mt-2 text-sm text-erreur">
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
  const idCommentaire = useId()
  const idAideCommentaire = useId()
  const idNote = useId()
  const idAideNote = useId()

  const [commentaire, setCommentaire] = useState('')
  const [statutModifie, setStatutModifie] = useState(false)
  const [note, setNote] = useState('')
  const [noteAjoutee, setNoteAjoutee] = useState(false)
  // Erreur de saisie de la note (vide ou trop longue), avant tout appel a l'API.
  const [erreurSaisieNote, setErreurSaisieNote] = useState<string | null>(null)

  const commentaireTropLong = commentaire.trim().length > LONGUEUR_MAX
  const noteTropLongue = note.trim().length > LONGUEUR_MAX

  async function choisirStatut(statut: StatutTraitement): Promise<void> {
    setStatutModifie(false)
    const reussi = await changerStatut(statut, commentaire)
    if (reussi) {
      setCommentaire('')
      setStatutModifie(true)
    }
  }

  async function envoyerNote(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setNoteAjoutee(false)
    const texte = note.trim()
    if (texte === '') {
      setErreurSaisieNote(t('avis.fiche.suivi.note.vide'))
      return
    }
    if (texte.length > LONGUEUR_MAX) {
      setErreurSaisieNote(t('avis.fiche.suivi.note.tropLongue'))
      return
    }
    setErreurSaisieNote(null)
    const reussi = await ajouterNote(texte)
    if (reussi) {
      setNote('')
      setNoteAjoutee(true)
    }
  }

  return (
    <section aria-labelledby="titre-suivi-avis" className="rounded-xl border border-bordure bg-surface p-4">
      <h2 id="titre-suivi-avis" className="font-titre text-lg font-bold text-texte">
        {t('avis.fiche.suivi.titre')}
      </h2>

      {/* Changement de statut */}
      <div className="mt-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-texte-secondaire">
          <span>{t('avis.fiche.suivi.statutActuel')}</span>
          <PastilleStatut statut={statutActuel} />
        </p>

        <div role="group" aria-label={t('avis.fiche.suivi.changerStatut')} className="mt-3">
          <p className="mb-2 text-sm font-medium text-texte-secondaire">
            {t('avis.fiche.suivi.changerStatut')}
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUTS_AVIS.map((statut) => {
              const estActuel = statut === statutActuel
              return (
                <button
                  key={statut}
                  type="button"
                  aria-pressed={estActuel}
                  disabled={estActuel || statutEnCours || commentaireTropLong}
                  onClick={() => void choisirStatut(statut)}
                  className={`${CLASSES_BOUTON_STATUT} ${
                    estActuel
                      ? 'border-principale bg-principale text-texte-sur-principale'
                      : 'border-bordure-champ bg-surface text-texte hover:bg-surface-douce'
                  }`}
                >
                  {estActuel
                    ? `${t(cleTexteStatut(statut))} (${t('avis.fiche.suivi.actuel')})`
                    : t(cleTexteStatut(statut))}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor={idCommentaire} className="mb-1 block text-sm font-medium text-texte-secondaire">
            {t('avis.fiche.suivi.commentaireStatut')}
          </label>
          <textarea
            id={idCommentaire}
            rows={2}
            value={commentaire}
            aria-describedby={idAideCommentaire}
            onChange={(evenement) => {
              setCommentaire(evenement.target.value)
              setStatutModifie(false)
            }}
            className={CLASSES_CHAMP}
          />
          <p id={idAideCommentaire} className="mt-1 text-xs text-texte-discret">
            {t('avis.fiche.suivi.commentaireStatutAide')}
          </p>
          {commentaireTropLong && (
            <p role="alert" className="mt-1 text-sm text-erreur">
              {t('avis.fiche.suivi.commentaireTropLong')}
            </p>
          )}
        </div>

        {/* Etat de l'enregistrement : annonce aux lecteurs d'ecran */}
        <p role="status" className="mt-2 min-h-5 text-sm text-texte-secondaire">
          {statutEnCours
            ? t('avis.fiche.suivi.enregistrement')
            : statutModifie
              ? t('avis.fiche.suivi.statutModifie')
              : ''}
        </p>
        {erreurStatut !== null && (
          <MessageErreur erreur={erreurStatut} cleGenerale="avis.fiche.suivi.erreurStatut" />
        )}
      </div>

      {/* Note interne */}
      <form onSubmit={(evenement) => void envoyerNote(evenement)} className="mt-5 border-t border-bordure pt-4">
        <label htmlFor={idNote} className="mb-1 block text-sm font-medium text-texte">
          {t('avis.fiche.suivi.note.titre')}
        </label>
        <p id={idAideNote} className="mb-2 text-xs text-texte-discret">
          {t('avis.fiche.suivi.note.aide')}
        </p>
        <textarea
          id={idNote}
          rows={3}
          value={note}
          placeholder={t('avis.fiche.suivi.note.placeholder')}
          aria-describedby={idAideNote}
          aria-invalid={erreurSaisieNote !== null}
          onChange={(evenement) => {
            setNote(evenement.target.value)
            setNoteAjoutee(false)
            setErreurSaisieNote(null)
          }}
          className={CLASSES_CHAMP}
        />
        <p className={`mt-1 text-xs ${noteTropLongue ? 'text-erreur' : 'text-texte-discret'}`}>
          {t('avis.fiche.suivi.note.compteur', { nombre: note.trim().length })}
        </p>
        {erreurSaisieNote !== null && (
          <p role="alert" className="mt-1 text-sm text-erreur">
            {erreurSaisieNote}
          </p>
        )}
        {erreurNote !== null && (
          <MessageErreur erreur={erreurNote} cleGenerale="avis.fiche.suivi.note.erreur" />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={noteEnCours}
            aria-busy={noteEnCours}
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-medium text-texte-sur-principale transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {noteEnCours ? t('avis.fiche.suivi.note.ajout') : t('avis.fiche.suivi.note.ajouter')}
          </button>
          <p role="status" className="text-sm text-texte-secondaire">
            {noteAjoutee ? t('avis.fiche.suivi.note.ajoutee') : ''}
          </p>
        </div>
      </form>
    </section>
  )
}