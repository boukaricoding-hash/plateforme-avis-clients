import { useId } from 'react'
import { NOMBRE_MAX_OPTIONS, NOMBRE_MIN_OPTIONS } from '../hooks/utiliser-editeur-questionnaire'
import type { ActionsEditeur, QuestionEditee } from '../hooks/utiliser-editeur-questionnaire'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ThemeSecteur } from '../types/questionnaires'
import type { TypeQuestion } from '../types/tableau-de-bord'
import { ChampBilingue } from './champ-bilingue'
import {
  IconeAjouter,
  IconeDescendre,
  IconeDupliquer,
  IconeMonter,
  IconeSupprimer,
  iconesParType,
} from './icones-questionnaires'

// Carte d'une question de l'editeur de questionnaire (ecran E10, jour 19).
// Elle montre tout ce qui se regle sur UNE question : type, texte et aide en deux langues,
// reponse obligatoire, theme, puis selon le type les options (choix unique ou multiple)
// ou l'echelle (valeurs minimale et maximale, libelles des extremites).
// En haut : le numero, l'icone du type et les boutons monter, descendre, dupliquer, supprimer.
// Ce composant n'appelle pas l'API et ne garde aucune saisie : la page lui donne la question
// du brouillon et les actions du hook utiliserEditeurQuestionnaire, qui font tout le travail.
// - limiteAtteinte : le questionnaire a deja 50 questions, dupliquer est desactive.
// - themes : themes du secteur ; null tant qu'ils ne sont pas charges (le choix du theme
//   n'apparait pas), erreurThemes : le chargement a echoue (un message le dit).

// Les 8 types, pris dans la table des icones pour n'en oublier aucun
const TYPES = Object.keys(iconesParType) as TypeQuestion[]

type PropsCarteQuestion = {
  question: QuestionEditee
  // Position de la question dans la liste (0 = la premiere)
  indice: number
  total: number
  limiteAtteinte: boolean
  themes: ThemeSecteur[] | null
  erreurThemes: boolean
  actions: ActionsEditeur
}

// Libelle d'un theme : anglais si la langue est l'anglais et qu'il est rempli, sinon francais
function libelleTheme(theme: ThemeSecteur, langue: string): string {
  if (langue === 'en' && theme.libelle_en.trim() !== '') {
    return theme.libelle_en
  }
  return theme.libelle_fr
}

export function CarteQuestion({
  question,
  indice,
  total,
  limiteAtteinte,
  themes,
  erreurThemes,
  actions,
}: PropsCarteQuestion) {
  const { t, langue } = utiliserLangue()
  const base = useId()

  const cle = question.cle
  const numero = indice + 1
  const valeursNumero = { numero }
  const IconeType = iconesParType[question.type]
  const aDesChoix = question.type === 'CHOIX_UNIQUE' || question.type === 'CHOIX_MULTIPLE'
  const estEchelle = question.type === 'ECHELLE'
  const peutAjouterOption = question.options.length < NOMBRE_MAX_OPTIONS
  const peutRetirerOption = question.options.length > NOMBRE_MIN_OPTIONS

  const libelleMonter = t('questionnaires.editeur.questions.monter', valeursNumero)
  const libelleDescendre = t('questionnaires.editeur.questions.descendre', valeursNumero)
  const libelleDupliquer = t('questionnaires.editeur.questions.dupliquer', valeursNumero)
  const libelleSupprimer = t('questionnaires.editeur.questions.supprimer', valeursNumero)

  return (
    <article className="carte-question">
      <header className="carte-question-entete">
        <span className="carte-question-icone">
          <IconeType />
        </span>
        <h3 className="carte-question-titre">
          {t('questionnaires.editeur.questions.numero', valeursNumero)}
        </h3>
        <div className="carte-question-actions">
          <button
            type="button"
            className="carte-question-action"
            aria-label={libelleMonter}
            title={libelleMonter}
            disabled={indice === 0}
            onClick={() => actions.deplacerQuestion(cle, -1)}
          >
            <IconeMonter />
          </button>
          <button
            type="button"
            className="carte-question-action"
            aria-label={libelleDescendre}
            title={libelleDescendre}
            disabled={indice === total - 1}
            onClick={() => actions.deplacerQuestion(cle, 1)}
          >
            <IconeDescendre />
          </button>
          <button
            type="button"
            className="carte-question-action"
            aria-label={libelleDupliquer}
            title={libelleDupliquer}
            disabled={limiteAtteinte}
            onClick={() => actions.dupliquerQuestion(cle)}
          >
            <IconeDupliquer />
          </button>
          <button
            type="button"
            className="carte-question-action carte-question-action--danger"
            aria-label={libelleSupprimer}
            title={libelleSupprimer}
            onClick={() => actions.supprimerQuestion(cle)}
          >
            <IconeSupprimer />
          </button>
        </div>
      </header>

      <div className="carte-question-corps">
        <div className="carte-question-champ">
          <label className="carte-question-etiquette" htmlFor={`${base}-type`}>
            {t('questionnaires.editeur.questions.type')}
          </label>
          <select
            id={`${base}-type`}
            className="carte-question-select"
            value={question.type}
            onChange={(e) => actions.changerType(cle, e.target.value as TypeQuestion)}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`questionnaires.editeur.questions.types.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <ChampBilingue
          libelle={t('questionnaires.editeur.questions.libelle')}
          valeur={question.libelle}
          onChange={(langueTexte, valeur) =>
            actions.modifierTexteQuestion(cle, 'libelle', langueTexte, valeur)
          }
          multiligne
        />

        <ChampBilingue
          libelle={t('questionnaires.editeur.questions.aide')}
          valeur={question.aide}
          onChange={(langueTexte, valeur) =>
            actions.modifierTexteQuestion(cle, 'aide', langueTexte, valeur)
          }
        />

        {aDesChoix && (
          <section className="carte-question-section">
            <h4 className="carte-question-section-titre">
              {t('questionnaires.editeur.questions.options.titre')}
            </h4>
            <p className="carte-question-section-aide">
              {t('questionnaires.editeur.questions.options.aide')}
            </p>
            <ul className="carte-question-options">
              {question.options.map((option, i) => {
                const libelleSupprimerOption = t(
                  'questionnaires.editeur.questions.options.supprimer',
                  { numero: i + 1 },
                )
                return (
                  <li key={option.cle} className="carte-question-option">
                    <div className="carte-question-option-champ">
                      <ChampBilingue
                        libelle={t('questionnaires.editeur.questions.options.option', {
                          numero: i + 1,
                        })}
                        valeur={option.texte}
                        onChange={(langueTexte, valeur) =>
                          actions.modifierOption(cle, option.cle, langueTexte, valeur)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="carte-question-action carte-question-action--danger"
                      aria-label={libelleSupprimerOption}
                      title={libelleSupprimerOption}
                      disabled={!peutRetirerOption}
                      onClick={() => actions.supprimerOption(cle, option.cle)}
                    >
                      <IconeSupprimer />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="carte-question-ajouter"
              disabled={!peutAjouterOption}
              onClick={() => actions.ajouterOption(cle)}
            >
              <IconeAjouter />
              <span>{t('questionnaires.editeur.questions.options.ajouter')}</span>
            </button>
          </section>
        )}

        {estEchelle && (
          <section className="carte-question-section">
            <div className="carte-question-echelle-valeurs">
              <div className="carte-question-champ">
                <label className="carte-question-etiquette" htmlFor={`${base}-minimum`}>
                  {t('questionnaires.editeur.questions.echelle.minimum')}
                </label>
                <input
                  id={`${base}-minimum`}
                  type="number"
                  step={1}
                  inputMode="numeric"
                  className="carte-question-nombre"
                  value={question.echelleMin}
                  onChange={(e) => actions.modifierQuestion(cle, { echelleMin: e.target.value })}
                />
              </div>
              <div className="carte-question-champ">
                <label className="carte-question-etiquette" htmlFor={`${base}-maximum`}>
                  {t('questionnaires.editeur.questions.echelle.maximum')}
                </label>
                <input
                  id={`${base}-maximum`}
                  type="number"
                  step={1}
                  inputMode="numeric"
                  className="carte-question-nombre"
                  value={question.echelleMax}
                  onChange={(e) => actions.modifierQuestion(cle, { echelleMax: e.target.value })}
                />
              </div>
            </div>
            <ChampBilingue
              libelle={t('questionnaires.editeur.questions.echelle.libelleMinimum')}
              valeur={question.extremiteMin}
              onChange={(langueTexte, valeur) =>
                actions.modifierTexteQuestion(cle, 'extremiteMin', langueTexte, valeur)
              }
            />
            <ChampBilingue
              libelle={t('questionnaires.editeur.questions.echelle.libelleMaximum')}
              valeur={question.extremiteMax}
              onChange={(langueTexte, valeur) =>
                actions.modifierTexteQuestion(cle, 'extremiteMax', langueTexte, valeur)
              }
            />
          </section>
        )}

        <div className="carte-question-ligne">
          <label className="carte-question-case">
            <input
              type="checkbox"
              checked={question.obligatoire}
              onChange={(e) => actions.modifierQuestion(cle, { obligatoire: e.target.checked })}
            />
            <span>{t('questionnaires.editeur.questions.obligatoire')}</span>
          </label>

          {themes !== null && (
            <div className="carte-question-champ">
              <label className="carte-question-etiquette" htmlFor={`${base}-theme`}>
                {t('questionnaires.editeur.questions.theme')}
              </label>
              <select
                id={`${base}-theme`}
                className="carte-question-select"
                value={question.themeId}
                onChange={(e) => actions.modifierQuestion(cle, { themeId: e.target.value })}
              >
                <option value="">{t('questionnaires.editeur.questions.aucunTheme')}</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {libelleTheme(theme, langue)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {erreurThemes && (
          <p className="carte-question-message">
            {t('questionnaires.editeur.questions.themesIndisponibles')}
          </p>
        )}
      </div>
    </article>
  )
}