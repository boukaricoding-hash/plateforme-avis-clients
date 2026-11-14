import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { CorpsCreationTheme, CorpsModificationTheme, ThemeAdmin } from '../types/admin'

// Liste des themes d'un secteur (ecran E18, jour 23), administrateur DTS seulement.
// Elle montre les themes dans l'ordre (le serveur les trie deja) et permet :
// - d'ajouter un theme : code, libelles francais et anglais, ordre (facultatif : en dernier) ;
// - de modifier un theme : libelles et ordre. Le code d'un theme ne change jamais.
// Un seul formulaire est ouvert a la fois : celui de l'ajout, ou celui d'un theme.
// Ce composant n'appelle pas l'API : les envois viennent de utiliserSecteursAdmin.
// Les actions du hook sont communes au secteur et a ses themes : une erreur n'est donc montree
// qu'apres un envoi fait depuis un formulaire de cette liste.
// Apres un envoi reussi, le hook recharge la fiche du secteur : la liste se met a jour toute seule.

type Proprietes = {
  // Themes du secteur, dans l'ordre.
  themes: ThemeAdmin[]
  // Vrai pendant l'envoi : les boutons sont bloques.
  enCours: boolean
  erreur: ErreurService | null
  // Renvoie true si le theme est cree.
  surCreer: (corps: CorpsCreationTheme) => Promise<boolean>
  // Renvoie true si le theme est modifie.
  surModifier: (themeId: string, corps: CorpsModificationTheme) => Promise<boolean>
  // Efface le succes et l'erreur (a l'ouverture ou a la fermeture d'un formulaire).
  surReinitialiser: () => void
}

// Quel formulaire est ouvert : aucun, l'ajout, ou la modification d'un theme.
type Edition = { type: 'creation' } | { type: 'modification'; themeId: string } | null

// Limites reprises du backend.
const CODE_MIN = 2
const CODE_MAX = 40
const LIBELLE_MIN = 2
const LIBELLE_MAX = 80
const ORDRE_MAX = 999

// Forme reprise du backend.
const FORME_CODE = /^[a-z][a-z0-9_]*$/

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte'

// ------------------------------------------------------------
// Formulaire d'un theme (ajout ou modification)
// ------------------------------------------------------------

type ProprietesFormulaireCommunes = {
  enCours: boolean
  erreur: ErreurService | null
  // Appele au clic sur "Annuler" : la liste ferme le formulaire.
  surFermer: () => void
}

type ProprietesFormulaire = ProprietesFormulaireCommunes &
  (
    | {
        mode: 'creation'
        surEnvoyer: (corps: CorpsCreationTheme) => Promise<boolean>
      }
    | {
        mode: 'modification'
        theme: ThemeAdmin
        surEnvoyer: (corps: CorpsModificationTheme) => Promise<boolean>
      }
  )

function FormulaireTheme(proprietes: ProprietesFormulaire) {
  const { enCours, erreur, surFermer } = proprietes
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idCode = useId()
  const idLibelleFr = useId()
  const idLibelleEn = useId()
  const idOrdre = useId()
  const idErreurCode = useId()
  const idErreurLibelleFr = useId()
  const idErreurLibelleEn = useId()
  const idErreurOrdre = useId()

  const theme = proprietes.mode === 'modification' ? proprietes.theme : null
  const estCreation = proprietes.mode === 'creation'

  // Ce que la personne tape. Pour une modification, on part du theme actuel.
  const [code, setCode] = useState('')
  const [libelleFr, setLibelleFr] = useState(theme?.libelle_fr ?? '')
  const [libelleEn, setLibelleEn] = useState(theme?.libelle_en ?? '')
  // L'ordre se tape comme un texte de chiffres : vide = en dernier (ajout seulement).
  const [ordre, setOrdre] = useState(theme === null ? '' : String(theme.ordre))
  // Les messages d'erreur apparaissent apres le premier essai d'envoi.
  const [tentative, setTentative] = useState(false)

  const codePropre = code.trim()
  const libelleFrPropre = libelleFr.trim()
  const libelleEnPropre = libelleEn.trim()
  const ordrePropre = ordre.trim()

  function verifierLibelle(valeur: string): string | null {
    if (valeur === '') {
      return t('admin.secteurs.themes.formulaire.libelleObligatoire')
    }
    if (valeur.length < LIBELLE_MIN) {
      return t('admin.secteurs.themes.formulaire.libelleCourt')
    }
    if (valeur.length > LIBELLE_MAX) {
      return t('admin.secteurs.themes.formulaire.libelleLong')
    }
    return null
  }

  let erreurCode: string | null = null
  if (estCreation) {
    if (codePropre === '') {
      erreurCode = t('admin.secteurs.themes.formulaire.codeObligatoire')
    } else if (codePropre.length > CODE_MAX) {
      erreurCode = t('admin.secteurs.themes.formulaire.codeLong')
    } else if (codePropre.length < CODE_MIN || !FORME_CODE.test(codePropre)) {
      erreurCode = t('admin.secteurs.themes.formulaire.codeInvalide')
    }
  }
  const erreurLibelleFr = verifierLibelle(libelleFrPropre)
  const erreurLibelleEn = verifierLibelle(libelleEnPropre)

  let erreurOrdre: string | null = null
  if (ordrePropre === '') {
    // Vide est permis seulement a l'ajout (le theme passe en dernier).
    erreurOrdre = estCreation ? null : t('admin.secteurs.themes.formulaire.ordreObligatoire')
  } else if (Number(ordrePropre) > ORDRE_MAX) {
    erreurOrdre = t('admin.secteurs.themes.formulaire.ordreInvalide')
  }

  const formulaireValide =
    erreurCode === null &&
    erreurLibelleFr === null &&
    erreurLibelleEn === null &&
    erreurOrdre === null

  // Pour une modification : seuls les champs changes sont envoyes (le serveur en veut au moins un).
  function construireModification(actuel: ThemeAdmin): CorpsModificationTheme {
    const corps: CorpsModificationTheme = {}
    if (libelleFrPropre !== actuel.libelle_fr) {
      corps.libelle_fr = libelleFrPropre
    }
    if (libelleEnPropre !== actuel.libelle_en) {
      corps.libelle_en = libelleEnPropre
    }
    if (ordrePropre !== '' && Number(ordrePropre) !== actuel.ordre) {
      corps.ordre = Number(ordrePropre)
    }
    return corps
  }

  async function envoyer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (!formulaireValide) {
      return
    }

    if (proprietes.mode === 'creation') {
      const corps: CorpsCreationTheme = {
        code: codePropre,
        libelle_fr: libelleFrPropre,
        libelle_en: libelleEnPropre,
      }
      if (ordrePropre !== '') {
        corps.ordre = Number(ordrePropre)
      }
      await proprietes.surEnvoyer(corps)
      return
    }

    const corps = construireModification(proprietes.theme)
    if (Object.keys(corps).length === 0) {
      return
    }
    await proprietes.surEnvoyer(corps)
  }

  // Rien n'a change dans une modification : on bloque le bouton au lieu d'envoyer une demande vide.
  const aucunChangement =
    proprietes.mode === 'modification' &&
    formulaireValide &&
    Object.keys(construireModification(proprietes.theme)).length === 0

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.statut === 403) {
      messageErreur = t('admin.secteurs.themes.erreurs.droits')
    } else if (erreur.statut === 404) {
      messageErreur = t('admin.secteurs.themes.erreurs.introuvable')
    } else if (erreur.code === 'CODE_DEJA_UTILISE') {
      messageErreur = t('admin.secteurs.themes.erreurs.CODE_DEJA_UTILISE')
    } else if (erreur.code === 'DONNEES_INVALIDES') {
      messageErreur = t('admin.secteurs.themes.erreurs.DONNEES_INVALIDES')
    } else {
      messageErreur = t('admin.secteurs.themes.erreurs.generique')
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={idTitre}
      className="rounded-md border border-bordure bg-surface p-4"
    >
      <h4 id={idTitre} className="m-0 text-sm font-bold text-texte">
        {theme === null
          ? t('admin.secteurs.themes.formulaire.titreCreation')
          : t('admin.secteurs.themes.formulaire.titreModification', { code: theme.code })}
      </h4>

      <form
        onSubmit={(evenement) => void envoyer(evenement)}
        noValidate
        className="mt-3 flex flex-col gap-4"
      >
        {estCreation && (
          <div className="flex flex-col gap-1">
            <label htmlFor={idCode} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.themes.formulaire.code')}
            </label>
            <input
              id={idCode}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={CODE_MAX}
              required
              value={code}
              aria-invalid={tentative && erreurCode !== null}
              aria-describedby={tentative && erreurCode !== null ? idErreurCode : undefined}
              onChange={(evenement) => setCode(evenement.target.value.toLowerCase())}
              className={CLASSE_CHAMP}
            />
            <p className="m-0 text-xs text-texte-secondaire">
              {t('admin.secteurs.themes.formulaire.aideCode')}
            </p>
            {tentative && erreurCode !== null && (
              <p id={idErreurCode} role="alert" className="m-0 text-xs text-erreur">
                {erreurCode}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idLibelleFr} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.themes.formulaire.libelleFr')}
            </label>
            <input
              id={idLibelleFr}
              type="text"
              autoComplete="off"
              maxLength={LIBELLE_MAX}
              required
              value={libelleFr}
              aria-invalid={tentative && erreurLibelleFr !== null}
              aria-describedby={tentative && erreurLibelleFr !== null ? idErreurLibelleFr : undefined}
              onChange={(evenement) => setLibelleFr(evenement.target.value)}
              className={CLASSE_CHAMP}
            />
            {tentative && erreurLibelleFr !== null && (
              <p id={idErreurLibelleFr} role="alert" className="m-0 text-xs text-erreur">
                {erreurLibelleFr}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idLibelleEn} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.themes.formulaire.libelleEn')}
            </label>
            <input
              id={idLibelleEn}
              type="text"
              autoComplete="off"
              maxLength={LIBELLE_MAX}
              required
              value={libelleEn}
              aria-invalid={tentative && erreurLibelleEn !== null}
              aria-describedby={tentative && erreurLibelleEn !== null ? idErreurLibelleEn : undefined}
              onChange={(evenement) => setLibelleEn(evenement.target.value)}
              className={CLASSE_CHAMP}
            />
            {tentative && erreurLibelleEn !== null && (
              <p id={idErreurLibelleEn} role="alert" className="m-0 text-xs text-erreur">
                {erreurLibelleEn}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 sm:max-w-40">
          <label htmlFor={idOrdre} className="text-sm font-semibold text-texte">
            {t('admin.secteurs.themes.formulaire.ordre')}
          </label>
          <input
            id={idOrdre}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={ordre}
            aria-invalid={tentative && erreurOrdre !== null}
            aria-describedby={tentative && erreurOrdre !== null ? idErreurOrdre : undefined}
            onChange={(evenement) => setOrdre(evenement.target.value.replace(/\D/g, ''))}
            className={CLASSE_CHAMP}
          />
          <p className="m-0 text-xs text-texte-secondaire">
            {estCreation
              ? t('admin.secteurs.themes.formulaire.aideOrdreCreation')
              : t('admin.secteurs.themes.formulaire.aideOrdreModification')}
          </p>
          {tentative && erreurOrdre !== null && (
            <p id={idErreurOrdre} role="alert" className="m-0 text-xs text-erreur">
              {erreurOrdre}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={enCours || aucunChangement}
            aria-busy={enCours}
            className={CLASSE_BOUTON_PRINCIPAL}
          >
            {estCreation
              ? enCours
                ? t('admin.secteurs.themes.formulaire.creerEnCours')
                : t('admin.secteurs.themes.formulaire.creer')
              : enCours
                ? t('admin.secteurs.themes.formulaire.enregistrerEnCours')
                : t('admin.secteurs.themes.formulaire.enregistrer')}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={surFermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('admin.secteurs.themes.formulaire.annuler')}
          </button>
        </div>

        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
      </form>
    </div>
  )
}

// ------------------------------------------------------------
// Liste des themes
// ------------------------------------------------------------

export function ListeThemesSecteur({
  themes,
  enCours,
  erreur,
  surCreer,
  surModifier,
  surReinitialiser,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const [edition, setEdition] = useState<Edition>(null)
  // Dernier envoi reussi depuis cette liste, pour le message sous le titre.
  const [confirmation, setConfirmation] = useState<'cree' | 'modifie' | null>(null)

  function ouvrir(suivante: Edition): void {
    surReinitialiser()
    setConfirmation(null)
    setEdition(suivante)
  }

  function fermer(): void {
    surReinitialiser()
    setEdition(null)
  }

  async function creer(corps: CorpsCreationTheme): Promise<boolean> {
    const fait = await surCreer(corps)
    if (fait) {
      setEdition(null)
      setConfirmation('cree')
    }
    return fait
  }

  async function modifier(themeId: string, corps: CorpsModificationTheme): Promise<boolean> {
    const fait = await surModifier(themeId, corps)
    if (fait) {
      setEdition(null)
      setConfirmation('modifie')
    }
    return fait
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={idTitre} className="m-0 font-titre text-lg font-bold text-texte">
            {t('admin.secteurs.themes.titre')}
          </h3>
          <p className="m-0 text-sm text-texte-secondaire">{t('admin.secteurs.themes.aide')}</p>
        </div>
        <button
          type="button"
          disabled={edition?.type === 'creation'}
          onClick={() => ouvrir({ type: 'creation' })}
          className={CLASSE_BOUTON_PRINCIPAL}
        >
          {t('admin.secteurs.themes.ajouter')}
        </button>
      </div>

      {confirmation !== null && (
        <p role="status" className="mb-0 mt-3 text-sm text-succes">
          {confirmation === 'cree'
            ? t('admin.secteurs.themes.themeCree')
            : t('admin.secteurs.themes.themeModifie')}
        </p>
      )}

      {edition?.type === 'creation' && (
        <div className="mt-4">
          <FormulaireTheme
            mode="creation"
            enCours={enCours}
            erreur={erreur}
            surEnvoyer={creer}
            surFermer={fermer}
          />
        </div>
      )}

      {themes.length === 0 ? (
        <p className="mb-0 mt-4 text-sm text-texte-secondaire">
          {t('admin.secteurs.themes.aucunTheme')}
        </p>
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {themes.map((theme) => {
            const enModification =
              edition?.type === 'modification' && edition.themeId === theme.id
            const libelle = langue === 'en' ? theme.libelle_en : theme.libelle_fr
            const autreLibelle = langue === 'en' ? theme.libelle_fr : theme.libelle_en
            return (
              <li key={theme.id}>
                {enModification ? (
                  <FormulaireTheme
                    mode="modification"
                    theme={theme}
                    enCours={enCours}
                    erreur={erreur}
                    surEnvoyer={(corps) => modifier(theme.id, corps)}
                    surFermer={fermer}
                  />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface-douce p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-label={t('admin.secteurs.themes.ordreTheme', { ordre: theme.ordre })}
                        className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-accent-fond px-2 text-sm font-bold text-texte"
                      >
                        {theme.ordre}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words text-sm font-semibold text-texte">
                          {libelle}
                        </span>
                        <span className="break-words text-xs text-texte-secondaire">
                          {autreLibelle} · {theme.code}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('admin.secteurs.themes.modifierNom', { nom: libelle })}
                      onClick={() => ouvrir({ type: 'modification', themeId: theme.id })}
                      className={CLASSE_BOUTON_SECONDAIRE}
                    >
                      {t('admin.secteurs.themes.modifier')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}