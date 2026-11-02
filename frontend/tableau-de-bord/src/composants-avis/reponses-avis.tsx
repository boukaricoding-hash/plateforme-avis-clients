import { utiliserLangue } from '../hooks/utiliser-langue'
import type {
  FicheAvis,
  OptionQuestion,
  QuestionFiche,
  ReponseFiche,
  TexteMultilingue,
} from '../types/avis'
import { formaterNombre } from '../utilitaires/periodes'

// Bloc "Commentaire du client" et bloc "Reponses au questionnaire" de la fiche d'un avis (E9).
// Ce composant n'appelle pas l'API : il affiche la fiche deja chargee.
// Les reponses sont dans l'ordre des questions. Une question sans valeur affiche "Pas de reponse".
// La valeur est toujours ecrite en texte (jamais seulement une couleur ou une icone).

type Proprietes = {
  fiche: FicheAvis
}

// Valeur maximale d'une question a note (etoiles et emojis : 5, NPS : 10, echelle : echelle_max).
const MAXIMUM_ETOILES = 5
const MAXIMUM_EMOJIS = 5
const MAXIMUM_NPS = 10

// Texte d'un libelle selon la langue : anglais si demande et rempli, sinon francais.
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

// Valeur enregistree pour une option : valeur, sinon code, sinon id, sinon fr.
// Meme regle que le backend et la page d'avis du client.
function valeurOption(option: OptionQuestion): string {
  if (typeof option === 'string') {
    return option
  }
  for (const valeur of [option.valeur, option.code, option.id, option.fr]) {
    if (typeof valeur === 'string') {
      return valeur
    }
  }
  return ''
}

// Texte d'une option selon la langue. Anglais absent ou vide : francais, puis la valeur.
function libelleOption(option: OptionQuestion, langue: string): string {
  if (typeof option === 'string') {
    return option
  }
  if (langue === 'en' && option.en !== undefined && option.en.trim() !== '') {
    return option.en
  }
  if (option.fr !== undefined && option.fr.trim() !== '') {
    return option.fr
  }
  return valeurOption(option)
}

// Texte d'un choix enregistre : on retrouve l'option par sa valeur pour l'ecrire dans la langue
// du responsable. Option supprimee depuis (ancienne version) : on affiche la valeur telle quelle.
function texteChoix(valeur: string, question: QuestionFiche, langue: string): string {
  const option = (question.options ?? []).find((element) => valeurOption(element) === valeur)
  return option === undefined ? valeur : libelleOption(option, langue)
}

// Maximum a afficher apres "sur", ou null quand la question n'a pas de maximum connu.
function maximumDeLaQuestion(question: QuestionFiche): number | null {
  switch (question.type) {
    case 'ETOILES':
      return MAXIMUM_ETOILES
    case 'EMOJIS':
      return MAXIMUM_EMOJIS
    case 'NPS':
      return MAXIMUM_NPS
    case 'ECHELLE':
      return question.echelle_max
    default:
      return null
  }
}

type PropsValeurReponse = {
  reponse: ReponseFiche
}

// La valeur d'une reponse, ecrite selon le type de la question.
function ValeurReponse({ reponse }: PropsValeurReponse) {
  const { t, langue } = utiliserLangue()
  const { question } = reponse
  const sansReponse = <span className="text-texte-discret">{t('avis.fiche.reponses.sansReponse')}</span>

  if (question.type === 'TEXTE_LIBRE') {
    const texte = reponse.valeur_texte?.trim() ?? ''
    return texte === '' ? (
      sansReponse
    ) : (
      <p className="whitespace-pre-wrap break-words text-texte">{texte}</p>
    )
  }

  if (question.type === 'CHOIX_UNIQUE' || question.type === 'CHOIX_MULTIPLE') {
    const brut = reponse.valeur_choix
    const valeurs = brut === null ? [] : Array.isArray(brut) ? brut : [brut]
    if (valeurs.length === 0) {
      return sansReponse
    }
    return (
      <ul className="flex flex-wrap gap-1.5">
        {valeurs.map((valeur) => (
          <li
            key={valeur}
            className="rounded-full border border-bordure-champ bg-surface px-2.5 py-0.5 text-sm text-texte"
          >
            {texteChoix(valeur, question, langue)}
          </li>
        ))}
      </ul>
    )
  }

  if (reponse.valeur_numerique === null) {
    return sansReponse
  }

  if (question.type === 'OUI_NON') {
    return (
      <span className="font-medium text-texte">
        {reponse.valeur_numerique === 1 ? t('avis.fiche.reponses.oui') : t('avis.fiche.reponses.non')}
      </span>
    )
  }

  const valeur = formaterNombre(reponse.valeur_numerique, langue)
  const maximum = maximumDeLaQuestion(question)
  return (
    <span className="font-medium text-texte">
      {maximum === null
        ? valeur
        : t('avis.fiche.reponses.valeurSur', { valeur, max: formaterNombre(maximum, langue) })}
    </span>
  )
}

// Libelles des deux extremites d'une echelle (ex. "Pas du tout" et "Tout a fait"), s'ils existent.
function extremitesEchelle(question: QuestionFiche, langue: string): string | null {
  if (question.type !== 'ECHELLE' || question.libelles_extremites === null) {
    return null
  }
  const min = texteLangue(question.libelles_extremites.min, langue).trim()
  const max = texteLangue(question.libelles_extremites.max, langue).trim()
  if (min === '' && max === '') {
    return null
  }
  return `${min} – ${max}`
}

export function ReponsesAvis({ fiche }: Proprietes) {
  const { t, langue } = utiliserLangue()

  const commentaire = fiche.commentaire?.trim() ?? ''
  const reponses = [...fiche.reponses].sort((a, b) => a.question.ordre - b.question.ordre)

  return (
    <>
      <section aria-labelledby="titre-commentaire-avis" className="rounded-xl border border-bordure bg-surface p-4">
        <h2 id="titre-commentaire-avis" className="font-titre text-lg font-bold text-texte">
          {t('avis.fiche.commentaire.titre')}
        </h2>
        {commentaire === '' ? (
          <p className="mt-2 text-sm text-texte-discret">{t('avis.fiche.commentaire.aucun')}</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-texte">{commentaire}</p>
        )}
      </section>

      <section aria-labelledby="titre-reponses-avis" className="rounded-xl border border-bordure bg-surface p-4">
        <h2 id="titre-reponses-avis" className="font-titre text-lg font-bold text-texte">
          {t('avis.fiche.reponses.titre')}
        </h2>
        {reponses.length === 0 ? (
          <p className="mt-2 text-sm text-texte-discret">{t('avis.fiche.reponses.aucune')}</p>
        ) : (
          <ol className="mt-3 divide-y divide-bordure">
            {reponses.map((reponse) => {
              const extremites = extremitesEchelle(reponse.question, langue)
              return (
                <li key={reponse.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-texte-secondaire">
                    {texteLangue(reponse.question.libelle, langue)}
                  </p>
                  {extremites !== null && <p className="text-xs text-texte-discret">{extremites}</p>}
                  <div className="mt-1">
                    <ValeurReponse reponse={reponse} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </>
  )
}