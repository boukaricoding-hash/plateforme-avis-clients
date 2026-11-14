import { useId, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { FormulaireSecteur } from '../../../composants-admin/formulaire-secteur'
import { ListeThemesSecteur } from '../../../composants-admin/liste-themes-secteur'
import { ModelesSecteur } from '../../../composants-admin/modeles-secteur'
import { utiliserLangue } from '../../../hooks/utiliser-langue'
import { utiliserSecteursAdmin } from '../../../hooks/utiliser-secteurs-admin'
import type { ErreurService } from '../../../services/api'
import type { VocabulaireSecteur } from '../../../types/admin'

// Ecran E18 : modeles sectoriels (jour 23), administrateur DTS seulement.
// - liste des secteurs en cartes (actifs ou non), avec leurs nombres de themes et d'organisations ;
//   la derniere carte, en pointilles, ouvre la creation d'un secteur ;
// - le secteur choisi : resume (code, etat, vocabulaire, indicateurs suggeres), modification,
//   themes (ajout et modification) et questionnaires types en lecture seule ;
// - apres la creation d'un secteur, un lien mene a l'ecran E17 pour creer une organisation de ce
//   secteur (aucun changement de code n'est necessaire pour ajouter un secteur).
// Les autres roles n'ont rien a faire ici : ils sont renvoyes a l'accueil (le serveur refuse
// aussi avec 403).
// La page n'appelle pas l'API : tout vient de utiliserSecteursAdmin.

// Ce que montre le panneau sous la liste : rien, la creation d'un secteur ou la modification du secteur choisi.
type Panneau = { type: 'aucun' } | { type: 'creation' } | { type: 'modification' }

const CLASSE_GRILLE = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]'

const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

type PropsEchec = {
  erreur: ErreurService
  surReessayer: () => void
}

// Echec du chargement : pas de reseau (statut 0), droits refuses ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  let message: string
  if (erreur.statut === 0) {
    message = t('commun.erreurReseau')
  } else if (erreur.statut === 403) {
    message = t('admin.secteurs.page.erreurDroits')
  } else {
    message = t('admin.secteurs.page.erreur')
  }

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {message}
      </p>
      <button type="button" onClick={surReessayer} className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}>
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

// Petite pastille : secteur actif ou desactive.
function PastilleEtat({ actif }: { actif: boolean }) {
  const { t } = utiliserLangue()

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
        actif
          ? 'border-principale text-principale'
          : 'border-bordure-champ text-texte-secondaire'
      }`}
    >
      {actif ? t('admin.secteurs.page.actif') : t('admin.secteurs.page.inactif')}
    </span>
  )
}

// Le vocabulaire en une ligne : cle -> mot.
function resumerVocabulaire(vocabulaire: VocabulaireSecteur): string {
  return Object.entries(vocabulaire)
    .map(([cle, mot]) => `${cle} → ${mot}`)
    .join(' · ')
}

export function PageModelesSectoriels() {
  const { t, langue } = utiliserLangue()
  const idTitreListe = useId()
  const {
    acces,
    secteurs,
    chargement,
    erreur,
    secteurChoisiId,
    choisirSecteur,
    detail,
    chargementDetail,
    erreurDetail,
    modeles,
    chargementModeles,
    erreurModeles,
    recharger,
    creation,
    actions,
  } = utiliserSecteursAdmin()

  const [panneau, setPanneau] = useState<Panneau>({ type: 'aucun' })
  // Nom du secteur qui vient d'etre cree (pour le message et le lien vers E17) ; null = aucun message.
  const [secteurCree, setSecteurCree] = useState<{ nom_fr: string; nom_en: string } | null>(null)

  // Les autres roles n'ont rien a gerer ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function ouvrirCreation(): void {
    creation.reinitialiser()
    setSecteurCree(null)
    setPanneau({ type: 'creation' })
  }

  function ouvrirModification(): void {
    actions.reinitialiser()
    setSecteurCree(null)
    setPanneau({ type: 'modification' })
  }

  function fermerPanneau(): void {
    creation.reinitialiser()
    actions.reinitialiser()
    setPanneau({ type: 'aucun' })
  }

  function choisir(id: string): void {
    setSecteurCree(null)
    actions.reinitialiser()
    if (id !== secteurChoisiId || panneau.type === 'creation') {
      setPanneau({ type: 'aucun' })
    }
    choisirSecteur(id)
  }

  function fermerDetail(): void {
    setSecteurCree(null)
    actions.reinitialiser()
    setPanneau({ type: 'aucun' })
    choisirSecteur(null)
  }

  const nomSecteur = (nomFr: string, nomEn: string): string => (langue === 'en' ? nomEn : nomFr)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('admin.secteurs.page.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">{t('admin.secteurs.page.sousTitre')}</p>
      </header>

      {panneau.type === 'creation' && (
        <FormulaireSecteur
          mode="creation"
          enCours={creation.enCours}
          erreur={creation.erreur}
          succes={creation.succes}
          surEnvoyer={async (corps) => {
            const nouveau = await creation.creer(corps)
            if (nouveau === null) {
              return false
            }
            setSecteurCree({ nom_fr: nouveau.nom_fr, nom_en: nouveau.nom_en })
            setPanneau({ type: 'aucun' })
            return true
          }}
          surFermer={fermerPanneau}
        />
      )}

      {secteurCree !== null && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-bordure bg-surface p-4 shadow-doux"
        >
          <p className="m-0 text-sm text-succes">
            {t('admin.secteurs.page.secteurCree', {
              nom: nomSecteur(secteurCree.nom_fr, secteurCree.nom_en),
            })}
          </p>
          <Link
            to="/admin/organisations"
            className="inline-flex min-h-11 items-center rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce"
          >
            {t('admin.secteurs.page.creerOrganisation')}
          </Link>
        </div>
      )}

      {chargement && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('admin.secteurs.page.chargement')}
        </p>
      )}
      {erreur !== null && secteurs === null && (
        <BlocEchec erreur={erreur} surReessayer={recharger} />
      )}

      {secteurs !== null && (
        <section aria-labelledby={idTitreListe}>
          <h2 id={idTitreListe} className="m-0 font-titre text-lg font-bold text-texte">
            {t('admin.secteurs.page.liste.titre', { nombre: secteurs.length })}
          </h2>

          {secteurs.length === 0 && (
            <p className="m-0 mt-2 text-sm text-texte-secondaire">
              {t('admin.secteurs.page.liste.vide')}
            </p>
          )}

          <div className={`mt-3 ${CLASSE_GRILLE}`}>
            {secteurs.map((secteur) => {
              const choisi = secteur.id === secteurChoisiId
              return (
                <button
                  key={secteur.id}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => choisir(secteur.id)}
                  className={`flex min-h-32 flex-col gap-2 rounded-2xl border p-4 text-left transition-colors ${
                    choisi
                      ? 'border-principale bg-surface shadow-doux'
                      : 'border-bordure bg-surface-douce hover:border-principale'
                  }`}
                >
                  <span className="break-words font-titre text-base font-bold text-texte">
                    {nomSecteur(secteur.nom_fr, secteur.nom_en)}
                  </span>
                  <span className="break-words text-xs text-texte-secondaire">{secteur.code}</span>
                  <PastilleEtat actif={secteur.actif} />
                  <span className="mt-auto text-xs text-texte-secondaire">
                    {t('admin.secteurs.page.carte.compteurs', {
                      themes: secteur.nombre_themes,
                      organisations: secteur.nombre_organisations,
                    })}
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={ouvrirCreation}
              className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bordure-forte p-6 text-texte-secondaire transition-colors hover:border-principale hover:bg-surface hover:text-principale"
            >
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full bg-accent-fond text-principale"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-sm font-semibold">{t('admin.secteurs.page.nouveau')}</span>
            </button>
          </div>
        </section>
      )}

      {secteurChoisiId !== null && (
        <div className="flex flex-col gap-6">
          {chargementDetail && (
            <p role="status" className="m-0 text-sm text-texte-secondaire">
              {t('admin.secteurs.page.chargementDetail')}
            </p>
          )}
          {erreurDetail !== null && <BlocEchec erreur={erreurDetail} surReessayer={recharger} />}

          {detail !== null && (
            <>
              <section
                aria-label={nomSecteur(detail.nom_fr, detail.nom_en)}
                className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="m-0 break-words font-titre text-xl font-bold text-texte">
                      {nomSecteur(detail.nom_fr, detail.nom_en)}
                    </h2>
                    <p className="m-0 break-words text-xs text-texte-secondaire">{detail.code}</p>
                    <PastilleEtat actif={detail.actif} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={panneau.type === 'modification'}
                      onClick={ouvrirModification}
                      className={CLASSE_BOUTON_SECONDAIRE}
                    >
                      {t('admin.secteurs.page.modifier')}
                    </button>
                    <button type="button" onClick={fermerDetail} className={CLASSE_BOUTON_SECONDAIRE}>
                      {t('admin.secteurs.page.fermer')}
                    </button>
                  </div>
                </div>

                <p className="m-0 break-words text-sm text-texte-secondaire">
                  {t('admin.secteurs.page.vocabulaire', {
                    liste: resumerVocabulaire(detail.vocabulaire),
                  })}
                </p>
                <p className="m-0 break-words text-sm text-texte-secondaire">
                  {detail.indicateurs_suggeres.length === 0
                    ? t('admin.secteurs.page.aucunIndicateur')
                    : t('admin.secteurs.page.indicateurs', {
                        liste: detail.indicateurs_suggeres.join(', '),
                      })}
                </p>
              </section>

              {panneau.type === 'modification' && (
                <FormulaireSecteur
                  key={detail.id}
                  mode="modification"
                  secteur={detail}
                  enCours={actions.enCours}
                  erreur={actions.erreur}
                  succes={actions.succes}
                  surEnvoyer={(corps) => actions.modifier(detail.id, corps)}
                  surFermer={fermerPanneau}
                />
              )}

              <ListeThemesSecteur
                key={detail.id}
                themes={detail.themes}
                enCours={actions.enCours}
                erreur={actions.erreur}
                surCreer={(corps) => actions.creerTheme(detail.id, corps)}
                surModifier={(themeId, corps) => actions.modifierTheme(detail.id, themeId, corps)}
                surReinitialiser={actions.reinitialiser}
              />

              <ModelesSecteur
                modeles={modeles}
                chargement={chargementModeles}
                erreur={erreurModeles}
                surReessayer={recharger}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}