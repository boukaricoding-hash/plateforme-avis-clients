import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { DetailQuestion, QuestionnaireFiltre } from '../types/tableau-de-bord'
import { formaterNombre } from '../utilitaires/periodes'

type Proprietes = {
  questions: DetailQuestion[]
  questionnaires: QuestionnaireFiltre[]
}

type LigneBarre = {
  cle: string
  libelle: string
  nombre: number
}

type ProprietesBarres = {
  lignes: LigneBarre[]
  // true = libelle court (un chiffre), false = libelle long (texte d'un choix)
  etroit: boolean
}

// Plus grand ecart de valeurs pour lequel on complete les zeros manquants
const ECART_MAX_ECHELLE = 20

// Barres simples en HTML : la largeur est en pourcentage du plus grand nombre.
// Le chiffre est ecrit en texte, donc lisible au lecteur d'ecran.
function BarresRepartition({ lignes, etroit }: ProprietesBarres) {
  const maximum = Math.max(...lignes.map((ligne) => ligne.nombre))

  return (
    <ul className="mt-3 space-y-1.5">
      {lignes.map((ligne) => {
        const largeur =
          maximum > 0 && ligne.nombre > 0 ? Math.max((ligne.nombre / maximum) * 100, 2) : 0
        return (
          <li key={ligne.cle} className="flex items-center gap-2 text-sm">
            <span
              className={
                etroit
                  ? 'w-8 shrink-0 text-texte-secondaire'
                  : 'w-2/5 min-w-0 shrink-0 break-words text-texte-secondaire'
              }
            >
              {ligne.libelle}
            </span>
            <span aria-hidden="true" className="h-3 flex-1 overflow-hidden rounded-full bg-fond-alt">
              <span className="block h-full rounded-full bg-principale" style={{ width: `${largeur}%` }} />
            </span>
            <span className="w-10 shrink-0 text-right font-medium tabular-nums text-texte">
              {ligne.nombre}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Complete les valeurs sans reponse (l'API n'envoie que les valeurs obtenues)
function lignesNumeriques(question: DetailQuestion): LigneBarre[] {
  const parValeur = new Map<number, number>()
  for (const element of question.repartition) {
    parValeur.set(Number(element.valeur), element.nombre)
  }
  if (parValeur.size === 0) {
    return []
  }

  const presentes = [...parValeur.keys()].sort((a, b) => a - b)
  const estNps = question.type === 'NPS'
  const debut = Math.min(estNps ? 0 : (question.echelle_min ?? 1), ...presentes)
  const fin = Math.max(estNps ? 10 : (question.echelle_max ?? 5), ...presentes)

  if (!Number.isInteger(debut) || !Number.isInteger(fin) || fin - debut > ECART_MAX_ECHELLE) {
    return presentes.map((valeur) => ({
      cle: String(valeur),
      libelle: String(valeur),
      nombre: parValeur.get(valeur) ?? 0,
    }))
  }

  const lignes: LigneBarre[] = []
  for (let valeur = debut; valeur <= fin; valeur += 1) {
    lignes.push({
      cle: String(valeur),
      libelle: String(valeur),
      nombre: parValeur.get(valeur) ?? 0,
    })
  }
  return lignes
}

const TYPES_NUMERIQUES = ['ETOILES', 'EMOJIS', 'ECHELLE', 'NPS']

export function DetailQuestions({ questions, questionnaires }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

  const titresQuestionnaires = new Map(
    questionnaires.map(
      (questionnaire) =>
        [
          questionnaire.id,
          langue === 'en'
            ? questionnaire.titre.en || questionnaire.titre.fr
            : questionnaire.titre.fr,
        ] as const,
    ),
  )
  const plusieursQuestionnaires =
    new Set(questions.map((question) => question.questionnaire_id)).size > 1

  function libelleDe(question: DetailQuestion): string {
    return langue === 'en' ? question.libelle.en || question.libelle.fr : question.libelle.fr
  }

  // Le chiffre cle de la question (moyenne, NPS ou pourcentage de oui)
  function resumer(question: DetailQuestion): string | null {
    if (question.type === 'NPS') {
      if (question.nps === null) {
        return null
      }
      return t('tableau.questions.nps', { valeur: formaterNombre(question.nps, langue) })
    }
    if (question.type === 'OUI_NON') {
      if (question.pourcentage_oui === null) {
        return null
      }
      return t('tableau.questions.pourcentageOui', {
        valeur: formaterNombre(question.pourcentage_oui, langue),
      })
    }
    if (question.type === 'ETOILES' || question.type === 'ECHELLE' || question.type === 'EMOJIS') {
      if (question.moyenne === null) {
        return null
      }
      const valeur = formaterNombre(question.moyenne, langue, { decimales: 2 })
      if (question.type === 'EMOJIS' && question.echelle_max === null) {
        return t('tableau.questions.moyenne', { valeur })
      }
      return t('tableau.questions.moyenneSur', { valeur, max: question.echelle_max ?? 5 })
    }
    return null
  }

  function lignesDe(question: DetailQuestion): LigneBarre[] {
    if (TYPES_NUMERIQUES.includes(question.type)) {
      return lignesNumeriques(question)
    }
    if (question.type === 'OUI_NON') {
      return question.repartition.map((element) => ({
        cle: String(element.valeur),
        libelle: element.valeur === 'oui' ? t('tableau.questions.oui') : t('tableau.questions.non'),
        nombre: element.nombre,
      }))
    }
    if (question.type === 'CHOIX_UNIQUE' || question.type === 'CHOIX_MULTIPLE') {
      return question.repartition.map((element) => ({
        cle: String(element.valeur),
        libelle: String(element.valeur),
        nombre: element.nombre,
      }))
    }
    return []
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.questions.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.questions.description')}</p>

      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.questions.aucune')}</p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {questions.map((question) => {
            const resume = resumer(question)
            const lignes = lignesDe(question)
            const titreQuestionnaire = plusieursQuestionnaires
              ? titresQuestionnaires.get(question.questionnaire_id)
              : undefined

            return (
              <li
                key={`${question.questionnaire_id}|${question.type}|${question.libelle.fr}`}
                className="rounded-md border border-bordure bg-fond p-3"
              >
                {titreQuestionnaire ? (
                  <p className="text-xs text-texte-discret">{titreQuestionnaire}</p>
                ) : null}
                <h3 className="text-sm font-medium text-texte">{libelleDe(question)}</h3>
                <p className="mt-1 text-xs text-texte-secondaire">
                  {t(`tableau.questions.types.${question.type}`)} ·{' '}
                  {t('tableau.questions.reponses', { nombre: question.nb_reponses })}
                </p>
                {resume !== null ? (
                  <p className="mt-2 font-titre text-base font-bold text-texte">{resume}</p>
                ) : null}
                {question.type === 'TEXTE_LIBRE' ? (
                  <p className="mt-2 text-sm text-texte-secondaire">
                    {t('tableau.questions.texteLibre')}
                  </p>
                ) : null}
                {lignes.length > 0 ? (
                  <BarresRepartition
                    lignes={lignes}
                    etroit={TYPES_NUMERIQUES.includes(question.type)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}