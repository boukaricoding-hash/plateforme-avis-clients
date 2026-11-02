import { utiliserLangue } from '../hooks/utiliser-langue'
import type {
  FicheAvis,
  OptionQuestion,
  QuestionFiche,
  ReponseFiche,
  TexteMultilingue,
} from '../types/avis'
import { formaterNombre } from '../utilitaires/periodes'
import { IconeCommentaire, IconeReponses } from './icones-avis'

// Bloc "Commentaire du client" et bloc "Reponses au questionnaire" du detail d'un avis
// (page unique, jour 15 design).
// Ce composant n'appelle pas l'API : il affiche la fiche deja chargee.
// Les reponses sont dans l'ordre des questions. Une question sans valeur affiche "Pas de reponse".
// La valeur est toujours ecrite en texte (jamais seulement une couleur ou une icone).
//
// Rien n'est coupe : le commentaire et toutes les reponses sont montres en entier.
// Quand le contenu depasse la hauteur du panneau, c'est le panneau qui defile
// (regles .avis-panneau de styles/avis.css, en ecran fixe).

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
// Un texte long passe a la ligne (rien n'est coupe).
function ValeurReponse({ reponse }: PropsValeurReponse) {
  const { t, langue } = utiliserLangue()
  const { question } = reponse
  const sansReponse = (
    <span className="block break-words text-sm text-texte-discret">
      {t('avis.fiche.reponses.sansReponse')}
    </span>
  )

  if (question.type === 'TEXTE_LIBRE') {
    const texte = reponse.valeur_texte?.trim() ?? ''
    return texte === '' ? (
      sansReponse
    ) : (
      <span className="block break-words text-sm text-texte">{texte}</span>
    )
  }

  if (question.type === 'CHOIX_UNIQUE' || question.type === 'CHOIX_MULTIPLE') {
    const brut = reponse.valeur_choix
    const valeurs = brut === null ? [] : Array.isArray(brut) ? brut : [brut]
    if (valeurs.length === 0) {
      return sansReponse
    }
    const texte = valeurs.map((valeur) => texteChoix(valeur, question, langue)).join(', ')
    return <span className="block break-words text-sm font-medium text-texte">{texte}</span>
  }

  if (reponse.valeur_numerique === null) {
    return sansReponse
  }

  if (question.type === 'OUI_NON') {
    return (
      <span className="block break-words text-sm font-medium text-texte">
        {reponse.valeur_numerique === 1 ? t('avis.fiche.reponses.oui') : t('avis.fiche.reponses.non')}
      </span>
    )
  }

  const valeur = formaterNombre(reponse.valeur_numerique, langue)
  const maximum = maximumDeLaQuestion(question)
  return (
    <span className="block break-words text-sm font-medium text-texte">
      {maximum === null
        ? valeur
        : t('avis.fiche.reponses.valeurSur', { valeur, max: formaterNombre(maximum, langue) })}
    </span>
  )
}

type PropsPanneauReponses = {
  // Deja dans l'ordre des questions
  reponses: ReponseFiche[]
}

// Bloc des reponses : toutes les lignes, l'une sous l'autre. Le defilement est gere par le panneau.
function PanneauReponses({ reponses }: PropsPanneauReponses) {
  const { t, langue } = utiliserLangue()

  return (
    <section aria-labelledby="titre-reponses-avis" className="avis-panneau">
      <h3 id="titre-reponses-avis" className="avis-panneau-titre">
        <IconeReponses />
        {t('avis.fiche.reponses.titre')}
      </h3>
      {reponses.length === 0 ? (
        <p className="m-0 text-sm text-texte-discret">{t('avis.fiche.reponses.aucune')}</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {reponses.map((reponse) => (
            <li
              key={reponse.id}
              className="flex flex-col justify-center border-t border-bordure py-1.5 first:border-t-0 first:pt-0"
            >
              <span className="block break-words text-xs text-texte-secondaire">
                {texteLangue(reponse.question.libelle, langue)}
              </span>
              <ValeurReponse reponse={reponse} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function ReponsesAvis({ fiche }: Proprietes) {
  const { t } = utiliserLangue()

  const commentaire = fiche.commentaire?.trim() ?? ''
  const reponses = [...fiche.reponses].sort((a, b) => a.question.ordre - b.question.ordre)

  return (
    <>
      <section aria-labelledby="titre-commentaire-avis" className="avis-panneau">
        <h3 id="titre-commentaire-avis" className="avis-panneau-titre">
          <IconeCommentaire />
          {t('avis.fiche.commentaire.titre')}
        </h3>
        {commentaire === '' ? (
          <p className="m-0 text-sm text-texte-discret">{t('avis.fiche.commentaire.aucun')}</p>
        ) : (
          <p className="avis-commentaire">{commentaire}</p>
        )}
      </section>

      <PanneauReponses reponses={reponses} />
    </>
  )
}