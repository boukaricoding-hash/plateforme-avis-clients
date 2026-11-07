import { useId } from 'react'
import { Navigate } from 'react-router'
import { CarteQr } from '../../composants-qr/carte-qr'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserQrCodes } from '../../hooks/utiliser-qr-codes'
import type { ErreurService } from '../../services/api'
import { adressePlanche } from '../../services/qr-codes'
import { LIMITE_PLANCHE } from '../../types/qr-codes'

// Ecran E11 : QR codes et chevalets (jour 17).
// - Le Responsable et le Gestionnaire voient les QR codes de leurs points de contact, avec les
//   scans, les avis et le taux de conversion, et telechargent PNG, SVG, PDF A6, PDF A5.
// - Le Responsable seul revoque ou regenere un QR code (boutons caches pour le Gestionnaire).
// - La planche A4 reunit les chevalets des points actifs et non revoques (tous les sites, ou
//   celui du filtre). Elle est limitee a 200 chevalets : le bouton est inactif et un message
//   l'explique si le serveur la refuserait (aucun point, ou trop de points).
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserQrCodes. Les telechargements sont de
// simples liens, le navigateur envoie le cookie de session tout seul.

type PropsEchec = {
  erreur: ErreurService
  surReessayer: () => void
}

// Echec du chargement : pas de reseau (statut 0) ou erreur generale, avec "Reessayer".
function BlocEchec({ erreur, surReessayer }: PropsEchec) {
  const { t } = utiliserLangue()

  return (
    <div className="rounded-lg border border-bordure bg-surface p-5 shadow-doux">
      <p role="alert" className="m-0 text-sm text-erreur">
        {erreur.statut === 0 ? t('commun.erreurReseau') : t('qrCodes.erreur')}
      </p>
      <button
        type="button"
        onClick={surReessayer}
        className="mt-3 min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond"
      >
        {t('commun.reessayer')}
      </button>
    </div>
  )
}

const CLASSE_BOUTON =
  'inline-flex min-h-11 items-center rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte no-underline transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

export function PageQrCodes() {
  const { t } = utiliserLangue()
  const idFiltre = useId()
  const {
    acces,
    peutModifier,
    sites,
    filtreSite,
    choisirSite,
    lignes,
    lignesPage,
    chargement,
    erreur,
    pageCourante,
    nbPages,
    allerPage,
    nbPointsPlanche,
    planchePossible,
    recharger,
    versionsQr,
    revocation,
  } = utiliserQrCodes()

  // L'administrateur DTS n'a pas d'organisation : rien a afficher ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  // Message sous le bouton de la planche : ce qu'elle contient, ou pourquoi elle est impossible.
  let messagePlanche = ''
  if (lignes !== null) {
    if (nbPointsPlanche === 0) {
      messagePlanche = t('qrCodes.plancheAucun')
    } else if (nbPointsPlanche > LIMITE_PLANCHE) {
      messagePlanche = t('qrCodes.plancheTrop', {
        nombre: String(nbPointsPlanche),
        limite: String(LIMITE_PLANCHE),
      })
    } else {
      messagePlanche = t('qrCodes.plancheAide', { nombre: String(nbPointsPlanche) })
    }
  }

  const adresseDeLaPlanche = adressePlanche(filtreSite === '' ? undefined : filtreSite)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('qrCodes.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">
          {peutModifier ? t('qrCodes.sousTitre') : t('qrCodes.sousTitreGestionnaire')}
        </p>
      </header>

      {/* Consigne d'impression : toujours visible */}
      <section
        aria-label={t('qrCodes.consigne.titre')}
        className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
      >
        <h2 className="m-0 font-titre text-base font-bold text-texte">
          {t('qrCodes.consigne.titre')}
        </h2>
        <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-texte-secondaire">
          <li>{t('qrCodes.consigne.taille')}</li>
          <li>{t('qrCodes.consigne.contraste')}</li>
          <li>{t('qrCodes.consigne.support')}</li>
        </ul>
      </section>

      {/* Filtre par site et planche A4 */}
      <section
        aria-label={t('qrCodes.planche')}
        className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
      >
        {sites !== null && sites.length > 1 ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={idFiltre} className="text-sm font-semibold text-texte">
              {t('qrCodes.filtreSite')}
            </label>
            <select
              id={idFiltre}
              value={filtreSite}
              onChange={(evenement) => choisirSite(evenement.target.value)}
              className="min-h-11 w-full min-w-56 rounded-md border border-bordure-champ bg-fond px-2 text-sm text-texte"
            >
              <option value="">{t('qrCodes.tousLesSites')}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.actif ? site.nom : `${site.nom} (${t('sites.statutInactif')})`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-col items-start gap-1 sm:items-end">
          {planchePossible ? (
            <a
              href={adresseDeLaPlanche}
              download
              aria-describedby={`${idFiltre}-planche`}
              className={CLASSE_BOUTON}
            >
              {t('qrCodes.planche')}
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-describedby={`${idFiltre}-planche`}
              className={CLASSE_BOUTON}
            >
              {t('qrCodes.planche')}
            </button>
          )}
          <p id={`${idFiltre}-planche`} className="m-0 text-sm text-texte-secondaire">
            {messagePlanche}
          </p>
        </div>
      </section>

      {/* Chargement et echec */}
      {chargement && (
        <p role="status" className="m-0 text-sm text-texte-secondaire">
          {t('qrCodes.chargement')}
        </p>
      )}
      {erreur !== null && lignes === null && <BlocEchec erreur={erreur} surReessayer={recharger} />}

      {/* Liste des QR codes */}
      {lignes !== null && lignes.length === 0 && (
        <p className="m-0 rounded-lg border border-bordure bg-surface p-5 text-sm text-texte-secondaire shadow-doux">
          {t('qrCodes.aucunPoint')}
        </p>
      )}

      {lignes !== null && lignes.length > 0 && (
        <>
          <p role="status" className="m-0 text-sm text-texte-secondaire">
            {t('qrCodes.nombrePoints', { nombre: String(lignes.length) })}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {lignesPage.map((ligne) => (
              <CarteQr
                key={ligne.point.id}
                ligne={ligne}
                peutModifier={peutModifier}
                versionQr={versionsQr[ligne.point.id] ?? 0}
                revocation={revocation}
              />
            ))}
          </div>

          {nbPages > 1 && (
            <nav
              aria-label={t('qrCodes.pagination')}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <button
                type="button"
                disabled={pageCourante <= 0}
                onClick={() => allerPage(pageCourante - 1)}
                className={CLASSE_BOUTON}
              >
                {t('qrCodes.pagePrecedente')}
              </button>
              <span className="text-sm text-texte-secondaire">
                {t('qrCodes.pageSur', {
                  page: String(pageCourante + 1),
                  pages: String(nbPages),
                })}
              </span>
              <button
                type="button"
                disabled={pageCourante >= nbPages - 1}
                onClick={() => allerPage(pageCourante + 1)}
                className={CLASSE_BOUTON}
              >
                {t('qrCodes.pageSuivante')}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}