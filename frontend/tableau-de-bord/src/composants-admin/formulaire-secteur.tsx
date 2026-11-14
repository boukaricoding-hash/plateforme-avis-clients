import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type {
  CorpsCreationSecteur,
  CorpsModificationSecteur,
  SecteurDetail,
  VocabulaireSecteur,
} from '../types/admin'

// Formulaire d'un secteur (ecran E18, jour 23), administrateur DTS seulement.
// Deux usages, choisis par la propriete mode :
// - creation : code, noms francais et anglais, vocabulaire, indicateurs suggeres et etat actif.
//   Le code ne changera plus jamais ensuite ;
// - modification : noms, vocabulaire, indicateurs suggeres et etat actif. Le code est affiche
//   mais ne se change pas.
// Les themes ont leur propre composant (liste-themes-secteur.tsx).
// Ce composant n'appelle pas l'API : l'envoi vient de utiliserSecteursAdmin.
// Ici on garde seulement ce que la personne tape et on verifie avant l'envoi
// (le serveur refait toujours la verification).
// En modification, la page doit donner key={secteur.id} : changer de secteur repart d'un formulaire neuf.

type ProprietesCommunes = {
  // Vrai pendant l'envoi : les boutons sont bloques.
  enCours: boolean
  erreur: ErreurService | null
  // Derniere action reussie (sert au message de la modification).
  succes: boolean
  // Appele au clic sur "Annuler" ou "Fermer" : la page ferme le formulaire.
  surFermer: () => void
}

type ProprietesCreation = ProprietesCommunes & {
  mode: 'creation'
  // Renvoie true si le secteur est cree.
  surEnvoyer: (corps: CorpsCreationSecteur) => Promise<boolean>
}

type ProprietesModification = ProprietesCommunes & {
  mode: 'modification'
  secteur: SecteurDetail
  // Renvoie true si la modification est faite.
  surEnvoyer: (corps: CorpsModificationSecteur) => Promise<boolean>
}

type Proprietes = ProprietesCreation | ProprietesModification

// Limites reprises du backend.
const CODE_MIN = 2
const CODE_MAX = 40
const NOM_MIN = 2
const NOM_MAX = 80
const MOT_MAX = 40
const VOCABULAIRE_MAX = 10
const INDICATEURS_MAX = 20

// Formes reprises du backend.
const FORME_CODE = /^[a-z][a-z0-9_]*$/
const FORME_CLE = /^[a-z][a-z0-9_]{0,39}$/

// Cle obligatoire du vocabulaire : le mot affiche a la place de "point de contact" (table, chambre...).
const CLE_POINT_CONTACT = 'point_contact'

// Une ligne du vocabulaire telle qu'on la tape. La premiere ligne est toujours point_contact.
type LigneVocabulaire = {
  cle: string
  mot: string
}

type ErreurLigne = {
  cle: string | null
  mot: string | null
}

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte'

// Lignes de depart : point_contact d'abord, puis les autres mots dans l'ordre recu.
function lignesDepuis(vocabulaire: VocabulaireSecteur | null): LigneVocabulaire[] {
  const lignes: LigneVocabulaire[] = [
    { cle: CLE_POINT_CONTACT, mot: vocabulaire?.[CLE_POINT_CONTACT] ?? '' },
  ]
  if (vocabulaire !== null) {
    for (const [cle, mot] of Object.entries(vocabulaire)) {
      if (cle !== CLE_POINT_CONTACT) {
        lignes.push({ cle, mot })
      }
    }
  }
  return lignes
}

// Le vocabulaire a envoyer : cles et mots sans espaces autour.
function vocabulaireDepuis(lignes: LigneVocabulaire[]): VocabulaireSecteur {
  const vocabulaire: VocabulaireSecteur = {}
  for (const ligne of lignes) {
    vocabulaire[ligne.cle.trim()] = ligne.mot.trim()
  }
  return vocabulaire
}

function memeVocabulaire(a: VocabulaireSecteur, b: VocabulaireSecteur): boolean {
  const clesA = Object.keys(a)
  if (clesA.length !== Object.keys(b).length) {
    return false
  }
  return clesA.every((cle) => a[cle] === b[cle])
}

// Les codes d'indicateurs se tapent separes par des virgules, des espaces ou des retours a la ligne.
function lireIndicateurs(texte: string): string[] {
  return texte
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((code) => code !== '')
}

function memeListe(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((valeur, index) => valeur === b[index])
}

export function FormulaireSecteur(proprietes: Proprietes) {
  const { enCours, erreur, succes, surFermer } = proprietes
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idCode = useId()
  const idNomFr = useId()
  const idNomEn = useId()
  const idVocabulaire = useId()
  const idIndicateurs = useId()
  const idActif = useId()
  const idErreurCode = useId()
  const idErreurNomFr = useId()
  const idErreurNomEn = useId()
  const idErreurIndicateurs = useId()

  const secteur = proprietes.mode === 'modification' ? proprietes.secteur : null
  const estCreation = proprietes.mode === 'creation'

  // Ce que la personne tape. Pour une modification, on part du secteur actuel.
  const [code, setCode] = useState('')
  const [nomFr, setNomFr] = useState(secteur?.nom_fr ?? '')
  const [nomEn, setNomEn] = useState(secteur?.nom_en ?? '')
  const [lignes, setLignes] = useState<LigneVocabulaire[]>(
    lignesDepuis(secteur?.vocabulaire ?? null),
  )
  const [texteIndicateurs, setTexteIndicateurs] = useState(
    secteur?.indicateurs_suggeres.join(', ') ?? '',
  )
  // Un nouveau secteur est actif des le depart, comme le serveur.
  const [actif, setActif] = useState(secteur?.actif ?? true)
  // Les messages d'erreur apparaissent apres le premier essai d'envoi.
  const [tentative, setTentative] = useState(false)

  const codePropre = code.trim()
  const nomFrPropre = nomFr.trim()
  const nomEnPropre = nomEn.trim()
  const indicateurs = lireIndicateurs(texteIndicateurs)

  function verifierNom(valeur: string): string | null {
    if (valeur === '') {
      return t('admin.secteurs.formulaire.nomObligatoire')
    }
    if (valeur.length < NOM_MIN) {
      return t('admin.secteurs.formulaire.nomCourt')
    }
    if (valeur.length > NOM_MAX) {
      return t('admin.secteurs.formulaire.nomLong')
    }
    return null
  }

  let erreurCode: string | null = null
  if (estCreation) {
    if (codePropre === '') {
      erreurCode = t('admin.secteurs.formulaire.codeObligatoire')
    } else if (codePropre.length > CODE_MAX) {
      erreurCode = t('admin.secteurs.formulaire.codeLong')
    } else if (codePropre.length < CODE_MIN || !FORME_CODE.test(codePropre)) {
      erreurCode = t('admin.secteurs.formulaire.codeInvalide')
    }
  }
  const erreurNomFr = verifierNom(nomFrPropre)
  const erreurNomEn = verifierNom(nomEnPropre)

  // Erreurs du vocabulaire, ligne par ligne.
  const erreursLignes: ErreurLigne[] = lignes.map((ligne, index) => {
    const clePropre = ligne.cle.trim()
    const motPropre = ligne.mot.trim()
    let erreurCle: string | null = null
    let erreurMot: string | null = null
    if (motPropre === '') {
      erreurMot = t(
        index === 0
          ? 'admin.secteurs.formulaire.motPointContactObligatoire'
          : 'admin.secteurs.formulaire.motObligatoire',
      )
    } else if (motPropre.length > MOT_MAX) {
      erreurMot = t('admin.secteurs.formulaire.motLong')
    }
    if (index > 0) {
      if (!FORME_CLE.test(clePropre)) {
        erreurCle = t('admin.secteurs.formulaire.cleInvalide')
      } else if (
        clePropre === CLE_POINT_CONTACT ||
        lignes.some((autre, position) => position < index && autre.cle.trim() === clePropre)
      ) {
        erreurCle = t('admin.secteurs.formulaire.cleDoublon')
      }
    }
    return { cle: erreurCle, mot: erreurMot }
  })
  const vocabulaireValide = erreursLignes.every((e) => e.cle === null && e.mot === null)

  // Erreur des indicateurs suggeres (une seule phrase pour toute la liste).
  let erreurIndicateurs: string | null = null
  if (indicateurs.length > INDICATEURS_MAX) {
    erreurIndicateurs = t('admin.secteurs.formulaire.tropIndicateurs')
  } else if (
    indicateurs.some(
      (indicateur) =>
        indicateur.length < CODE_MIN || indicateur.length > CODE_MAX || !FORME_CODE.test(indicateur),
    )
  ) {
    erreurIndicateurs = t('admin.secteurs.formulaire.indicateurInvalide')
  } else if (new Set(indicateurs).size !== indicateurs.length) {
    erreurIndicateurs = t('admin.secteurs.formulaire.indicateurDoublon')
  }

  const formulaireValide =
    erreurCode === null &&
    erreurNomFr === null &&
    erreurNomEn === null &&
    vocabulaireValide &&
    erreurIndicateurs === null

  // Pour une modification : seuls les champs changes sont envoyes (le serveur en veut au moins un).
  function construireModification(actuel: SecteurDetail): CorpsModificationSecteur {
    const corps: CorpsModificationSecteur = {}
    if (nomFrPropre !== actuel.nom_fr) {
      corps.nom_fr = nomFrPropre
    }
    if (nomEnPropre !== actuel.nom_en) {
      corps.nom_en = nomEnPropre
    }
    const vocabulaire = vocabulaireDepuis(lignes)
    if (!memeVocabulaire(vocabulaire, actuel.vocabulaire)) {
      corps.vocabulaire = vocabulaire
    }
    if (!memeListe(indicateurs, actuel.indicateurs_suggeres)) {
      corps.indicateurs_suggeres = indicateurs
    }
    if (actif !== actuel.actif) {
      corps.actif = actif
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
      await proprietes.surEnvoyer({
        code: codePropre,
        nom_fr: nomFrPropre,
        nom_en: nomEnPropre,
        vocabulaire: vocabulaireDepuis(lignes),
        indicateurs_suggeres: indicateurs,
        actif,
      })
      return
    }

    const corps = construireModification(proprietes.secteur)
    if (Object.keys(corps).length === 0) {
      return
    }
    await proprietes.surEnvoyer(corps)
  }

  // Rien n'a change dans une modification : on bloque le bouton au lieu d'envoyer une demande vide.
  const aucunChangement =
    proprietes.mode === 'modification' &&
    formulaireValide &&
    Object.keys(construireModification(proprietes.secteur)).length === 0

  function changerLigne(index: number, changement: Partial<LigneVocabulaire>): void {
    setLignes((avant) =>
      avant.map((ligne, position) => (position === index ? { ...ligne, ...changement } : ligne)),
    )
  }

  function ajouterLigne(): void {
    setLignes((avant) => [...avant, { cle: '', mot: '' }])
  }

  function retirerLigne(index: number): void {
    setLignes((avant) => avant.filter((_ligne, position) => position !== index))
  }

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.statut === 403) {
      messageErreur = t('admin.secteurs.formulaire.erreurs.droits')
    } else if (erreur.statut === 404) {
      messageErreur = t('admin.secteurs.formulaire.erreurs.introuvable')
    } else if (erreur.code === 'CODE_DEJA_UTILISE') {
      messageErreur = t('admin.secteurs.formulaire.erreurs.CODE_DEJA_UTILISE')
    } else if (erreur.code === 'DONNEES_INVALIDES') {
      messageErreur = t('admin.secteurs.formulaire.erreurs.DONNEES_INVALIDES')
    } else {
      messageErreur = t('admin.secteurs.formulaire.erreurs.generique')
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {estCreation
          ? t('admin.secteurs.formulaire.titreCreation')
          : t('admin.secteurs.formulaire.titreModification')}
      </h2>

      <form
        onSubmit={(evenement) => void envoyer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        {estCreation ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={idCode} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.formulaire.code')}
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
              {t('admin.secteurs.formulaire.aideCode')}
            </p>
            {tentative && erreurCode !== null && (
              <p id={idErreurCode} role="alert" className="m-0 text-xs text-erreur">
                {erreurCode}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-texte-secondaire">
            {t('admin.secteurs.formulaire.codeFixe', { code: proprietes.secteur.code })}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idNomFr} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.formulaire.nomFr')}
            </label>
            <input
              id={idNomFr}
              type="text"
              autoComplete="off"
              maxLength={NOM_MAX}
              required
              value={nomFr}
              aria-invalid={tentative && erreurNomFr !== null}
              aria-describedby={tentative && erreurNomFr !== null ? idErreurNomFr : undefined}
              onChange={(evenement) => setNomFr(evenement.target.value)}
              className={CLASSE_CHAMP}
            />
            {tentative && erreurNomFr !== null && (
              <p id={idErreurNomFr} role="alert" className="m-0 text-xs text-erreur">
                {erreurNomFr}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idNomEn} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.formulaire.nomEn')}
            </label>
            <input
              id={idNomEn}
              type="text"
              autoComplete="off"
              maxLength={NOM_MAX}
              required
              value={nomEn}
              aria-invalid={tentative && erreurNomEn !== null}
              aria-describedby={tentative && erreurNomEn !== null ? idErreurNomEn : undefined}
              onChange={(evenement) => setNomEn(evenement.target.value)}
              className={CLASSE_CHAMP}
            />
            {tentative && erreurNomEn !== null && (
              <p id={idErreurNomEn} role="alert" className="m-0 text-xs text-erreur">
                {erreurNomEn}
              </p>
            )}
          </div>
        </div>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-texte">
            {t('admin.secteurs.formulaire.vocabulaire')}
          </legend>
          <p className="m-0 text-xs text-texte-secondaire">
            {t('admin.secteurs.formulaire.aideVocabulaire')}
          </p>

          {lignes.map((ligne, index) => {
            const erreurLigne = erreursLignes[index]
            const idMot = `${idVocabulaire}-${index}-mot`
            const idCle = `${idVocabulaire}-${index}-cle`
            const idErreurMot = `${idVocabulaire}-${index}-erreur-mot`
            const idErreurCle = `${idVocabulaire}-${index}-erreur-cle`
            const erreurMotVisible = tentative && erreurLigne.mot !== null
            const erreurCleVisible = tentative && erreurLigne.cle !== null
            return (
              <div key={index} className="flex flex-col gap-1">
                {index === 0 ? (
                  <>
                    <label htmlFor={idMot} className="text-sm text-texte">
                      {t('admin.secteurs.formulaire.vocabulairePointContact')}
                    </label>
                    <input
                      id={idMot}
                      type="text"
                      autoComplete="off"
                      maxLength={MOT_MAX}
                      required
                      value={ligne.mot}
                      aria-invalid={erreurMotVisible}
                      aria-describedby={erreurMotVisible ? idErreurMot : undefined}
                      onChange={(evenement) => changerLigne(index, { mot: evenement.target.value })}
                      className={CLASSE_CHAMP}
                    />
                  </>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id={idCle}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={MOT_MAX}
                      value={ligne.cle}
                      placeholder={t('admin.secteurs.formulaire.vocabulaireCle')}
                      aria-label={t('admin.secteurs.formulaire.vocabulaireCle')}
                      aria-invalid={erreurCleVisible}
                      aria-describedby={erreurCleVisible ? idErreurCle : undefined}
                      onChange={(evenement) =>
                        changerLigne(index, { cle: evenement.target.value.toLowerCase() })
                      }
                      className={CLASSE_CHAMP}
                    />
                    <input
                      id={idMot}
                      type="text"
                      autoComplete="off"
                      maxLength={MOT_MAX}
                      value={ligne.mot}
                      placeholder={t('admin.secteurs.formulaire.vocabulaireMot')}
                      aria-label={t('admin.secteurs.formulaire.vocabulaireMot')}
                      aria-invalid={erreurMotVisible}
                      aria-describedby={erreurMotVisible ? idErreurMot : undefined}
                      onChange={(evenement) => changerLigne(index, { mot: evenement.target.value })}
                      className={CLASSE_CHAMP}
                    />
                    <button
                      type="button"
                      onClick={() => retirerLigne(index)}
                      className={`${CLASSE_BOUTON_SECONDAIRE} sm:shrink-0`}
                    >
                      {t('admin.secteurs.formulaire.retirerMot')}
                    </button>
                  </div>
                )}
                {erreurCleVisible && (
                  <p id={idErreurCle} role="alert" className="m-0 text-xs text-erreur">
                    {erreurLigne.cle}
                  </p>
                )}
                {erreurMotVisible && (
                  <p id={idErreurMot} role="alert" className="m-0 text-xs text-erreur">
                    {erreurLigne.mot}
                  </p>
                )}
              </div>
            )
          })}

          <div>
            <button
              type="button"
              disabled={lignes.length >= VOCABULAIRE_MAX}
              onClick={ajouterLigne}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              {t('admin.secteurs.formulaire.ajouterMot')}
            </button>
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor={idIndicateurs} className="text-sm font-semibold text-texte">
            {t('admin.secteurs.formulaire.indicateurs')}
          </label>
          <input
            id={idIndicateurs}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={texteIndicateurs}
            aria-invalid={tentative && erreurIndicateurs !== null}
            aria-describedby={tentative && erreurIndicateurs !== null ? idErreurIndicateurs : undefined}
            onChange={(evenement) => setTexteIndicateurs(evenement.target.value)}
            className={CLASSE_CHAMP}
          />
          <p className="m-0 text-xs text-texte-secondaire">
            {t('admin.secteurs.formulaire.aideIndicateurs')}
          </p>
          {tentative && erreurIndicateurs !== null && (
            <p id={idErreurIndicateurs} role="alert" className="m-0 text-xs text-erreur">
              {erreurIndicateurs}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center gap-3">
            <input
              id={idActif}
              type="checkbox"
              checked={actif}
              onChange={(evenement) => setActif(evenement.target.checked)}
              className="h-5 w-5 accent-principale"
            />
            <label htmlFor={idActif} className="text-sm font-semibold text-texte">
              {t('admin.secteurs.formulaire.actif')}
            </label>
          </div>
          <p className="m-0 text-xs text-texte-secondaire">
            {t('admin.secteurs.formulaire.aideActif')}
          </p>
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
                ? t('admin.secteurs.formulaire.creerEnCours')
                : t('admin.secteurs.formulaire.creer')
              : enCours
                ? t('admin.secteurs.formulaire.enregistrerEnCours')
                : t('admin.secteurs.formulaire.enregistrer')}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={surFermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {estCreation || !succes
              ? t('admin.secteurs.formulaire.annuler')
              : t('admin.secteurs.formulaire.fermer')}
          </button>
        </div>

        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
        {!estCreation && tentative && succes && erreur === null && (
          <p role="status" className="m-0 text-sm text-succes">
            {t('admin.secteurs.formulaire.modificationEnregistree')}
          </p>
        )}
      </form>
    </section>
  )
}