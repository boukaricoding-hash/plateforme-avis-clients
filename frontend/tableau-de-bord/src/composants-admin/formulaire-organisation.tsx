import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type {
  CorpsCreationOrganisation,
  CorpsModificationOrganisation,
  LangueOrganisation,
  OrganisationAdmin,
  SecteurListe,
  StatutCreationOrganisation,
} from '../types/admin'

// Formulaire d'une organisation (ecran E17, jour 23), administrateur DTS seulement.
// Deux usages, choisis par la propriete mode :
// - creation : nom, secteur (actif), couleur, pays, fuseau, langue par defaut et statut de depart
//   (essai ou actif). Pas de logo : le premier responsable l'ajoute dans l'ecran E14 ;
// - modification : nom, couleur, pays, fuseau et langue. Le secteur et le statut ne changent
//   jamais ici (la suspension et la reactivation ont leurs propres boutons).
// Ce composant n'appelle pas l'API : l'envoi vient de utiliserOrganisationsAdmin.
// Ici on garde seulement ce que la personne tape et on verifie avant l'envoi
// (le serveur refait toujours la verification).
// Apres une creation reussie, c'est la page qui prend le relais (invitation du premier responsable).

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
  // null tant que les secteurs ne sont pas charges.
  secteurs: SecteurListe[] | null
  erreurSecteurs: ErreurService | null
  // Renvoie true si l'organisation est creee.
  surEnvoyer: (corps: CorpsCreationOrganisation) => Promise<boolean>
}

type ProprietesModification = ProprietesCommunes & {
  mode: 'modification'
  organisation: OrganisationAdmin
  // Renvoie true si la modification est faite.
  surEnvoyer: (corps: CorpsModificationOrganisation) => Promise<boolean>
}

type Proprietes = ProprietesCreation | ProprietesModification

// Valeurs de depart d'une creation : le Togo, comme le serveur.
const PAYS_PAR_DEFAUT = 'TG'
const FUSEAU_PAR_DEFAUT = 'Africa/Lome'
// Couleur proposee par le selecteur quand on choisit d'en donner une.
const COULEUR_PROPOSEE = '#1d4ed8'

// Limites reprises du backend.
const NOM_MIN = 2
const NOM_MAX = 120

// Formes reprises du backend.
const FORME_PAYS = /^[A-Z]{2}$/

// Fuseaux proposes dans la liste de suggestions ; on peut taper n'importe quel nom IANA.
const FUSEAUX_SUGGERES = [
  'Africa/Lome',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Cotonou',
  'Africa/Lagos',
  'Africa/Dakar',
  'Africa/Ouagadougou',
  'Europe/Paris',
  'UTC',
]

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_CHAMP =
  'min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte'

// Langue par defaut d'une organisation : le serveur n'accepte que fr et en.
function versLangueOrganisation(langue: string): LangueOrganisation {
  return langue === 'en' ? 'en' : 'fr'
}

export function FormulaireOrganisation(proprietes: Proprietes) {
  const { enCours, erreur, succes, surFermer } = proprietes
  const { t, langue: langueEcran } = utiliserLangue()
  const idTitre = useId()
  const idNom = useId()
  const idSecteur = useId()
  const idCouleur = useId()
  const idSansCouleur = useId()
  const idPays = useId()
  const idFuseau = useId()
  const idListeFuseaux = useId()
  const idLangue = useId()
  const idStatut = useId()
  const idErreurNom = useId()
  const idErreurSecteur = useId()
  const idErreurPays = useId()
  const idErreurFuseau = useId()

  const organisation = proprietes.mode === 'modification' ? proprietes.organisation : null
  const couleurDepart = organisation?.couleur_principale ?? null

  // Ce que la personne tape. Pour une modification, on part de l'organisation actuelle.
  const [nom, setNom] = useState(organisation?.nom ?? '')
  const [secteurId, setSecteurId] = useState('')
  const [couleur, setCouleur] = useState(couleurDepart?.toLowerCase() ?? COULEUR_PROPOSEE)
  const [sansCouleur, setSansCouleur] = useState(couleurDepart === null)
  const [pays, setPays] = useState(organisation?.pays ?? PAYS_PAR_DEFAUT)
  const [fuseau, setFuseau] = useState(organisation?.fuseau_horaire ?? FUSEAU_PAR_DEFAUT)
  const [langue, setLangue] = useState<LangueOrganisation>(
    versLangueOrganisation(organisation?.langue_defaut ?? 'fr'),
  )
  // Par defaut ESSAI : une nouvelle organisation commence a l'essai.
  const [statut, setStatut] = useState<StatutCreationOrganisation>('ESSAI')
  // Les messages d'erreur apparaissent apres le premier essai d'envoi.
  const [tentative, setTentative] = useState(false)

  const nomPropre = nom.trim()
  const paysPropre = pays.trim().toUpperCase()
  const fuseauPropre = fuseau.trim()
  const couleurFinale = sansCouleur ? null : couleur.toLowerCase()

  let erreurNom: string | null = null
  if (nomPropre.length < NOM_MIN) {
    erreurNom = t(nomPropre === '' ? 'admin.organisations.formulaire.nomObligatoire' : 'admin.organisations.formulaire.nomCourt')
  } else if (nomPropre.length > NOM_MAX) {
    erreurNom = t('admin.organisations.formulaire.nomLong')
  }
  const erreurSecteur =
    proprietes.mode === 'creation' && secteurId === ''
      ? t('admin.organisations.formulaire.secteurObligatoire')
      : null
  const erreurPays = FORME_PAYS.test(paysPropre) ? null : t('admin.organisations.formulaire.paysInvalide')
  const erreurFuseau = fuseauPropre === '' ? t('admin.organisations.formulaire.fuseauObligatoire') : null
  const formulaireValide =
    erreurNom === null && erreurSecteur === null && erreurPays === null && erreurFuseau === null

  async function envoyer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (!formulaireValide) {
      return
    }

    if (proprietes.mode === 'creation') {
      await proprietes.surEnvoyer({
        nom: nomPropre,
        secteur_id: secteurId,
        couleur_principale: couleurFinale,
        pays: paysPropre,
        fuseau_horaire: fuseauPropre,
        langue_defaut: langue,
        statut,
      })
      return
    }

    // Modification : seuls les champs changes sont envoyes (le serveur en veut au moins un).
    const actuelle = proprietes.organisation
    const corps: CorpsModificationOrganisation = {}
    if (nomPropre !== actuelle.nom) {
      corps.nom = nomPropre
    }
    if (couleurFinale !== (actuelle.couleur_principale?.toLowerCase() ?? null)) {
      corps.couleur_principale = couleurFinale
    }
    if (paysPropre !== actuelle.pays) {
      corps.pays = paysPropre
    }
    if (fuseauPropre !== actuelle.fuseau_horaire) {
      corps.fuseau_horaire = fuseauPropre
    }
    if (langue !== versLangueOrganisation(actuelle.langue_defaut)) {
      corps.langue_defaut = langue
    }
    if (Object.keys(corps).length === 0) {
      return
    }
    await proprietes.surEnvoyer(corps)
  }

  // Rien n'a change dans une modification : on le dit au lieu d'envoyer une demande vide.
  const aucunChangement =
    proprietes.mode === 'modification' &&
    formulaireValide &&
    nomPropre === proprietes.organisation.nom &&
    couleurFinale === (proprietes.organisation.couleur_principale?.toLowerCase() ?? null) &&
    paysPropre === proprietes.organisation.pays &&
    fuseauPropre === proprietes.organisation.fuseau_horaire &&
    langue === versLangueOrganisation(proprietes.organisation.langue_defaut)

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.statut === 403) {
      messageErreur = t('admin.organisations.formulaire.erreurs.droits')
    } else if (erreur.statut === 404) {
      messageErreur = t('admin.organisations.formulaire.erreurs.introuvable')
    } else if (erreur.code === 'SECTEUR_INVALIDE') {
      messageErreur = t('admin.organisations.formulaire.erreurs.SECTEUR_INVALIDE')
    } else if (erreur.code === 'DONNEES_INVALIDES') {
      messageErreur = t('admin.organisations.formulaire.erreurs.DONNEES_INVALIDES')
    } else {
      messageErreur = t('admin.organisations.formulaire.erreurs.generique')
    }
  }

  const estCreation = proprietes.mode === 'creation'
  const secteurs = proprietes.mode === 'creation' ? proprietes.secteurs : null
  const erreurSecteurs = proprietes.mode === 'creation' ? proprietes.erreurSecteurs : null

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {estCreation
          ? t('admin.organisations.formulaire.titreCreation')
          : t('admin.organisations.formulaire.titreModification')}
      </h2>

      <form
        onSubmit={(evenement) => void envoyer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idNom} className="text-sm font-semibold text-texte">
            {t('admin.organisations.formulaire.nom')}
          </label>
          <input
            id={idNom}
            type="text"
            autoComplete="off"
            maxLength={NOM_MAX}
            required
            value={nom}
            aria-invalid={tentative && erreurNom !== null}
            aria-describedby={tentative && erreurNom !== null ? idErreurNom : undefined}
            onChange={(evenement) => setNom(evenement.target.value)}
            className={CLASSE_CHAMP}
          />
          {tentative && erreurNom !== null && (
            <p id={idErreurNom} role="alert" className="m-0 text-xs text-erreur">
              {erreurNom}
            </p>
          )}
        </div>

        {estCreation ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={idSecteur} className="text-sm font-semibold text-texte">
              {t('admin.organisations.formulaire.secteur')}
            </label>
            <select
              id={idSecteur}
              value={secteurId}
              required
              disabled={secteurs === null}
              aria-invalid={tentative && erreurSecteur !== null}
              aria-describedby={tentative && erreurSecteur !== null ? idErreurSecteur : undefined}
              onChange={(evenement) => setSecteurId(evenement.target.value)}
              className={CLASSE_CHAMP}
            >
              <option value="">{t('admin.organisations.formulaire.secteurChoisir')}</option>
              {secteurs?.map((secteur) => (
                <option key={secteur.id} value={secteur.id}>
                  {langueEcran === 'en' ? secteur.nom_en : secteur.nom_fr}
                </option>
              ))}
            </select>
            {secteurs === null && erreurSecteurs === null && (
              <p role="status" className="m-0 text-xs text-texte-secondaire">
                {t('admin.organisations.formulaire.chargementSecteurs')}
              </p>
            )}
            {erreurSecteurs !== null && (
              <p role="alert" className="m-0 text-xs text-erreur">
                {t('admin.organisations.formulaire.erreurSecteurs')}
              </p>
            )}
            {secteurs !== null && secteurs.length === 0 && (
              <p className="m-0 text-xs text-texte-secondaire">
                {t('admin.organisations.formulaire.aucunSecteur')}
              </p>
            )}
            {tentative && erreurSecteur !== null && (
              <p id={idErreurSecteur} role="alert" className="m-0 text-xs text-erreur">
                {erreurSecteur}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-texte-secondaire">
            {t('admin.organisations.formulaire.secteurFixe', {
              secteur:
                langueEcran === 'en'
                  ? proprietes.organisation.secteur.nom_en
                  : proprietes.organisation.secteur.nom_fr,
            })}
          </p>
        )}

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-texte">
            {t('admin.organisations.formulaire.couleur')}
          </legend>
          <div className="flex flex-wrap items-center gap-4">
            <input
              id={idCouleur}
              type="color"
              value={couleur}
              disabled={sansCouleur}
              aria-label={t('admin.organisations.formulaire.couleur')}
              onChange={(evenement) => setCouleur(evenement.target.value)}
              className="h-11 w-16 cursor-pointer rounded-md border border-bordure-champ bg-fond p-1 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex min-h-11 items-center gap-3">
              <input
                id={idSansCouleur}
                type="checkbox"
                checked={sansCouleur}
                onChange={(evenement) => setSansCouleur(evenement.target.checked)}
                className="h-5 w-5 accent-principale"
              />
              <label htmlFor={idSansCouleur} className="text-sm text-texte">
                {t('admin.organisations.formulaire.sansCouleur')}
              </label>
            </div>
          </div>
          <p className="m-0 text-xs text-texte-secondaire">
            {t('admin.organisations.formulaire.aideCouleur')}
          </p>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idPays} className="text-sm font-semibold text-texte">
              {t('admin.organisations.formulaire.pays')}
            </label>
            <input
              id={idPays}
              type="text"
              autoComplete="off"
              maxLength={2}
              required
              value={pays}
              aria-invalid={tentative && erreurPays !== null}
              aria-describedby={tentative && erreurPays !== null ? idErreurPays : undefined}
              onChange={(evenement) => setPays(evenement.target.value.toUpperCase())}
              className={CLASSE_CHAMP}
            />
            <p className="m-0 text-xs text-texte-secondaire">
              {t('admin.organisations.formulaire.aidePays')}
            </p>
            {tentative && erreurPays !== null && (
              <p id={idErreurPays} role="alert" className="m-0 text-xs text-erreur">
                {erreurPays}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idFuseau} className="text-sm font-semibold text-texte">
              {t('admin.organisations.formulaire.fuseau')}
            </label>
            <input
              id={idFuseau}
              type="text"
              list={idListeFuseaux}
              autoComplete="off"
              maxLength={60}
              required
              value={fuseau}
              aria-invalid={tentative && erreurFuseau !== null}
              aria-describedby={tentative && erreurFuseau !== null ? idErreurFuseau : undefined}
              onChange={(evenement) => setFuseau(evenement.target.value)}
              className={CLASSE_CHAMP}
            />
            <datalist id={idListeFuseaux}>
              {FUSEAUX_SUGGERES.map((nomFuseau) => (
                <option key={nomFuseau} value={nomFuseau} />
              ))}
            </datalist>
            <p className="m-0 text-xs text-texte-secondaire">
              {t('admin.organisations.formulaire.aideFuseau')}
            </p>
            {tentative && erreurFuseau !== null && (
              <p id={idErreurFuseau} role="alert" className="m-0 text-xs text-erreur">
                {erreurFuseau}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idLangue} className="text-sm font-semibold text-texte">
              {t('admin.organisations.formulaire.langue')}
            </label>
            <select
              id={idLangue}
              value={langue}
              onChange={(evenement) => setLangue(evenement.target.value as LangueOrganisation)}
              className={CLASSE_CHAMP}
            >
              <option value="fr">{t('commun.francais')}</option>
              <option value="en">{t('commun.anglais')}</option>
            </select>
          </div>

          {estCreation && (
            <div className="flex flex-col gap-1">
              <label htmlFor={idStatut} className="text-sm font-semibold text-texte">
                {t('admin.organisations.formulaire.statut')}
              </label>
              <select
                id={idStatut}
                value={statut}
                onChange={(evenement) =>
                  setStatut(evenement.target.value as StatutCreationOrganisation)
                }
                className={CLASSE_CHAMP}
              >
                <option value="ESSAI">{t('admin.organisations.statuts.ESSAI')}</option>
                <option value="ACTIF">{t('admin.organisations.statuts.ACTIF')}</option>
              </select>
              <p className="m-0 text-xs text-texte-secondaire">
                {t('admin.organisations.formulaire.aideStatut')}
              </p>
            </div>
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
                ? t('admin.organisations.formulaire.creerEnCours')
                : t('admin.organisations.formulaire.creer')
              : enCours
                ? t('admin.organisations.formulaire.enregistrerEnCours')
                : t('admin.organisations.formulaire.enregistrer')}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={surFermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {estCreation || !succes
              ? t('admin.organisations.formulaire.annuler')
              : t('admin.organisations.formulaire.fermer')}
          </button>
        </div>

        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
        {!estCreation && tentative && succes && erreur === null && (
          <p role="status" className="m-0 text-sm text-succes">
            {t('admin.organisations.formulaire.modificationEnregistree')}
          </p>
        )}
      </form>
    </section>
  )
}