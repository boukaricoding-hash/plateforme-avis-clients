import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserPages } from '../hooks/utiliser-pages'
import type { DetailQuestion, QuestionnaireFiltre } from '../types/tableau-de-bord'
import { formaterNombre } from '../utilitaires/periodes'
import { Pagination } from './pagination'

// Refonte de l'accueil : les questions sont coupees en pages (fleches, points, "Page 1 sur 3").
// Chaque question est une carte de hauteur fixe, deux par ligne ; le nombre de lignes par page se
// calcule d'apres la hauteur du panneau, pour que rien ne defile (au moins une ligne par page).
// Les valeurs numeriques (etoiles, echelle, NPS) sont dessinees en colonnes, les choix en barres.
const HAUTEUR_CARTE = 232
const ECART_CARTES = 12
// Cartes par ligne (deux colonnes des 1024 px de large, comme la classe lg:grid-cols-2)
const CARTES_PAR_LIGNE = 2
// Lignes par page quand la page n'est pas en ecran fixe
const LIGNES_PAR_DEFAUT = 3

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
}

// Plus grand ecart de valeurs pour lequel on complete les zeros manquants
const ECART_MAX_ECHELLE = 20

// Barres horizontales en HTML (choix, oui/non) : la largeur est en pourcentage du plus grand nombre.
// Les lignes se partagent la hauteur restante de la carte. Le chiffre est ecrit en texte,
// donc lisible au lecteur d'ecran.
function BarresRepartition({ lignes }: ProprietesBarres) {
  const maximum = Math.max(...lignes.map((ligne) => ligne.nombre))

  return (
    <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
      {lignes.map((ligne) => {
        const largeur =
          maximum > 0 && ligne.nombre > 0 ? Math.max((ligne.nombre / maximum) * 100, 2) : 0
        return (
          <li key={ligne.cle} className="flex max-h-6 min-h-0 flex-1 items-center gap-2 text-xs leading-none">
            <span className="w-2/5 min-w-0 shrink-0 truncate text-texte-secondaire" title={ligne.libelle}>
              {ligne.libelle}
            </span>
            <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-full bg-fond-alt">
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

// Colonnes en HTML (etoiles, emojis, echelle, NPS) : la hauteur est en pourcentage du plus grand nombre.
// Le nombre est au-dessus de la colonne, la valeur en dessous ; le texte pour les lecteurs d'ecran
// dit "valeur : nombre".
function ColonnesRepartition({ lignes }: ProprietesBarres) {
  const maximum = Math.max(...lignes.map((ligne) => ligne.nombre))

  return (
    <ul className="mt-2 flex min-h-0 flex-1 gap-1">
      {lignes.map((ligne) => {
        const hauteur =
          maximum > 0 && ligne.nombre > 0 ? Math.max((ligne.nombre / maximum) * 100, 3) : 0
        return (
          <li key={ligne.cle} className="flex min-w-0 flex-1 flex-col items-center text-xs leading-4">
            <span className="sr-only">
              {ligne.libelle} : {ligne.nombre}
            </span>
            <span aria-hidden="true" className="font-medium tabular-nums text-texte">
              {ligne.nombre}
            </span>
            <span aria-hidden="true" className="relative min-h-0 w-full flex-1">
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-sm bg-principale"
                style={{ height: `${hauteur}%` }}
              />
            </span>
            <span aria-hidden="true" className="text-texte-secondaire">
              {ligne.libelle}
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

  // Les questions sont rangees par lignes de deux cartes ; on affiche un nombre entier de lignes par page
  const lignesDeCartes: DetailQuestion[][] = []
  for (let debut = 0; debut < questions.length; debut += CARTES_PAR_LIGNE) {
    lignesDeCartes.push(questions.slice(debut, debut + CARTES_PAR_LIGNE))
  }
  // hauteurEnTete negatif : le dernier ecart n'existe pas, il y a un ecart de moins que de cartes
  const { refZone, elementsPage, pageCourante, nbPages, allerA } = utiliserPages(lignesDeCartes, {
    hauteurLigne: HAUTEUR_CARTE + ECART_CARTES,
    hauteurEnTete: -ECART_CARTES,
    lignesMin: 1,
    lignesParDefaut: LIGNES_PAR_DEFAUT,
  })

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
      className="accueil-remplir rounded-lg bg-surface/50 p-4"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.questions.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.questions.description')}</p>

      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.questions.aucune')}</p>
      ) : (
        <div ref={refZone} className="accueil-liste-zone">
          <ul className="grid gap-3 lg:grid-cols-2">
            {elementsPage.flat().map((question) => {
              const resume = resumer(question)
              const lignes = lignesDe(question)
              const estNumerique = TYPES_NUMERIQUES.includes(question.type)
              const titreQuestionnaire = plusieursQuestionnaires
                ? titresQuestionnaires.get(question.questionnaire_id)
                : undefined

              return (
                <li
                  key={`${question.questionnaire_id}|${question.type}|${question.libelle.fr}`}
                  className="flex h-[232px] flex-col overflow-hidden rounded-md bg-fond-alt/50 p-3"
                >
                  {titreQuestionnaire ? (
                    <p className="truncate text-xs text-texte-discret">{titreQuestionnaire}</p>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 min-w-0 text-sm font-medium text-texte" title={libelleDe(question)}>
                      {libelleDe(question)}
                    </h3>
                    {resume !== null ? (
                      <p className="shrink-0 font-titre text-base font-bold leading-5 text-texte">{resume}</p>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-texte-secondaire">
                    {t(`tableau.questions.types.${question.type}`)} ·{' '}
                    {t('tableau.questions.reponses', { nombre: question.nb_reponses })}
                  </p>
                  {question.type === 'TEXTE_LIBRE' ? (
                    <p className="mt-2 text-sm text-texte-secondaire">
                      {t('tableau.questions.texteLibre')}
                    </p>
                  ) : null}
                  {lignes.length > 0 ? (
                    estNumerique ? (
                      <ColonnesRepartition lignes={lignes} />
                    ) : (
                      <BarresRepartition lignes={lignes} />
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Pagination pageCourante={pageCourante} nbPages={nbPages} onAller={allerA} />
    </section>
  )
}