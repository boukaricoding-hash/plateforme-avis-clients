import { useId, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'

type Proprietes = Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'className'> & {
  etiquette: string
  // Message d'erreur affiche sous le champ (vide ou absent = pas d'erreur).
  erreur?: string
}

const ICONE_OEIL =
  'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5ZM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'
const ICONE_OEIL_BARRE =
  'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7ZM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27ZM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 0 1-5-5c0-.79.2-1.53.53-2.2Zm4.31-.78 3.15 3.15.02-.16a3 3 0 0 0-3-3l-.17.01Z'

// Champ "ligne fine" : pas de cadre, pas de fond, seulement un trait fin sous le texte.
// Les "!" a la fin des classes forcent la valeur, car index.css donne un fond et une
// couleur de bordure a tous les champs.
export function ChampTexte({ etiquette, erreur, type = 'text', ...reste }: Proprietes) {
  const { t } = utiliserLangue()
  const id = useId()
  const idErreur = `${id}-erreur`
  const [visible, setVisible] = useState(false)

  const estMotDePasse = type === 'password'
  const typeAffiche = estMotDePasse && visible ? 'text' : type
  const aUneErreur = erreur !== undefined && erreur !== ''

  const couleurLigne = aUneErreur
    ? 'border-b-erreur! focus:shadow-[0_1px_0_0_var(--erreur)]'
    : 'border-b-bordure-champ! focus:border-b-(--focus)! focus:shadow-[0_1px_0_0_var(--focus)]'

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-texte-secondaire">
        {etiquette}
      </label>

      <div className="relative">
        <input
          {...reste}
          id={id}
          type={typeAffiche}
          aria-invalid={aUneErreur}
          aria-describedby={aUneErreur ? idErreur : undefined}
          className={`champ-ligne min-h-11 w-full rounded-none border-0 border-b bg-transparent! px-0 text-base text-texte placeholder:text-texte-discret focus:outline-none ${
            estMotDePasse ? 'pr-12' : ''
          } ${couleurLigne}`}
        />

        {estMotDePasse && (
          <button
            type="button"
            onClick={() => setVisible((courant) => !courant)}
            aria-label={visible ? t('connexion.masquerMotDePasse') : t('connexion.afficherMotDePasse')}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texte-secondaire hover:text-texte"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d={visible ? ICONE_OEIL_BARRE : ICONE_OEIL} />
            </svg>
          </button>
        )}
      </div>

      {aUneErreur && (
        <p id={idErreur} role="alert" className="mt-1 text-sm text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}
