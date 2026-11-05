import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsSites } from '../hooks/utiliser-sites-points'
import type { CorpsCreationSite, CorpsModificationSite, Site } from '../types/sites-points'

// Formulaire de creation ou de modification d'un site (ecran E12, jour 17), Responsable seulement.
// - site = null : creation (seul le nom est obligatoire) ;
// - site = un site : modification (seuls les champs changes sont envoyes ; un champ vide efface
//   l'adresse, la ville ou le telephone).
// Ce composant n'appelle pas l'API : l'enregistrement vient de utiliserSitesPoints.
// Ici on garde seulement ce que la personne tape et on verifie le nom avant l'envoi.
// La page met key={site?.id ?? 'nouveau'} pour repartir de zero quand on change de site.

type Proprietes = {
  site: Site | null
  actions: ActionsSites
  // Appele apres un enregistrement reussi et au clic sur "Annuler" : la page ferme le formulaire.
  surFermer: () => void
}

// Longueurs maximales reprises du backend ; le serveur refait toujours la verification.
const LONGUEUR_NOM = 120
const LONGUEUR_ADRESSE = 200
const LONGUEUR_VILLE = 100
const LONGUEUR_TELEPHONE = 30

type ProprietesChamp = {
  id: string
  libelle: string
  valeur: string
  longueurMax: number
  type?: 'text' | 'tel'
  obligatoire?: boolean
  erreur?: string | null
  surChangement: (valeur: string) => void
}

// Un champ du formulaire : libelle, saisie, message d'erreur eventuel.
function ChampSite({
  id,
  libelle,
  valeur,
  longueurMax,
  type = 'text',
  obligatoire = false,
  erreur = null,
  surChangement,
}: ProprietesChamp) {
  const idErreur = `${id}-erreur`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-texte">
        {libelle}
      </label>
      <input
        id={id}
        type={type}
        inputMode={type === 'tel' ? 'tel' : 'text'}
        autoComplete="off"
        maxLength={longueurMax}
        required={obligatoire}
        value={valeur}
        aria-invalid={erreur !== null}
        aria-describedby={erreur !== null ? idErreur : undefined}
        onChange={(evenement) => surChangement(evenement.target.value)}
        className="min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-3 text-sm text-texte"
      />
      {erreur !== null && (
        <p id={idErreur} role="alert" className="m-0 text-xs text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

export function FormulaireSite({ site, actions, surFermer }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idNom = useId()
  const idAdresse = useId()
  const idVille = useId()
  const idTelephone = useId()

  // Ce que la personne tape : on part du site a modifier (ou de champs vides).
  const [nom, setNom] = useState(site?.nom ?? '')
  const [adresse, setAdresse] = useState(site?.adresse ?? '')
  const [ville, setVille] = useState(site?.ville ?? '')
  const [telephone, setTelephone] = useState(site?.telephone ?? '')
  // Les messages d'erreur apparaissent apres le premier essai d'enregistrement.
  const [tentative, setTentative] = useState(false)

  const nomPropre = nom.trim()
  const adressePropre = adresse.trim()
  const villePropre = ville.trim()
  const telephonePropre = telephone.trim()

  const modifie =
    site === null ||
    nomPropre !== site.nom ||
    adressePropre !== (site.adresse ?? '') ||
    villePropre !== (site.ville ?? '') ||
    telephonePropre !== (site.telephone ?? '')

  const erreurNom = tentative && nomPropre === '' ? t('sites.formulaire.nomObligatoire') : null

  async function enregistrer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (nomPropre === '' || !modifie) {
      return
    }

    if (site === null) {
      // Creation : seuls les champs remplis partent.
      const corps: CorpsCreationSite = { nom: nomPropre }
      if (adressePropre !== '') {
        corps.adresse = adressePropre
      }
      if (villePropre !== '') {
        corps.ville = villePropre
      }
      if (telephonePropre !== '') {
        corps.telephone = telephonePropre
      }
      if (await actions.creer(corps)) {
        surFermer()
      }
      return
    }

    // Modification : seuls les champs changes partent ; un champ vide efface la valeur (null).
    const corps: CorpsModificationSite = {}
    if (nomPropre !== site.nom) {
      corps.nom = nomPropre
    }
    if (adressePropre !== (site.adresse ?? '')) {
      corps.adresse = adressePropre === '' ? null : adressePropre
    }
    if (villePropre !== (site.ville ?? '')) {
      corps.ville = villePropre === '' ? null : villePropre
    }
    if (telephonePropre !== (site.telephone ?? '')) {
      corps.telephone = telephonePropre === '' ? null : telephonePropre
    }
    if (await actions.modifier(site.id, corps)) {
      surFermer()
    }
  }

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && actions.erreur !== null) {
    if (actions.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (actions.erreur.statut === 403) {
      messageErreur = t('sites.formulaire.erreurDroits')
    } else {
      messageErreur = t('sites.formulaire.erreur')
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {site === null ? t('sites.formulaire.titreCreation') : t('sites.formulaire.titreModification')}
      </h2>

      <form
        onSubmit={(evenement) => void enregistrer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        <ChampSite
          id={idNom}
          libelle={t('sites.formulaire.nom')}
          valeur={nom}
          longueurMax={LONGUEUR_NOM}
          obligatoire
          erreur={erreurNom}
          surChangement={setNom}
        />
        <ChampSite
          id={idAdresse}
          libelle={`${t('sites.formulaire.adresse')} ${t('sites.formulaire.facultatif')}`}
          valeur={adresse}
          longueurMax={LONGUEUR_ADRESSE}
          surChangement={setAdresse}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <ChampSite
            id={idVille}
            libelle={`${t('sites.formulaire.ville')} ${t('sites.formulaire.facultatif')}`}
            valeur={ville}
            longueurMax={LONGUEUR_VILLE}
            surChangement={setVille}
          />
          <ChampSite
            id={idTelephone}
            libelle={`${t('sites.formulaire.telephone')} ${t('sites.formulaire.facultatif')}`}
            valeur={telephone}
            longueurMax={LONGUEUR_TELEPHONE}
            type="tel"
            surChangement={setTelephone}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={actions.enCours || !modifie}
            aria-busy={actions.enCours}
            className="min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actions.enCours
              ? t('sites.formulaire.enregistrement')
              : site === null
                ? t('sites.formulaire.creer')
                : t('sites.formulaire.enregistrer')}
          </button>
          <button
            type="button"
            disabled={actions.enCours}
            onClick={surFermer}
            className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('sites.formulaire.annuler')}
          </button>
        </div>

        {messageErreur !== null && (
          <p role="alert" className="m-0 text-sm text-erreur">
            {messageErreur}
          </p>
        )}
      </form>
    </section>
  )
}