import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtatAlertes } from '../hooks/utiliser-parametres'
import {
  SEUIL_NOTE_MAX,
  SEUIL_NOTE_MIN,
  SEUIL_NPS_MAX,
  SEUIL_NPS_MIN,
  type CorpsModificationParametres,
  type ParametresOrganisation,
} from '../types/parametres'

// Section "Couleur et seuils d'alerte" de l'ecran E14 (jour 16), Responsable seulement.
// - couleur principale : #RRGGBB, ou vide pour revenir a la couleur par defaut ;
// - seuil de note (1 a 4) et seuil NPS (0 a 9) : un avis negatif declenche une alerte.
// Ce composant n'appelle pas l'API : l'enregistrement vient de utiliserParametres, qui renvoie
// les parametres a jour apres chaque succes. Ici on garde seulement ce que la personne tape,
// on verifie les valeurs avant l'envoi et on n'envoie que les champs modifies.

type Proprietes = {
  parametres: ParametresOrganisation
  etat: EtatAlertes
}

const MODELE_COULEUR = /^#[0-9a-f]{6}$/
// Couleur montree par le selecteur quand aucune couleur n'est choisie.
const COULEUR_SELECTEUR_DEFAUT = '#000000'

// Seuil saisi : un entier entre min et max, sinon null.
function lireSeuil(texte: string, min: number, max: number): number | null {
  const propre = texte.trim()
  if (!/^\d+$/.test(propre)) {
    return null
  }
  const valeur = Number(propre)
  return valeur >= min && valeur <= max ? valeur : null
}

type ProprietesChampSeuil = {
  id: string
  libelle: string
  aide: string
  valeur: string
  min: number
  max: number
  erreur: string | null
  surChangement: (valeur: string) => void
}

// Un champ de seuil : libelle, aide, message d'erreur eventuel.
function ChampSeuil({
  id,
  libelle,
  aide,
  valeur,
  min,
  max,
  erreur,
  surChangement,
}: ProprietesChampSeuil) {
  const idAide = `${id}-aide`
  const idErreur = `${id}-erreur`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-texte">
        {libelle}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={valeur}
        aria-invalid={erreur !== null}
        aria-describedby={erreur !== null ? `${idAide} ${idErreur}` : idAide}
        onChange={(evenement) => surChangement(evenement.target.value)}
        className="min-h-11 w-28 rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
      />
      <p id={idAide} className="m-0 text-xs text-texte-secondaire">
        {aide}
      </p>
      {erreur !== null && (
        <p id={idErreur} role="alert" className="m-0 text-xs text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

export function SectionAlertes({ parametres, etat }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idCouleur = useId()
  const idSelecteur = useId()
  const idSeuilNote = useId()
  const idSeuilNps = useId()

  // Ce que la personne tape : on part des parametres enregistres.
  const [couleur, setCouleur] = useState(parametres.couleur_principale ?? '')
  const [seuilNote, setSeuilNote] = useState(String(parametres.seuil_alerte_note))
  const [seuilNps, setSeuilNps] = useState(String(parametres.seuil_alerte_nps))
  // Les messages d'erreur de saisie apparaissent apres le premier essai d'enregistrement.
  const [tentative, setTentative] = useState(false)

  const couleurPropre = couleur.trim().toLowerCase()
  const couleurValide = couleurPropre === '' || MODELE_COULEUR.test(couleurPropre)
  const noteLue = lireSeuil(seuilNote, SEUIL_NOTE_MIN, SEUIL_NOTE_MAX)
  const npsLu = lireSeuil(seuilNps, SEUIL_NPS_MIN, SEUIL_NPS_MAX)

  const couleurEnregistree = (parametres.couleur_principale ?? '').toLowerCase()
  const modifie =
    couleurPropre !== couleurEnregistree ||
    seuilNote.trim() !== String(parametres.seuil_alerte_note) ||
    seuilNps.trim() !== String(parametres.seuil_alerte_nps)

  const erreurCouleur = tentative && !couleurValide ? t('parametres.alertes.couleurInvalide') : null
  const erreurNote =
    tentative && noteLue === null
      ? t('parametres.alertes.seuilInvalide', { min: SEUIL_NOTE_MIN, max: SEUIL_NOTE_MAX })
      : null
  const erreurNps =
    tentative && npsLu === null
      ? t('parametres.alertes.seuilInvalide', { min: SEUIL_NPS_MIN, max: SEUIL_NPS_MAX })
      : null

  async function enregistrer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (!couleurValide || noteLue === null || npsLu === null || !modifie) {
      return
    }

    // Seuls les champs modifies partent ; une couleur vide efface la couleur (null).
    const corps: CorpsModificationParametres = {}
    if (couleurPropre !== couleurEnregistree) {
      corps.couleur_principale = couleurPropre === '' ? null : couleurPropre
    }
    if (noteLue !== parametres.seuil_alerte_note) {
      corps.seuil_alerte_note = noteLue
    }
    if (npsLu !== parametres.seuil_alerte_nps) {
      corps.seuil_alerte_nps = npsLu
    }

    const reussi = await etat.enregistrer(corps)
    if (reussi) {
      setTentative(false)
    }
  }

  function annuler(): void {
    setCouleur(parametres.couleur_principale ?? '')
    setSeuilNote(String(parametres.seuil_alerte_note))
    setSeuilNps(String(parametres.seuil_alerte_nps))
    setTentative(false)
  }

  // Le message de succes disparait des que la personne retouche un champ.
  const succesVisible = etat.succes && !modifie
  const selecteurValeur = MODELE_COULEUR.test(couleurPropre) ? couleurPropre : COULEUR_SELECTEUR_DEFAUT

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('parametres.alertes.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">{t('parametres.alertes.description')}</p>

      <form onSubmit={(evenement) => void enregistrer(evenement)} noValidate className="mt-4 flex flex-col gap-5">
        {/* Couleur principale */}
        <div className="flex flex-col gap-1">
          <label htmlFor={idCouleur} className="text-sm font-semibold text-texte">
            {t('parametres.alertes.couleur')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={idSelecteur}
              type="color"
              value={selecteurValeur}
              aria-label={t('parametres.alertes.couleur')}
              onChange={(evenement) => setCouleur(evenement.target.value)}
              className="h-11 w-11 cursor-pointer rounded-md border border-bordure-champ bg-fond p-1"
            />
            <input
              id={idCouleur}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              placeholder="#1d4ed8"
              value={couleur}
              aria-invalid={erreurCouleur !== null}
              aria-describedby={`${idCouleur}-aide`}
              onChange={(evenement) => setCouleur(evenement.target.value)}
              className="min-h-11 w-32 rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
            />
            {couleurPropre !== '' && (
              <button
                type="button"
                onClick={() => setCouleur('')}
                className="min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
              >
                {t('parametres.alertes.couleurEffacer')}
              </button>
            )}
          </div>
          <p id={`${idCouleur}-aide`} className="m-0 text-xs text-texte-secondaire">
            {couleurPropre === ''
              ? t('parametres.alertes.couleurDefaut')
              : t('parametres.alertes.couleurAide')}
          </p>
          {erreurCouleur !== null && (
            <p role="alert" className="m-0 text-xs text-erreur">
              {erreurCouleur}
            </p>
          )}
        </div>

        {/* Seuils d'alerte */}
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
          <ChampSeuil
            id={idSeuilNote}
            libelle={t('parametres.alertes.seuilNote')}
            aide={t('parametres.alertes.seuilNoteAide', { min: SEUIL_NOTE_MIN, max: SEUIL_NOTE_MAX })}
            valeur={seuilNote}
            min={SEUIL_NOTE_MIN}
            max={SEUIL_NOTE_MAX}
            erreur={erreurNote}
            surChangement={setSeuilNote}
          />
          <ChampSeuil
            id={idSeuilNps}
            libelle={t('parametres.alertes.seuilNps')}
            aide={t('parametres.alertes.seuilNpsAide', { min: SEUIL_NPS_MIN, max: SEUIL_NPS_MAX })}
            valeur={seuilNps}
            min={SEUIL_NPS_MIN}
            max={SEUIL_NPS_MAX}
            erreur={erreurNps}
            surChangement={setSeuilNps}
          />
        </div>

        {/* Ce qui est enregistre aujourd'hui */}
        <p className="m-0 rounded-md bg-fond-alt px-3 py-2 text-sm text-texte-secondaire">
          {t('parametres.alertes.resume', {
            note: parametres.seuil_alerte_note,
            nps: parametres.seuil_alerte_nps,
          })}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={etat.enCours || !modifie}
            aria-busy={etat.enCours}
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
          >
            {etat.enCours ? t('parametres.alertes.enregistrement') : t('parametres.alertes.enregistrer')}
          </button>
          {modifie && (
            <button
              type="button"
              disabled={etat.enCours}
              onClick={annuler}
              className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('parametres.alertes.annuler')}
            </button>
          )}
        </div>

        <p role="status" className="m-0 min-h-5 text-sm text-succes">
          {succesVisible ? t('parametres.alertes.succes') : ''}
        </p>
        {etat.erreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {etat.erreur.statut === 0 ? t('commun.erreurReseau') : t('parametres.alertes.erreur')}
          </p>
        )}
      </form>
    </section>
  )
}