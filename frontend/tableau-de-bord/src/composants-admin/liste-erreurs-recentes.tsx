import { useId } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { ACTIONS_JOURNAL, type ErreursRecentes } from '../types/suivi-dts'

// Liste des erreurs recentes de l'ecran E19 (vue globale, jour 24), administrateur seulement.
// Il n'existe pas encore de table d'erreurs du serveur (Sentry est prevu au jour 28) :
// une erreur recente est une action d'echec du journal des 7 derniers jours
// (echec de connexion, compte verrouille, e-mail d'invitation ou de reinitialisation non envoye).
// Chaque ligne montre : libelle de l'action, date et heure (en UTC, comme le serveur),
// adresse e-mail concernee et organisation. Le serveur envoie les 20 plus recentes au maximum.
// - action inconnue de cette version : le code est affiche tel quel ;
// - sans adresse (echec sur une adresse inconnue) : texte "sans compte" ;
// - sans organisation : texte "sans organisation".
// Ce composant ne charge rien : la page lui donne erreurs_recentes du hook utiliserVueGlobale.
// Textes : suiviDts.vueGlobale.erreurs.* (titre, description, aucune), suiviDts.journal.actions.<CODE>,
// suiviDts.journal.liste.sansCompte et suiviDts.journal.liste.sansOrganisation (deja ecrits pour le journal).

type Proprietes = {
  erreurs: ErreursRecentes
}

export function ListeErreursRecentes({ erreurs }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

  const formatDate = new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  function libelleAction(action: string): string {
    const connue = ACTIONS_JOURNAL.find((code) => code === action)
    return connue === undefined ? action : t(`suiviDts.journal.actions.${connue}`)
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <div className="flex flex-col gap-1">
        <h2 id={idTitre} className="m-0 font-titre text-lg font-bold text-texte">
          {t('suiviDts.vueGlobale.erreurs.titre')}
        </h2>
        <p className="m-0 text-sm text-texte-secondaire">
          {t('suiviDts.vueGlobale.erreurs.description', { jours: erreurs.jours })}
        </p>
      </div>

      {erreurs.entrees.length === 0 ? (
        <p className="m-0 text-sm text-texte-secondaire">
          {t('suiviDts.vueGlobale.erreurs.aucune', { jours: erreurs.jours })}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {erreurs.entrees.map((erreur) => (
            <li
              key={erreur.id}
              className="flex flex-col gap-1 border-t border-bordure py-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="m-0 break-words text-sm font-semibold text-erreur">
                  {libelleAction(erreur.action)}
                </p>
                <time dateTime={erreur.cree_le} className="text-xs text-texte-secondaire">
                  {formatDate.format(new Date(erreur.cree_le))}
                </time>
              </div>
              <p className="m-0 break-words text-xs text-texte-secondaire">
                {erreur.utilisateur_email ?? t('suiviDts.journal.liste.sansCompte')}
                {' · '}
                {erreur.organisation !== null
                  ? erreur.organisation.nom
                  : t('suiviDts.journal.liste.sansOrganisation')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}