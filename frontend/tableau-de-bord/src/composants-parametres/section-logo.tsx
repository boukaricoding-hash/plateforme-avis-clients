import { useId, useRef, type ChangeEvent } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtatLogo, ErreurLogo } from '../hooks/utiliser-parametres'
import { TYPES_LOGO_ACCEPTES, type ParametresOrganisation } from '../types/parametres'

// Section "Logo" de l'ecran E14 (parametres de l'organisation, jour 16), Responsable seulement.
// - apercu du logo actuel, ou un message s'il n'y en a pas ;
// - un bouton pour choisir un fichier (PNG, JPEG ou WebP, 1 Mo au plus) : l'envoi part tout de suite ;
// - un bouton pour retirer le logo (seulement s'il y en a un).
// Ce composant n'appelle pas l'API : les actions et leur etat viennent de utiliserParametres.
// La verification du format et de la taille est faite par le hook avant l'envoi.

type Proprietes = {
  parametres: ParametresOrganisation
  etat: EtatLogo
}

// Cle du texte d'erreur pour chaque raison d'echec.
const CLES_ERREUR: Record<ErreurLogo, string> = {
  format: 'parametres.logo.erreurFormat',
  taille: 'parametres.logo.erreurTaille',
  envoi: 'parametres.logo.erreurEnvoi',
  retrait: 'parametres.logo.erreurRetrait',
}

export function SectionLogo({ parametres, etat }: Proprietes) {
  const { t } = utiliserLangue()
  const idTitre = useId()
  const idFormats = useId()
  const champFichierRef = useRef<HTMLInputElement>(null)

  const aUnLogo = parametres.logo_url !== null
  const occupe = etat.enCours !== null

  async function surChoixFichier(evenement: ChangeEvent<HTMLInputElement>): Promise<void> {
    const champ = evenement.target
    const fichier = champ.files?.[0]
    // On vide le champ : choisir deux fois le meme fichier relance bien l'envoi.
    champ.value = ''
    if (fichier === undefined) {
      return
    }
    await etat.envoyer(fichier)
  }

  // Message annonce aux lecteurs d'ecran : action en cours ou reussie.
  function messageEtat(): string {
    if (etat.enCours === 'envoi') {
      return t('parametres.logo.envoiEnCours')
    }
    if (etat.enCours === 'retrait') {
      return t('parametres.logo.retraitEnCours')
    }
    if (etat.succes === 'envoi') {
      return t('parametres.logo.succesEnvoi')
    }
    if (etat.succes === 'retrait') {
      return t('parametres.logo.succesRetrait')
    }
    return ''
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('parametres.logo.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">{t('parametres.logo.description')}</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Apercu : fond clair fixe pour que les logos sombres restent lisibles dans les deux themes */}
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border border-bordure bg-white p-3 sm:w-48 sm:shrink-0">
          {parametres.logo_url !== null ? (
            <img
              src={parametres.logo_url}
              alt={t('parametres.logo.apercu', { nom: parametres.nom })}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="text-center text-sm text-neutral-600">{t('parametres.logo.aucun')}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {/* Champ fichier cache : le bouton visible l'ouvre */}
            <input
              ref={champFichierRef}
              type="file"
              accept={TYPES_LOGO_ACCEPTES.join(',')}
              onChange={(evenement) => void surChoixFichier(evenement)}
              aria-describedby={idFormats}
              aria-label={aUnLogo ? t('parametres.logo.remplacer') : t('parametres.logo.choisir')}
              tabIndex={-1}
              className="sr-only"
            />
            <button
              type="button"
              disabled={occupe}
              aria-busy={etat.enCours === 'envoi'}
              onClick={() => champFichierRef.current?.click()}
              className="min-h-11 rounded-md bg-principale px-4 text-sm font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
            >
              {etat.enCours === 'envoi'
                ? t('parametres.logo.envoiEnCours')
                : aUnLogo
                  ? t('parametres.logo.remplacer')
                  : t('parametres.logo.choisir')}
            </button>

            {aUnLogo && (
              <button
                type="button"
                disabled={occupe}
                aria-busy={etat.enCours === 'retrait'}
                onClick={() => void etat.retirer()}
                className="min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60"
              >
                {etat.enCours === 'retrait'
                  ? t('parametres.logo.retraitEnCours')
                  : t('parametres.logo.retirer')}
              </button>
            )}
          </div>

          <p id={idFormats} className="m-0 text-xs text-texte-secondaire">
            {t('parametres.logo.formats')}
          </p>
        </div>
      </div>

      <p role="status" className="m-0 mt-3 min-h-5 text-sm text-succes">
        {messageEtat()}
      </p>
      {etat.erreur !== null && (
        <p role="alert" className="m-0 mt-1 text-sm text-erreur">
          {t(CLES_ERREUR[etat.erreur])}
        </p>
      )}
    </section>
  )
}