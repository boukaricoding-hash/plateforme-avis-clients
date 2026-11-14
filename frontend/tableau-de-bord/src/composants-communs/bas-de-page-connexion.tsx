import { utiliserLangue } from '../hooks/utiliser-langue'

// Bande du bas de la page d'accueil (ecran large) : les secteurs a gauche,
// les deux garanties avec leur coche a droite.
// Les styles sont dans styles/connexion.css, les textes dans traductions/fr/textes.ts
// et en/textes.ts, sous la cle "vitrine".
const SECTEURS = [1, 2, 3, 4, 5]
const GARANTIES = [1, 2]

// La coche (trait seulement)
const ICONE_COCHE = 'M5 12.5l4.5 4.5L19 7.5'

export function BasDePageConnexion() {
  const { t } = utiliserLangue()

  return (
    <div className="connexion-bas">
      <ul className="connexion-secteurs">
        {SECTEURS.map((numero) => (
          <li key={numero} className="connexion-secteur">
            {t(`vitrine.secteur${numero}`)}
          </li>
        ))}
      </ul>

      <ul className="connexion-garanties">
        {GARANTIES.map((numero) => (
          <li key={numero} className="connexion-garantie">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ICONE_COCHE} />
            </svg>
            {t(`vitrine.garantie${numero}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}