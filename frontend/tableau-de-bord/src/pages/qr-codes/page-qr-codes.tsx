import { useEffect, useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { Navigate } from 'react-router'
import { BoutonTelecharger } from '../../composants-qr/bouton-telecharger'
import { CarteQr } from '../../composants-qr/carte-qr'
import { LigneQrListe } from '../../composants-qr/ligne-qr'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserQrCodes } from '../../hooks/utiliser-qr-codes'
import type { ErreurService } from '../../services/api'
import { adressePlanche } from '../../services/qr-codes'
import { LIMITE_PLANCHE } from '../../types/qr-codes'
import '../../styles/qr-codes.css'

// Ecran E11 : QR codes et chevalets (jour 17), dessin de la page des annees scolaires.
// - A gauche, la carte d'honneur : le QR code du point selectionne (apercu, chiffres, formats de
//   telechargement a la demande, regeneration).
// - A droite, la timeline des points de contact. Un clic sur une ligne la selectionne. Revoquer ou
//   regenerer (Responsable seulement) remplace la liste par une confirmation, comme le formulaire
//   de la page des annees scolaires ; l'action se voit : voile sur l'apercu, loader sur le bouton.
// - En bas : les consignes d'impression. Toute la page tient dans la hauteur du cadre (100vh),
//   seule la liste defile.
// - La planche A4 reunit les chevalets des points actifs et non revoques (tous les sites, ou
//   celui du filtre). Limitee a 200 chevalets : le bouton est inactif et le resume l'explique.
// - Chaque telechargement et chaque action se termine par un avis en bas a droite.
// - L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// La page n'appelle pas l'API : tout vient de utiliserQrCodes et du service de telechargement.

type TypeAction = 'revoquer' | 'regenerer'

type Confirmation = {
  pointId: string
  type: TypeAction
  // Vrai des que l'utilisateur a clique sur Confirmer : seule une erreur de CETTE tentative s'affiche.
  tentee: boolean
}

type Avis = {
  id: number
  genre: 'succes' | 'erreur'
  message: string
}

// Temps pendant lequel l'avis en bas a droite reste affiche.
const DUREE_AVIS_MS = 3600

function IconeAlerte() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  )
}

function IconeAvis({ genre }: { genre: Avis['genre'] }) {
  return (
    <svg
      className="qr-coche"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {genre === 'succes' ? (
        <polyline points="5 12.5 10 17.5 19 7.5" />
      ) : (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </>
      )}
    </svg>
  )
}

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

  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [avis, setAvis] = useState<Avis | null>(null)

  // L'avis en bas a droite disparait tout seul.
  useEffect(() => {
    if (avis === null) {
      return
    }
    const minuterie = window.setTimeout(() => setAvis(null), DUREE_AVIS_MS)
    return () => window.clearTimeout(minuterie)
  }, [avis])

  // L'administrateur DTS n'a pas d'organisation : rien a afficher ici.
  if (acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  function afficherAvis(genre: Avis['genre'], message: string): void {
    // Le numero change a chaque avis : l'animation d'entree repart meme pour deux avis identiques.
    setAvis((ancien) => ({ id: (ancien?.id ?? 0) + 1, genre, message }))
  }

  // Le point selectionne : celui choisi, sinon le premier de la page.
  const ligneSelectionnee =
    lignes === null
      ? null
      : (lignes.find((ligne) => ligne.point.id === selectionId) ??
        lignesPage[0] ??
        lignes[0] ??
        null)

  const ligneConfirmation =
    confirmation !== null && lignes !== null
      ? (lignes.find((ligne) => ligne.point.id === confirmation.pointId) ?? null)
      : null

  // Point sur lequel une action est en cours (revoquer ou regenerer), sinon aucun.
  function actionEnCoursPour(pointId: string): TypeAction | null {
    if (revocation.enCours && confirmation !== null && confirmation.pointId === pointId) {
      return confirmation.type
    }
    return null
  }

  function selectionner(pointId: string): void {
    if (revocation.enCours) {
      return
    }
    setSelectionId(pointId)
    setConfirmation(null)
  }

  function ouvrirConfirmation(pointId: string, type: TypeAction): void {
    if (revocation.enCours) {
      return
    }
    setSelectionId(pointId)
    setConfirmation({ pointId, type, tentee: false })
  }

  function annulerConfirmation(): void {
    if (!revocation.enCours) {
      setConfirmation(null)
    }
  }

  async function confirmerAction(): Promise<void> {
    if (confirmation === null) {
      return
    }
    const regenerer = confirmation.type === 'regenerer'
    setConfirmation({ ...confirmation, tentee: true })
    const reussi = await revocation.changer(confirmation.pointId, regenerer)
    if (reussi) {
      setConfirmation(null)
      afficherAvis(
        'succes',
        regenerer ? t('qrCodes.carte.succesRegenere') : t('qrCodes.carte.succesRevoque'),
      )
    }
  }

  function changerSite(id: string): void {
    setConfirmation(null)
    choisirSite(id)
  }

  function apresTelechargement(nomFichier: string): void {
    afficherAvis('succes', t('qrCodes.telechargement.succes', { nom: nomFichier }))
  }

  function apresEchecTelechargement(erreurService: ErreurService): void {
    let message = t('qrCodes.telechargement.erreur')
    if (erreurService.statut === 0) {
      message = t('commun.erreurReseau')
    } else if (erreurService.statut === 409) {
      message = t('qrCodes.telechargement.erreurRevoque')
    }
    afficherAvis('erreur', message)
  }

  // Erreur de la derniere tentative de revocation ou de regeneration, sur le point en confirmation.
  let messageErreurAction: string | null = null
  if (
    confirmation !== null &&
    confirmation.tentee &&
    !revocation.enCours &&
    revocation.erreur !== null &&
    revocation.pointId === confirmation.pointId
  ) {
    if (revocation.erreur.statut === 0) {
      messageErreurAction = t('commun.erreurReseau')
    } else if (revocation.erreur.statut === 403) {
      messageErreurAction = t('qrCodes.carte.erreurDroits')
    } else if (revocation.erreur.statut === 404) {
      messageErreurAction = t('qrCodes.carte.erreurIntrouvable')
    } else {
      messageErreurAction = t('qrCodes.carte.erreur')
    }
  }

  // Message du resume : ce que contient la planche, ou pourquoi elle est impossible.
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

  const optionsPlanche = [
    {
      cle: 'planche',
      libelle: t('qrCodes.planche'),
      libelleAccessible: t('qrCodes.planche'),
      adresse: adressePlanche(filtreSite === '' ? undefined : filtreSite),
      nomParDefaut: 'planche-chevalets.pdf',
    },
  ]

  return (
    <div className="qr-page">
      <header className="qr-entete">
        <div>
          <h1 className="qr-titre">{t('qrCodes.titre')}</h1>
          <p className="qr-soustitre">
            {peutModifier ? t('qrCodes.sousTitre') : t('qrCodes.sousTitreGestionnaire')}
          </p>

          {lignes !== null && (
            <div className="qr-resume">
              <span>{t('qrCodes.nombrePoints', { nombre: String(lignes.length) })}</span>
              <span className="qr-resume-sep" aria-hidden="true">
                ·
              </span>
              <span>{messagePlanche}</span>
            </div>
          )}
        </div>

        <div className="qr-entete-actions">
          {sites !== null && sites.length > 1 && (
            <div className="qr-filtre">
              <label htmlFor={idFiltre}>{t('qrCodes.filtreSite')}</label>
              <select
                id={idFiltre}
                value={filtreSite}
                disabled={revocation.enCours}
                onChange={(evenement) => changerSite(evenement.target.value)}
              >
                <option value="">{t('qrCodes.tousLesSites')}</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.actif ? site.nom : `${site.nom} (${t('sites.statutInactif')})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-40 shrink-0">
            <BoutonTelecharger
              libelle={t('qrCodes.planche')}
              options={optionsPlanche}
              desactive={!planchePossible}
              surSucces={apresTelechargement}
              surEchec={apresEchecTelechargement}
            />
          </div>
        </div>
      </header>

      <div className="qr-corps">
        {/* Colonne de gauche : la carte d'honneur du QR selectionne */}
        <div className="qr-colonne-carte">
          {chargement && (
            <div className="qr-carte-principale" aria-hidden="true">
              <div className="qr-apercu-cadre">
                <span className="qr-apercu-squelette" />
              </div>
            </div>
          )}
          {ligneSelectionnee !== null && (
            <CarteQr
              key={ligneSelectionnee.point.id}
              ligne={ligneSelectionnee}
              peutModifier={peutModifier}
              versionQr={versionsQr[ligneSelectionnee.point.id] ?? 0}
              actionEnCours={actionEnCoursPour(ligneSelectionnee.point.id)}
              surRegenerer={() => ouvrirConfirmation(ligneSelectionnee.point.id, 'regenerer')}
              surTelecharge={apresTelechargement}
              surEchecTelechargement={apresEchecTelechargement}
            />
          )}
        </div>

        {/* Colonne de droite : la timeline, ou la confirmation a sa place */}
        <div className="qr-colonne-liste">
          {confirmation !== null && ligneConfirmation !== null ? (
            <div className="qr-panneau qr-panneau-anime" key="confirmation">
              <h2 className="qr-section-titre">
                {confirmation.type === 'regenerer'
                  ? t('qrCodes.carte.regenerer')
                  : t('qrCodes.carte.revoquer')}
              </h2>

              <div
                className={`qr-confirmation${messageErreurAction !== null ? ' qr-confirmation--erreur' : ''}`}
              >
                <span className="qr-confirmation-icone qr-confirmation-icone--danger">
                  <IconeAlerte />
                </span>
                <p className="qr-confirmation-texte">
                  {confirmation.type === 'regenerer'
                    ? t('qrCodes.carte.confirmationRegenerer', { nom: ligneConfirmation.point.nom })
                    : t('qrCodes.carte.confirmationRevoquer', { nom: ligneConfirmation.point.nom })}
                </p>

                {messageErreurAction !== null && (
                  <div role="alert" className="qr-erreur-formulaire">
                    {messageErreurAction}
                  </div>
                )}

                <div className="qr-confirmation-actions">
                  <button
                    type="button"
                    className="qr-bouton-texte"
                    disabled={revocation.enCours}
                    onClick={annulerConfirmation}
                  >
                    {t('qrCodes.carte.annuler')}
                  </button>
                  <button
                    type="button"
                    className={`qr-bouton-danger${revocation.enCours ? ' qr-bouton--occupe' : ''}`}
                    disabled={revocation.enCours}
                    aria-busy={revocation.enCours}
                    onClick={() => void confirmerAction()}
                  >
                    {revocation.enCours && <span className="qr-spinner" aria-hidden="true" />}
                    {revocation.enCours
                      ? t('qrCodes.carte.enCours')
                      : confirmation.type === 'regenerer'
                        ? t('qrCodes.carte.confirmerRegenerer')
                        : t('qrCodes.carte.confirmerRevoquer')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="qr-panneau qr-panneau-anime" key="liste">
              <h2 className="qr-section-titre">{t('qrCodes.liste')}</h2>

              {chargement && (
                <>
                  <p className="sr-only" role="status">
                    {t('qrCodes.chargement')}
                  </p>
                  <div className="qr-liste" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((numero) => (
                      <div
                        key={numero}
                        className="qr-squelette-ligne"
                        style={{ animationDelay: `${numero * 120}ms` } as CSSProperties}
                      />
                    ))}
                  </div>
                </>
              )}

              {erreur !== null && lignes === null && (
                <div className="qr-confirmation">
                  <div role="alert" className="qr-erreur-formulaire">
                    {erreur.statut === 0 ? t('commun.erreurReseau') : t('qrCodes.erreur')}
                  </div>
                  <button type="button" className="qr-bouton-secondaire" onClick={recharger}>
                    {t('commun.reessayer')}
                  </button>
                </div>
              )}

              {lignes !== null && lignes.length === 0 && (
                <p className="qr-vide">{t('qrCodes.aucunPoint')}</p>
              )}

              {lignes !== null && lignes.length > 0 && (
                <>
                  <div className="qr-liste qr-liste--timeline">
                    {lignesPage.map((ligne, index) => (
                      <LigneQrListe
                        key={ligne.point.id}
                        ligne={ligne}
                        index={index}
                        selectionnee={ligneSelectionnee?.point.id === ligne.point.id}
                        occupee={actionEnCoursPour(ligne.point.id) !== null}
                        peutModifier={peutModifier}
                        surSelectionner={() => selectionner(ligne.point.id)}
                        surRevoquer={() => ouvrirConfirmation(ligne.point.id, 'revoquer')}
                        surRegenerer={() => ouvrirConfirmation(ligne.point.id, 'regenerer')}
                      />
                    ))}
                  </div>

                  {nbPages > 1 && (
                    <nav aria-label={t('qrCodes.pagination')} className="qr-pagination">
                      <button
                        type="button"
                        className="qr-bouton-texte"
                        disabled={pageCourante <= 0}
                        onClick={() => allerPage(pageCourante - 1)}
                      >
                        {t('qrCodes.pagePrecedente')}
                      </button>
                      <span>
                        {t('qrCodes.pageSur', {
                          page: String(pageCourante + 1),
                          pages: String(nbPages),
                        })}
                      </span>
                      <button
                        type="button"
                        className="qr-bouton-texte"
                        disabled={pageCourante >= nbPages - 1}
                        onClick={() => allerPage(pageCourante + 1)}
                      >
                        {t('qrCodes.pageSuivante')}
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Consignes d'impression : bloc compact, toujours visible */}
      <section className="qr-info" aria-label={t('qrCodes.consigne.titre')}>
        <span className="qr-info-icone" aria-hidden="true">
          i
        </span>
        <div className="qr-info-texte">
          <strong>{t('qrCodes.consigne.titre')}</strong>
          <ul className="qr-info-liste">
            <li>{t('qrCodes.consigne.taille')}</li>
            <li>{t('qrCodes.consigne.contraste')}</li>
            <li>{t('qrCodes.consigne.support')}</li>
          </ul>
        </div>
      </section>

      {/* Avis de fin d'action : telechargement, revocation ou regeneration */}
      {avis !== null && (
        <div
          key={avis.id}
          role={avis.genre === 'erreur' ? 'alert' : 'status'}
          className={`qr-toast${avis.genre === 'erreur' ? ' qr-toast--erreur' : ''}`}
        >
          <span className="qr-toast-icone">
            <IconeAvis genre={avis.genre} />
          </span>
          {avis.message}
        </div>
      )}
    </div>
  )
}