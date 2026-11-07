import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionMasse } from '../hooks/utiliser-sites-points'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire } from '../types/questionnaires'
import {
  MAX_POINTS_EN_MASSE,
  TYPES_POINT_CONTACT,
  type CorpsCreationMasse,
} from '../types/sites-points'

// Creation en masse de points de contact pour le site choisi (ecran E12, jour 17),
// Responsable seulement : "Table 1" a "Table 40" en un clic.
// - prefixe, type, premier et dernier numero (500 points au plus a la fois) ;
// - questionnaire facultatif, applique a tous les points crees ;
// - un nom qui existe deja est ignore (pas de doublon) : le message dit combien.
// Ce composant n'appelle pas l'API : la creation vient de utiliserSitesPoints, qui recharge
// ensuite la liste des points. Ici on garde ce que la personne tape et on verifie avant l'envoi.
// La page met key={siteId} pour repartir de zero quand on change de site.

type Proprietes = {
  siteId: string
  // null tant que les questionnaires ne sont pas charges.
  questionnaires: ResumeQuestionnaire[] | null
  masse: ActionMasse
}

// Longueur maximale du prefixe reprise du backend ; le serveur refait toujours la verification.
const LONGUEUR_PREFIXE = 60
const PREFIXE_DEFAUT = 'Table'

// Titre dans la langue choisie, sinon en francais (l'anglais est facultatif).
function titreDans(titre: TexteMultilingue, langue: string): string {
  return (langue === 'en' ? titre.en : null) ?? titre.fr
}

// Numero saisi : un entier d'au moins 1, sinon null.
function lireNumero(texte: string): number | null {
  const propre = texte.trim()
  if (!/^\d+$/.test(propre)) {
    return null
  }
  const valeur = Number(propre)
  return valeur >= 1 ? valeur : null
}

type ProprietesChampNumero = {
  id: string
  libelle: string
  valeur: string
  erreur: string | null
  surChangement: (valeur: string) => void
}

// Un champ numerique : libelle, saisie, message d'erreur eventuel.
function ChampNumero({ id, libelle, valeur, erreur, surChangement }: ProprietesChampNumero) {
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
        min={1}
        step={1}
        value={valeur}
        aria-invalid={erreur !== null}
        aria-describedby={erreur !== null ? idErreur : undefined}
        onChange={(evenement) => surChangement(evenement.target.value)}
        className="min-h-11 w-28 rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
      />
      {erreur !== null && (
        <p id={idErreur} role="alert" className="m-0 max-w-56 text-xs text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

export function CreationMasse({ siteId, questionnaires, masse }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const idPrefixe = useId()
  const idType = useId()
  const idDebut = useId()
  const idFin = useId()
  const idQuestionnaire = useId()

  // Ce que la personne tape.
  const [prefixe, setPrefixe] = useState(PREFIXE_DEFAUT)
  const [type, setType] = useState<string>(TYPES_POINT_CONTACT[0])
  const [debut, setDebut] = useState('1')
  const [fin, setFin] = useState('')
  const [questionnaireId, setQuestionnaireId] = useState('')
  // Les messages d'erreur de saisie apparaissent apres le premier essai.
  const [tentative, setTentative] = useState(false)
  // Le message "X crees" disparait des que la personne retouche un champ.
  const [edite, setEdite] = useState(false)

  const prefixePropre = prefixe.trim()
  const debutLu = lireNumero(debut)
  const finLue = lireNumero(fin)
  const nombre = debutLu !== null && finLue !== null ? finLue - debutLu + 1 : null

  let erreurPrefixe: string | null = null
  if (tentative && prefixePropre === '') {
    erreurPrefixe = t('sites.masse.prefixeObligatoire')
  }
  const erreurDebut = tentative && debutLu === null ? t('sites.masse.numeroInvalide') : null
  let erreurFin: string | null = null
  if (tentative) {
    if (finLue === null) {
      erreurFin = t('sites.masse.numeroInvalide')
    } else if (debutLu !== null && finLue < debutLu) {
      erreurFin = t('sites.masse.finAvantDebut')
    } else if (nombre !== null && nombre > MAX_POINTS_EN_MASSE) {
      erreurFin = t('sites.masse.tropDePoints', { max: MAX_POINTS_EN_MASSE })
    }
  }

  const saisieValide =
    prefixePropre !== '' &&
    debutLu !== null &&
    finLue !== null &&
    finLue >= debutLu &&
    finLue - debutLu + 1 <= MAX_POINTS_EN_MASSE

  function modifier<T>(changer: (valeur: T) => void): (valeur: T) => void {
    return (valeur) => {
      setEdite(true)
      changer(valeur)
    }
  }

  async function creer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (!saisieValide || debutLu === null || finLue === null) {
      return
    }

    const corps: CorpsCreationMasse = {
      site_id: siteId,
      prefixe: prefixePropre,
      type,
      debut: debutLu,
      fin: finLue,
    }
    if (questionnaireId !== '') {
      corps.questionnaire_id = questionnaireId
    }

    setEdite(false)
    const reussi = await masse.creer(corps)
    if (reussi) {
      setTentative(false)
    }
  }

  // Message d'echec de la creation (visible apres un essai dans CE formulaire).
  let messageErreur: string | null = null
  if (masse.erreur !== null) {
    if (masse.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (masse.erreur.statut === 403) {
      messageErreur = t('sites.masse.erreurDroits')
    } else if (masse.erreur.statut === 404) {
      messageErreur = t('sites.masse.erreurIntrouvable')
    } else {
      messageErreur = t('sites.masse.erreur')
    }
  }

  const resultatVisible = masse.resultat !== null && !edite
  const liste = questionnaires ?? []

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('sites.masse.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">
        {t('sites.masse.description', { max: MAX_POINTS_EN_MASSE })}
      </p>

      <form onSubmit={(evenement) => void creer(evenement)} noValidate className="mt-4 flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-col gap-1">
            <label htmlFor={idPrefixe} className="text-sm font-semibold text-texte">
              {t('sites.masse.prefixe')}
            </label>
            <input
              id={idPrefixe}
              type="text"
              autoComplete="off"
              maxLength={LONGUEUR_PREFIXE}
              value={prefixe}
              aria-invalid={erreurPrefixe !== null}
              onChange={(evenement) => modifier(setPrefixe)(evenement.target.value)}
              className="min-h-11 w-44 rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
            />
            {erreurPrefixe !== null && (
              <p role="alert" className="m-0 max-w-56 text-xs text-erreur">
                {erreurPrefixe}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idType} className="text-sm font-semibold text-texte">
              {t('sites.masse.type')}
            </label>
            <select
              id={idType}
              value={type}
              onChange={(evenement) => modifier(setType)(evenement.target.value)}
              className="min-h-11 w-40 rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte"
            >
              {TYPES_POINT_CONTACT.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {t(`sites.types.${valeur}`)}
                </option>
              ))}
            </select>
          </div>

          <ChampNumero
            id={idDebut}
            libelle={t('sites.masse.debut')}
            valeur={debut}
            erreur={erreurDebut}
            surChangement={modifier(setDebut)}
          />
          <ChampNumero
            id={idFin}
            libelle={t('sites.masse.fin')}
            valeur={fin}
            erreur={erreurFin}
            surChangement={modifier(setFin)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idQuestionnaire} className="text-sm font-semibold text-texte">
            {t('sites.masse.questionnaire')}
          </label>
          <select
            id={idQuestionnaire}
            value={questionnaireId}
            disabled={questionnaires === null}
            onChange={(evenement) => modifier(setQuestionnaireId)(evenement.target.value)}
            className="min-h-11 w-full max-w-sm rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{t('sites.masse.aucunQuestionnaire')}</option>
            {liste.map((questionnaire) => (
              <option key={questionnaire.id} value={questionnaire.id}>
                {titreDans(questionnaire.titre, langue)}
              </option>
            ))}
          </select>
          <p className="m-0 text-xs text-texte-secondaire">{t('sites.masse.questionnaireAide')}</p>
        </div>

        {saisieValide && nombre !== null && debutLu !== null && finLue !== null && (
          <p className="m-0 rounded-md bg-fond-alt px-3 py-2 text-sm text-texte-secondaire">
            {t('sites.masse.apercu', {
              nombre,
              premier: `${prefixePropre} ${debutLu}`,
              dernier: `${prefixePropre} ${finLue}`,
            })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={masse.enCours}
            aria-busy={masse.enCours}
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
          >
            {masse.enCours ? t('sites.masse.creation') : t('sites.masse.creer')}
          </button>
        </div>

        <p role="status" className="m-0 min-h-5 text-sm text-succes">
          {resultatVisible && masse.resultat !== null
            ? t('sites.masse.resultat', {
                crees: masse.resultat.crees,
                existants: masse.resultat.deja_existants,
              })
            : ''}
        </p>
        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
      </form>
    </section>
  )
}