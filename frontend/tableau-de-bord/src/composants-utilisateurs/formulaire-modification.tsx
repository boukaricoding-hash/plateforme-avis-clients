import { useId, useState, type FormEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionsUtilisateurs } from '../hooks/utiliser-utilisateurs'
import type { ErreurService } from '../services/api'
import type { Site } from '../types/sites-points'
import type {
  CorpsModificationUtilisateur,
  RoleInvitable,
  UtilisateurListe,
} from '../types/utilisateurs-admin'

// Formulaire de modification du role et des sites d'un utilisateur (ecran E13, jour 18),
// Responsable seulement. Seuls les champs changes sont envoyes :
// - un Gestionnaire garde au moins un site ;
// - un Responsable n'a pas de sites (il voit toute l'organisation) : on n'envoie alors que le role ;
// - quand un Responsable devient Gestionnaire, ses sites partent avec le role.
// Le changement est immediat : le serveur relit le role a chaque requete.
// Ce composant n'appelle pas l'API : l'enregistrement vient de utiliserListeUtilisateurs.
// La page met key={utilisateur.id} pour repartir de zero quand on change d'utilisateur.

type Proprietes = {
  utilisateur: UtilisateurListe
  // null tant que les sites ne sont pas charges.
  sites: Site[] | null
  erreurSites: ErreurService | null
  actions: ActionsUtilisateurs
  // Appele apres un enregistrement reussi et au clic sur "Annuler" : la page ferme le formulaire.
  surFermer: () => void
}

const CLASSE_BOUTON_PRINCIPAL =
  'min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60'
const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

// Codes d'erreur de PATCH /utilisateurs/:id avec leur propre message.
const CODES_CONNUS = ['SITES_REQUIS', 'SITES_INVALIDES', 'ACTION_SUR_SOI_INTERDITE']

// Deux listes d'identifiants contiennent-elles les memes sites, dans n'importe quel ordre ?
function memesSites(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const autres = new Set(b)
  return a.every((id) => autres.has(id))
}

export function FormulaireModification({
  utilisateur,
  sites,
  erreurSites,
  actions,
  surFermer,
}: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idRole = useId()
  const idErreurSites = useId()

  const sitesDepart = utilisateur.sites.map((site) => site.id)

  // Ce que la personne choisit : on part du role et des sites actuels.
  const [role, setRole] = useState<RoleInvitable>(utilisateur.role)
  const [sitesChoisis, setSitesChoisis] = useState<string[]>(sitesDepart)
  // Les messages d'erreur apparaissent apres le premier essai d'enregistrement.
  const [tentative, setTentative] = useState(false)

  const estGestionnaire = role === 'GESTIONNAIRE'
  const roleChange = role !== utilisateur.role
  // Pour un Responsable, les sites ne comptent pas : seul le role peut changer.
  const sitesChanges = estGestionnaire && !memesSites(sitesChoisis, sitesDepart)
  const modifie = roleChange || sitesChanges

  const erreurSelectionSites =
    tentative && estGestionnaire && sitesChoisis.length === 0
      ? t('utilisateurs.formulaire.siteObligatoire')
      : null

  function basculerSite(id: string, coche: boolean): void {
    setSitesChoisis((avant) => (coche ? [...avant, id] : avant.filter((valeur) => valeur !== id)))
  }

  async function enregistrer(evenement: FormEvent<HTMLFormElement>): Promise<void> {
    evenement.preventDefault()
    setTentative(true)
    if (!modifie) {
      return
    }
    if (estGestionnaire && sitesChoisis.length === 0) {
      return
    }

    // Seuls les champs changes partent. Un Gestionnaire qui change de role ou de sites
    // envoie toujours sa liste de sites complete (le serveur la remplace).
    const corps: CorpsModificationUtilisateur = {}
    if (roleChange) {
      corps.role = role
    }
    if (estGestionnaire && (roleChange || sitesChanges)) {
      corps.site_ids = sitesChoisis
    }
    if (await actions.modifier(utilisateur.id, corps)) {
      surFermer()
    }
  }

  // Le message d'echec ne s'affiche qu'apres un essai dans CE formulaire.
  let messageErreur: string | null = null
  if (tentative && actions.erreur !== null) {
    if (actions.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (CODES_CONNUS.includes(actions.erreur.code)) {
      messageErreur = t(`utilisateurs.modification.erreurs.${actions.erreur.code}`)
    } else if (actions.erreur.statut === 404) {
      messageErreur = t('utilisateurs.modification.erreurs.INTROUVABLE')
    } else if (actions.erreur.statut === 403) {
      messageErreur = t('utilisateurs.modification.erreurs.droits')
    } else {
      messageErreur = t('utilisateurs.modification.erreurs.generique')
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('utilisateurs.modification.titre', { nom: utilisateur.nom })}
      </h2>
      <p className="m-0 mt-1 break-all text-xs text-texte-secondaire">{utilisateur.email}</p>

      <form
        onSubmit={(evenement) => void enregistrer(evenement)}
        noValidate
        className="mt-4 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idRole} className="text-sm font-semibold text-texte">
            {t('utilisateurs.formulaire.role')}
          </label>
          <select
            id={idRole}
            value={role}
            onChange={(evenement) => setRole(evenement.target.value as RoleInvitable)}
            className="min-h-11 w-full rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte"
          >
            <option value="GESTIONNAIRE">{t('utilisateurs.roles.GESTIONNAIRE')}</option>
            <option value="RESPONSABLE">{t('utilisateurs.roles.RESPONSABLE')}</option>
          </select>
          <p className="m-0 text-xs text-texte-secondaire">
            {estGestionnaire
              ? t('utilisateurs.formulaire.aideGestionnaire')
              : t('utilisateurs.formulaire.aideResponsable')}
          </p>
        </div>

        {estGestionnaire && (
          <fieldset
            className="m-0 flex flex-col gap-2 border-0 p-0"
            aria-describedby={erreurSelectionSites !== null ? idErreurSites : undefined}
          >
            <legend className="mb-2 p-0 text-sm font-semibold text-texte">
              {t('utilisateurs.formulaire.sites')}
            </legend>

            {sites === null && erreurSites === null && (
              <p role="status" className="m-0 text-sm text-texte-secondaire">
                {t('utilisateurs.formulaire.chargementSites')}
              </p>
            )}
            {erreurSites !== null && (
              <p role="alert" className="m-0 text-sm text-erreur">
                {t('utilisateurs.formulaire.erreurSites')}
              </p>
            )}
            {sites !== null && sites.length === 0 && (
              <p className="m-0 text-sm text-texte-secondaire">
                {t('utilisateurs.formulaire.aucunSite')}
              </p>
            )}
            {sites?.map((site) => {
              const idSite = `${idRole}-site-${site.id}`
              return (
                <div key={site.id} className="flex min-h-11 items-center gap-3">
                  <input
                    id={idSite}
                    type="checkbox"
                    checked={sitesChoisis.includes(site.id)}
                    onChange={(evenement) => basculerSite(site.id, evenement.target.checked)}
                    className="h-5 w-5 accent-principale"
                  />
                  <label htmlFor={idSite} className="text-sm text-texte">
                    {site.actif
                      ? site.nom
                      : `${site.nom} ${t('utilisateurs.formulaire.siteDesactive')}`}
                  </label>
                </div>
              )
            })}

            {erreurSelectionSites !== null && (
              <p id={idErreurSites} role="alert" className="m-0 text-xs text-erreur">
                {erreurSelectionSites}
              </p>
            )}
          </fieldset>
        )}

        {modifie && (
          <p className="m-0 text-xs text-texte-secondaire">
            {t('utilisateurs.modification.effetImmediat')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={actions.enCours || !modifie}
            aria-busy={actions.enCours}
            className={CLASSE_BOUTON_PRINCIPAL}
          >
            {actions.enCours
              ? t('utilisateurs.modification.enregistrement')
              : t('utilisateurs.modification.enregistrer')}
          </button>
          <button
            type="button"
            disabled={actions.enCours}
            onClick={surFermer}
            className={CLASSE_BOUTON_SECONDAIRE}
          >
            {t('utilisateurs.modification.annuler')}
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