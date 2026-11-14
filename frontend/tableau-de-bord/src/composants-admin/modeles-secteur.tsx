import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { QuestionnaireTypeSecteur, QuestionTypeSecteur } from '../types/admin'
import type { TexteMultilingue } from '../types/avis'
import type { Langue } from '../types/langue'

// Questionnaires types d'un secteur (ecran E18, jour 23), administrateur DTS seulement.
// Affichage en LECTURE SEULE : l'API du jour 22 ne permet pas de modifier un modele.
// Chaque modele montre son titre, son statut, sa derniere version, ses messages d'accueil et de
// remerciement, puis ses questions (type, obligatoire, theme, aide, options, echelle).
// Les questions se deplient avec un bloc natif details/summary (aucun etat a garder ici).
// Ce modele est copie en brouillon dans chaque nouvelle organisation du secteur.
// Un secteur sans modele n'est pas une erreur : on explique qu'une nouvelle organisation de ce
// secteur n'aura pas de questionnaire de depart.
// Ce composant n'appelle pas l'API : les donnees viennent de utiliserSecteursAdmin.
// La condition d'affichage d'une question n'est pas montree ici.

type Proprietes = {
  // null tant que les modeles ne sont pas charges ; liste vide = pas de modele.
  modeles: QuestionnaireTypeSecteur[] | null
  chargement: boolean
  erreur: ErreurService | null
  // Relance les chargements (bouton "Reessayer").
  surReessayer: () => void
}

const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

// Texte dans la langue de l'ecran ; sans traduction anglaise, on garde le francais.
function texteDansLangue(texte: TexteMultilingue | null, langue: Langue): string {
  if (texte === null) {
    return ''
  }
  if (langue === 'en') {
    const anglais = texte.en?.trim() ?? ''
    return anglais === '' ? texte.fr : anglais
  }
  return texte.fr
}

// ------------------------------------------------------------
// Une question d'un modele
// ------------------------------------------------------------

function ElementQuestion({ question }: { question: QuestionTypeSecteur }) {
  const { t, langue } = utiliserLangue()

  const libelle = texteDansLangue(question.libelle, langue)
  const aide = texteDansLangue(question.aide, langue)
  const theme =
    question.theme === null
      ? null
      : langue === 'en'
        ? question.theme.libelle_en
        : question.theme.libelle_fr
  const options = question.options?.map((option) => texteDansLangue(option, langue)) ?? []
  const aEchelle = question.echelle_min !== null && question.echelle_max !== null

  return (
    <li className="flex gap-3 rounded-md border border-bordure bg-surface p-3">
      <span
        aria-hidden="true"
        className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-accent-fond px-2 text-sm font-bold text-texte"
      >
        {question.ordre}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="break-words text-sm font-semibold text-texte">{libelle}</span>

        <span className="text-xs text-texte-secondaire">
          {t(`questionnaires.editeur.questions.types.${question.type}`)}
          {' · '}
          {question.obligatoire
            ? t('admin.secteurs.modeles.obligatoire')
            : t('admin.secteurs.modeles.facultative')}
          {theme !== null && ` · ${t('admin.secteurs.modeles.theme', { theme })}`}
        </span>

        {aide !== '' && (
          <span className="break-words text-xs text-texte-secondaire">
            {t('admin.secteurs.modeles.aideQuestion', { texte: aide })}
          </span>
        )}

        {aEchelle && (
          <span className="text-xs text-texte-secondaire">
            {t('admin.secteurs.modeles.echelle', {
              min: question.echelle_min ?? 0,
              max: question.echelle_max ?? 0,
            })}
            {question.libelles_extremites !== null &&
              ` (${texteDansLangue(question.libelles_extremites.min, langue)} → ${texteDansLangue(question.libelles_extremites.max, langue)})`}
          </span>
        )}

        {options.length > 0 && (
          <span className="break-words text-xs text-texte-secondaire">
            {t('admin.secteurs.modeles.options', { liste: options.join(' · ') })}
          </span>
        )}
      </div>
    </li>
  )
}

// ------------------------------------------------------------
// Un modele de questionnaire
// ------------------------------------------------------------

function CarteModele({ modele }: { modele: QuestionnaireTypeSecteur }) {
  const { t, langue } = utiliserLangue()

  const titre = texteDansLangue(modele.titre, langue)
  const accueil = texteDansLangue(modele.message_accueil, langue)
  const remerciement = texteDansLangue(modele.message_remerciement, langue)
  const langueDefaut = modele.langue_defaut === 'en' ? t('commun.anglais') : t('commun.francais')

  return (
    <article className="flex flex-col gap-3 rounded-md border border-bordure bg-surface-douce p-4">
      <div className="flex flex-col gap-1">
        <h4 className="m-0 break-words text-sm font-bold text-texte">{titre}</h4>
        <p className="m-0 text-xs text-texte-secondaire">
          {t(`questionnaires.statuts.${modele.statut}`)}
          {' · '}
          {modele.version === null
            ? t('admin.secteurs.modeles.aucuneVersion')
            : t('admin.secteurs.modeles.version', { numero: modele.version })}
          {' · '}
          {t('admin.secteurs.modeles.langueDefaut', { langue: langueDefaut })}
        </p>
      </div>

      {accueil !== '' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-texte">
            {t('admin.secteurs.modeles.messageAccueil')}
          </span>
          <p className="m-0 break-words text-sm text-texte-secondaire">{accueil}</p>
        </div>
      )}

      {remerciement !== '' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-texte">
            {t('admin.secteurs.modeles.messageRemerciement')}
          </span>
          <p className="m-0 break-words text-sm text-texte-secondaire">{remerciement}</p>
        </div>
      )}

      <details className="rounded-md border border-bordure bg-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-texte">
          {t('admin.secteurs.modeles.questions', { nombre: modele.questions.length })}
        </summary>
        {modele.questions.length === 0 ? (
          <p className="m-0 px-3 pb-3 text-sm text-texte-secondaire">
            {t('admin.secteurs.modeles.aucuneQuestion')}
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-3 pt-0">
            {modele.questions.map((question) => (
              <ElementQuestion key={question.id} question={question} />
            ))}
          </ol>
        )}
      </details>
    </article>
  )
}

// ------------------------------------------------------------
// Bloc des modeles du secteur
// ------------------------------------------------------------

export function ModelesSecteur({ modeles, chargement, erreur, surReessayer }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()

  // Le message d'echec : reseau, droits, secteur inconnu ou erreur generale.
  let messageErreur: string | null = null
  if (erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.statut === 403) {
      messageErreur = t('admin.secteurs.modeles.erreurs.droits')
    } else if (erreur.statut === 404) {
      messageErreur = t('admin.secteurs.modeles.erreurs.introuvable')
    } else {
      messageErreur = t('admin.secteurs.modeles.erreurs.generique')
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <div className="flex flex-col gap-1">
        <h3 id={idTitre} className="m-0 font-titre text-lg font-bold text-texte">
          {t('admin.secteurs.modeles.titre')}
        </h3>
        <p className="m-0 text-sm text-texte-secondaire">{t('admin.secteurs.modeles.aide')}</p>
      </div>

      {messageErreur !== null && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
          <button type="button" onClick={surReessayer} className={CLASSE_BOUTON_SECONDAIRE}>
            {t('commun.reessayer')}
          </button>
        </div>
      )}

      {messageErreur === null && chargement && modeles === null && (
        <p role="status" className="mb-0 mt-4 text-sm text-texte-secondaire">
          {t('commun.chargement')}
        </p>
      )}

      {messageErreur === null && modeles !== null && modeles.length === 0 && (
        <p className="mb-0 mt-4 text-sm text-texte-secondaire">
          {t('admin.secteurs.modeles.aucunModele')}
        </p>
      )}

      {messageErreur === null && modeles !== null && modeles.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {modeles.map((modele) => (
            <CarteModele key={modele.id} modele={modele} />
          ))}
        </div>
      )}
    </section>
  )
}