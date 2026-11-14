import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { StatutOrganisation } from '../types/admin'
import type { OrganisationsParStatut, UtilisateursParRole } from '../types/suivi-dts'
import type { RoleUtilisateur } from '../types/utilisateur'
import { formaterNombre } from '../utilitaires/periodes'
import { PastilleStatutOrganisation } from './pastille-statut-organisation'

// Cartes de chiffres de l'ecran E19 (vue globale de la plateforme, jour 24), administrateur seulement :
// - organisations par statut (essai, actif, suspendu) avec leur total ;
// - utilisateurs actifs par role (responsable, gestionnaire, administrateur) avec leur total.
// Les chiffres viennent du serveur : les trois statuts et les trois roles sont toujours presents,
// meme a 0. Un 0 est un vrai zero (rien a cet endroit), pas une absence de donnee.
// Ce composant ne charge rien : la page lui donne les chiffres du hook utiliserVueGlobale.
// Textes : suiviDts.vueGlobale.cartes.* (titres, total) et roles.* (noms des roles, deja en place).
// Le statut est ecrit par PastilleStatutOrganisation (textes admin.organisations.statuts.*).

const STATUTS: readonly StatutOrganisation[] = ['ESSAI', 'ACTIF', 'SUSPENDU']
const ROLES: readonly RoleUtilisateur[] = ['RESPONSABLE', 'GESTIONNAIRE', 'ADMINISTRATEUR']

const CLASSE_CARTE =
  'flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-5 shadow-doux'

type Proprietes = {
  organisations: OrganisationsParStatut
  utilisateurs: UtilisateursParRole
}

type PropsTotal = {
  total: number
}

// Le total en grand, avec son libelle dessous.
function Total({ total }: PropsTotal) {
  const { t, langue } = utiliserLangue()

  return (
    <p className="m-0 flex flex-col">
      <span className="font-titre text-4xl font-bold text-texte">
        {formaterNombre(total, langue, { decimales: 0 })}
      </span>
      <span className="text-sm text-texte-secondaire">{t('suiviDts.vueGlobale.cartes.total')}</span>
    </p>
  )
}

export function CartesVueGlobale({ organisations, utilisateurs }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idOrganisations = useId()
  const idUtilisateurs = useId()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby={idOrganisations} className={CLASSE_CARTE}>
        <h2 id={idOrganisations} className="m-0 font-titre text-lg font-bold text-texte">
          {t('suiviDts.vueGlobale.cartes.organisations')}
        </h2>
        <Total total={organisations.total} />
        <dl className="m-0 flex flex-col gap-2">
          {STATUTS.map((statut) => (
            <div
              key={statut}
              className="flex items-center justify-between gap-3 border-t border-bordure pt-2"
            >
              <dt>
                <PastilleStatutOrganisation statut={statut} />
              </dt>
              <dd className="m-0 text-base font-semibold text-texte">
                {formaterNombre(organisations.par_statut[statut], langue, { decimales: 0 })}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={idUtilisateurs} className={CLASSE_CARTE}>
        <h2 id={idUtilisateurs} className="m-0 font-titre text-lg font-bold text-texte">
          {t('suiviDts.vueGlobale.cartes.utilisateurs')}
        </h2>
        <Total total={utilisateurs.total} />
        <dl className="m-0 flex flex-col gap-2">
          {ROLES.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between gap-3 border-t border-bordure pt-2"
            >
              <dt className="text-sm text-texte">{t(`roles.${role}`)}</dt>
              <dd className="m-0 text-base font-semibold text-texte">
                {formaterNombre(utilisateurs.par_role[role], langue, { decimales: 0 })}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}