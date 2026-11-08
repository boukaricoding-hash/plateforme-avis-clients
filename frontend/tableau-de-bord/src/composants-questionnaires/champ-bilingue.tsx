import { useId } from 'react'
import type { LangueTexte, TexteEdite } from '../hooks/utiliser-editeur-questionnaire'
import { utiliserLangue } from '../hooks/utiliser-langue'

// Champ de texte en deux langues de l'editeur de questionnaire (ecran E10, jour 19) :
// le francais (obligatoire) et l'anglais (facultatif), cote a cote, sous un meme libelle.
// Il sert pour le titre, les messages, le texte et l'aide d'une question, les options
// et les libelles des extremites d'une echelle.
// Ce composant n'appelle pas l'API et ne garde aucune saisie : le texte vient du brouillon
// du hook (valeur) et chaque frappe est renvoyee par onChange(langue, valeur).
// - multiligne : zone de texte de 3 lignes (messages, texte d'une question) au lieu d'une ligne.
// - invalide : le francais est signale en erreur (bordure rouge, champ marque invalide).
// - lectureSeule : champs verrouilles (aucune modification possible).
// Les textes sont limites a 500 caracteres, comme sur le serveur.

const LONGUEUR_MAX = 500
const LIGNES_ZONE = 3

type PropsChampBilingue = {
  // Libelle du champ, deja traduit par la page ou le composant parent.
  libelle: string
  valeur: TexteEdite
  onChange: (langue: LangueTexte, valeur: string) => void
  multiligne?: boolean
  invalide?: boolean
  lectureSeule?: boolean
}

type PropsSaisie = {
  id: string
  langue: LangueTexte
  etiquette: string
  valeur: string
  onChange: (langue: LangueTexte, valeur: string) => void
  multiligne: boolean
  invalide: boolean
  lectureSeule: boolean
  obligatoire: boolean
}

// Une saisie : son etiquette (Francais ou Anglais) et son champ
function Saisie({
  id,
  langue,
  etiquette,
  valeur,
  onChange,
  multiligne,
  invalide,
  lectureSeule,
  obligatoire,
}: PropsSaisie) {
  const classe = `champ-bilingue-saisie${invalide ? ' champ-bilingue-saisie--invalide' : ''}`

  return (
    <div className="champ-bilingue-colonne">
      <label className="champ-bilingue-langue" htmlFor={id}>
        <span className="champ-bilingue-code">{langue}</span>
        <span>{etiquette}</span>
      </label>
      {multiligne ? (
        <textarea
          id={id}
          className={classe}
          rows={LIGNES_ZONE}
          maxLength={LONGUEUR_MAX}
          value={valeur}
          readOnly={lectureSeule}
          required={obligatoire}
          aria-invalid={invalide}
          onChange={(e) => onChange(langue, e.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          className={classe}
          maxLength={LONGUEUR_MAX}
          value={valeur}
          readOnly={lectureSeule}
          required={obligatoire}
          aria-invalid={invalide}
          onChange={(e) => onChange(langue, e.target.value)}
        />
      )}
    </div>
  )
}

export function ChampBilingue({
  libelle,
  valeur,
  onChange,
  multiligne = false,
  invalide = false,
  lectureSeule = false,
}: PropsChampBilingue) {
  const { t } = utiliserLangue()
  const base = useId()

  return (
    <fieldset className="champ-bilingue">
      <legend className="champ-bilingue-libelle">{libelle}</legend>
      <div className="champ-bilingue-colonnes">
        <Saisie
          id={`${base}-fr`}
          langue="fr"
          etiquette={t('questionnaires.editeur.bilingue.francais')}
          valeur={valeur.fr}
          onChange={onChange}
          multiligne={multiligne}
          invalide={invalide}
          lectureSeule={lectureSeule}
          obligatoire
        />
        <Saisie
          id={`${base}-en`}
          langue="en"
          etiquette={t('questionnaires.editeur.bilingue.anglais')}
          valeur={valeur.en}
          onChange={onChange}
          multiligne={multiligne}
          invalide={false}
          lectureSeule={lectureSeule}
          obligatoire={false}
        />
      </div>
    </fieldset>
  )
}