import { useEffect, useState, useSyncExternalStore } from 'react'
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
// (page unique, jour 15 design). Version compacte de l'ecran E9.
// Ce composant n'appelle pas l'API : il affiche la fiche deja chargee.
// Les reponses sont dans l'ordre des questions. Une question sans valeur affiche "Pas de reponse".
// La valeur est toujours ecrite en texte (jamais seulement une couleur ou une icone).
//
// Ce qui ne rentre pas est raccourci :
// - le commentaire est limite a 3 lignes par le style (classe avis-commentaire) ;
// - chaque reponse tient sur une ligne de hauteur fixe (libelle, puis valeur coupee par "...") ;
// - en ecran fixe, on ne montre que les reponses qui tiennent dans le bloc, suivies de "+N".
//   En page normale (la page defile), toutes les reponses sont montrees.

type Proprietes = {
  fiche: FicheAvis
}

// Doit rester egale a la requete de l'ecran fixe dans styles/avis.css
const REQUETE_ECRAN_FIXE = '(min-width: 1100px) and (min-height: 640px)'
// Hauteur en pixels d'une reponse (libelle sur une ligne, valeur sur une ligne)
const HAUTEUR_REPONSE = 44
// Hauteur en pixels de la ligne "+N", reservee quand des reponses sont masquees
const HAUTEUR_PLUS = 24

// Valeur maximale d'une question a note (etoiles et emojis : 5, NPS : 10, echelle : echelle_max).
const MAXIMUM_ETOILES = 5
const MAXIMUM_EMOJIS = 5
const MAXIMUM_NPS = 10

function sAbonnerEcranFixe(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_ECRAN_FIXE)
  requete.addEventListener('change', rappel)
  return () => requete.removeEventListener('change', rappel)
}

function lireEcranFixe() {
  return window.matchMedia(REQUETE_ECRAN_FIXE).matches
}

// Combien de reponses montrer dans une zone de cette hauteur. Si elles tiennent toutes, toutes.
// Sinon on garde la place de la ligne "+N" et on ne montre que les reponses entieres qui restent.
function compterReponsesVisibles(hauteurZone: number, total: number): number {
  if (Math.floor(hauteurZone / HAUTEUR_REPONSE) >= total) {
    return total
  }
  return Math.max(0, Math.floor((hauteurZone - HAUTEUR_PLUS) / HAUTEUR_REPONSE))
}

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

// La valeur d'une reponse, ecrite selon le type de la question, sur une seule ligne.
// Un texte trop long est coupe par "..." ; le texte complet reste dans l'infobulle (title).
function ValeurReponse({ reponse }: PropsValeurReponse) {
  const { t, langue } = utiliserLangue()
  const { question } = reponse
  const sansReponse = (
    <span className="block truncate text-sm text-texte-discret">
      {t('avis.fiche.reponses.sansReponse')}
    </span>
  )

  if (question.type === 'TEXTE_LIBRE') {
    const texte = reponse.valeur_texte?.trim() ?? ''
    return texte === '' ? (
      sansReponse
    ) : (
      <span className="block truncate text-sm text-texte" title={texte}>
        {texte}
      </span>
    )
  }

  if (question.type === 'CHOIX_UNIQUE' || question.type === 'CHOIX_MULTIPLE') {
    const brut = reponse.valeur_choix
    const valeurs = brut === null ? [] : Array.isArray(brut) ? brut : [brut]
    if (valeurs.length === 0) {
      return sansReponse
    }
    const texte = valeurs.map((valeur) => texteChoix(valeur, question, langue)).join(', ')
    return (
      <span className="block truncate text-sm font-medium text-texte" title={texte}>
        {texte}
      </span>
    )
  }

  if (reponse.valeur_numerique === null) {
    return sansReponse
  }

  if (question.type === 'OUI_NON') {
    return (
      <span className="block truncate text-sm font-medium text-texte">
        {reponse.valeur_numerique === 1 ? t('avis.fiche.reponses.oui') : t('avis.fiche.reponses.non')}
      </span>
    )
  }

  const valeur = formaterNombre(reponse.valeur_numerique, langue)
  const maximum = maximumDeLaQuestion(question)
  return (
    <span className="block truncate text-sm font-medium text-texte">
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

// Bloc des reponses. En ecran fixe, il prend toute la hauteur qui reste dans sa colonne
// (flex-1), et sa zone de lignes est mesuree pour savoir combien de reponses tiennent.
function PanneauReponses({ reponses }: PropsPanneauReponses) {
  const { t, langue } = utiliserLangue()
  const ecranFixe = useSyncExternalStore(sAbonnerEcranFixe, lireEcranFixe)
  const [zone, setZone] = useState<HTMLDivElement | null>(null)
  const [hauteurZone, setHauteurZone] = useState<number | null>(null)

  // La mesure se refait quand la fenetre change de taille ou que le menu se replie ou se deplie.
  useEffect(() => {
    if (!ecranFixe || zone === null) {
      return
    }
    const observateur = new ResizeObserver(() => {
      setHauteurZone(zone.clientHeight)
    })
    observateur.observe(zone)
    return () => observateur.disconnect()
  }, [ecranFixe, zone])

  // Tant que la zone n'est pas mesuree (ou en page normale), toutes les reponses sont montrees.
  const nombreVisibles =
    ecranFixe && hauteurZone !== null
      ? compterReponsesVisibles(hauteurZone, reponses.length)
      : reponses.length
  const masquees = reponses.length - nombreVisibles

  return (
    <section
      aria-labelledby="titre-reponses-avis"
      className={`avis-panneau flex flex-col ${ecranFixe ? 'min-h-0 flex-1 basis-0' : ''}`}
    >
      <h3 id="titre-reponses-avis" className="avis-panneau-titre">
        <IconeReponses />
        {t('avis.fiche.reponses.titre')}
      </h3>
      {reponses.length === 0 ? (
        <p className="m-0 text-sm text-texte-discret">{t('avis.fiche.reponses.aucune')}</p>
      ) : (
        <div ref={setZone} className={ecranFixe ? 'min-h-0 flex-1 overflow-hidden' : ''}>
          <ol className="m-0 list-none p-0">
            {reponses.slice(0, nombreVisibles).map((reponse) => (
              <li
                key={reponse.id}
                className="flex flex-col justify-center overflow-hidden border-t border-bordure first:border-t-0"
                style={{ height: HAUTEUR_REPONSE }}
              >
                <span
                  className="block truncate text-xs text-texte-secondaire"
                  title={texteLangue(reponse.question.libelle, langue)}
                >
                  {texteLangue(reponse.question.libelle, langue)}
                </span>
                <ValeurReponse reponse={reponse} />
              </li>
            ))}
          </ol>
          {masquees > 0 && (
            <p
              className="m-0 flex items-center justify-end text-xs font-semibold text-texte-secondaire"
              style={{ height: HAUTEUR_PLUS }}
              title={t('avis.detail.autresReponses', { nombre: masquees })}
            >
              <span aria-hidden="true">+{masquees}</span>
              <span className="sr-only">{t('avis.detail.autresReponses', { nombre: masquees })}</span>
            </p>
          )}
        </div>
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
          <p className="avis-commentaire break-words" title={commentaire}>
            {commentaire}
          </p>
        )}
      </section>

      <PanneauReponses reponses={reponses} />
    </>
  )
}