import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'
import { IconeChevron, IconeDeconnexion, IconeDeplier, IconeReplier } from './icones-menu'
import '../styles/menu-lateral.css'

type Entree = {
  chemin: string
  cle: string
  // Dessin de l'icone (trace SVG sur une grille de 24 x 24).
  icone: string
}

type Groupe = {
  cle: string
  // Cle de texte du titre ; null = groupe sans titre, toujours ouvert.
  titre: string | null
  entrees: Entree[]
}

// Tous les ecrans du tableau de bord, en groupes. Les ecrans pas encore construits affichent
// un message "bientot disponible" jusqu'au jour de leur construction.
// Tout le monde voit les memes entrees : aucun filtre par role pour l'instant.
const GROUPES: Groupe[] = [
  {
    cle: 'principal',
    titre: null,
    entrees: [
      { chemin: '/', cle: 'menu.tableauDeBord', icone: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
    ],
  },
  {
    cle: 'retours',
    titre: 'menu.groupes.retours',
    entrees: [
      { chemin: '/avis', cle: 'menu.avis', icone: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1Zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1Z' },
      { chemin: '/questionnaires', cle: 'menu.questionnaires', icone: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm2 14H7v-2h7v2Zm3-4H7v-2h10v2Zm0-4H7V7h10v2Z' },
      { chemin: '/qr-codes', cle: 'menu.qrCodes', icone: 'M3 11h8V3H3v8Zm2-6h4v4H5V5Zm-2 16h8v-8H3v8Zm2-6h4v4H5v-4Zm8-12v8h8V3h-8Zm6 6h-4V5h4v4Zm0 10h2v2h-2v-2Zm-6-6h2v2h-2v-2Zm2 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm2 2h2v2h-2v-2Zm2-2h2v2h-2v-2Zm0-4h2v2h-2v-2Zm2 2h2v2h-2v-2Z' },
    ],
  },
  {
    cle: 'organisation',
    titre: 'menu.groupes.organisation',
    entrees: [
      { chemin: '/sites', cle: 'menu.sites', icone: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5Z' },
      { chemin: '/utilisateurs', cle: 'menu.utilisateurs', icone: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z' },
    ],
  },
  {
    cle: 'systeme',
    titre: 'menu.groupes.systeme',
    entrees: [
      { chemin: '/exports', cle: 'menu.exports', icone: 'M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z' },
      { chemin: '/parametres', cle: 'menu.parametres', icone: 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.61.22L2.74 8.84a.48.48 0 0 0 .12.64l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.37.29.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z' },
    ],
  },
]

// Meme regle que NavLink : l'accueil seulement sur '/', les autres sur leur adresse et en dessous.
function entreeActive(chemin: string, adresse: string): boolean {
  if (chemin === '/') {
    return adresse === '/'
  }
  return adresse === chemin || adresse.startsWith(chemin + '/')
}

// Initiales de la pastille : premiere lettre des deux premiers mots du nom.
function initiales(nom: string): string {
  const lettres = nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0))
    .join('')
  return lettres === '' ? '?' : lettres.toUpperCase()
}

type Proprietes = {
  // Tiroir ouvert (tablette et telephone seulement : sur ordinateur le menu est toujours visible).
  ouvert: boolean
  onFermer: () => void
  // Menu replie en icones seules (ordinateur seulement, le tiroir reste toujours deplie).
  replie: boolean
  onBasculerReplie: () => void
}

export function MenuLateral({ ouvert, onFermer, replie, onBasculerReplie }: Proprietes) {
  const { t } = utiliserLangue()
  const { utilisateur, seDeconnecter } = utiliserUtilisateur()
  const { pathname } = useLocation()
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false)

  const groupeActif = GROUPES.find((groupe) =>
    groupe.entrees.some((entree) => entreeActive(entree.chemin, pathname)),
  )
  const cheminActif = groupeActif?.entrees.find((entree) =>
    entreeActive(entree.chemin, pathname),
  )?.chemin
  const cleGroupeActif = groupeActif?.cle ?? null

  // Groupes ouverts : au depart seulement celui de la page active (les groupes sans titre restent ouverts).
  const [groupesOuverts, setGroupesOuverts] = useState<Record<string, boolean>>(() => {
    const depart: Record<string, boolean> = {}
    for (const groupe of GROUPES) {
      depart[groupe.cle] = groupe.titre === null || groupe.cle === cleGroupeActif
    }
    return depart
  })

  // Quand on arrive dans un autre groupe (lien, adresse, retour en arriere), il s'ouvre tout seul.
  const [groupeVu, setGroupeVu] = useState<string | null>(cleGroupeActif)
  if (cleGroupeActif !== groupeVu) {
    setGroupeVu(cleGroupeActif)
    if (cleGroupeActif !== null) {
      setGroupesOuverts((avant) => ({ ...avant, [cleGroupeActif]: true }))
    }
  }

  function basculerGroupe(cle: string) {
    setGroupesOuverts((avant) => ({ ...avant, [cle]: !avant[cle] }))
  }

  // La touche Echap ferme le tiroir.
  useEffect(() => {
    if (!ouvert) {
      return
    }
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        onFermer()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer])

  // Barre verticale de la page active : on la place avec offsetTop et offsetHeight de l'onglet.
  // Elle est deplacee directement dans le DOM (pas d'etat) et suit l'ouverture des groupes.
  const groupesRef = useRef<HTMLDivElement>(null)
  const indicateurRef = useRef<HTMLSpanElement>(null)
  const liensRef = useRef<Record<string, HTMLAnchorElement | null>>({})
  const dejaPlaceRef = useRef(false)

  useLayoutEffect(() => {
    const indicateur = indicateurRef.current
    const groupes = groupesRef.current
    if (indicateur === null || groupes === null) {
      return
    }
    const groupeOuvert =
      groupeActif !== undefined && (groupeActif.titre === null || groupesOuverts[groupeActif.cle])

    function placer() {
      if (indicateur === null) {
        return
      }
      const lien = cheminActif === undefined ? null : liensRef.current[cheminActif]
      if (!lien || !groupeOuvert) {
        indicateur.hidden = true
        return
      }
      // Premier placement : pas de glissement depuis le haut de la liste.
      const premier = !dejaPlaceRef.current
      if (premier) {
        indicateur.style.transition = 'none'
      }
      indicateur.hidden = false
      indicateur.style.top = lien.offsetTop + 'px'
      indicateur.style.height = lien.offsetHeight + 'px'
      if (premier) {
        indicateur.getBoundingClientRect()
        indicateur.style.transition = ''
        dejaPlaceRef.current = true
      }
    }

    placer()
    // Pendant l'animation d'un groupe, les onglets du dessous bougent : on suit.
    const observateur = new ResizeObserver(placer)
    observateur.observe(groupes)
    return () => observateur.disconnect()
  }, [cheminActif, groupeActif, groupesOuverts])

  async function surDeconnexion() {
    setDeconnexionEnCours(true)
    await seDeconnecter()
  }

  const libelleReplier = replie ? t('menu.deplier') : t('menu.replier')
  const libelleDeconnexion = deconnexionEnCours
    ? t('barreHaut.deconnexionEnCours')
    : t('barreHaut.deconnexion')

  return (
    <>
      {/* Voile derriere le tiroir ouvert (tablette et telephone) */}
      {ouvert && (
        <button
          type="button"
          aria-label={t('menu.fermer')}
          onClick={onFermer}
          className="fixed inset-0 z-30 bg-texte/40 lg:hidden"
        />
      )}

      <aside
        className={`barre-laterale${ouvert ? ' barre-laterale--ouverte' : ''}${
          replie ? ' barre-laterale--repliee' : ''
        }`}
      >
        <div className="barre-laterale-entete">
          {/* La lettre de la pastille est celle de la marque : elle ne change pas avec la langue. */}
          <span className="barre-laterale-pastille" aria-hidden="true">
            A
          </span>
          <div className="barre-laterale-marque barre-laterale-masquable">
            <span className="barre-laterale-produit">{t('marque.produit')}</span>
            <span className="barre-laterale-fournisseur">{t('marque.fournisseur')}</span>
          </div>
        </div>

        <nav aria-label={t('menu.navigation')} className="barre-laterale-nav">
          <span ref={indicateurRef} className="barre-laterale-indicateur" aria-hidden="true" hidden />

          <div ref={groupesRef}>
            {GROUPES.map((groupe) => {
              const groupeOuvert = groupesOuverts[groupe.cle]
              const idContenu = 'menu-groupe-' + groupe.cle
              return (
                <div key={groupe.cle} className="barre-laterale-groupe">
                  {groupe.titre !== null && (
                    <button
                      type="button"
                      className="barre-laterale-groupe-entete"
                      onClick={() => basculerGroupe(groupe.cle)}
                      aria-expanded={groupeOuvert}
                      aria-controls={idContenu}
                    >
                      <span>{t(groupe.titre)}</span>
                      <IconeChevron
                        className={`barre-laterale-chevron${
                          groupeOuvert ? ' barre-laterale-chevron--ouvert' : ''
                        }`}
                      />
                    </button>
                  )}

                  <div
                    id={idContenu}
                    className={`barre-laterale-groupe-contenu${
                      groupeOuvert ? ' barre-laterale-groupe-contenu--ouvert' : ''
                    }`}
                  >
                    <div className="barre-laterale-groupe-interieur">
                      <ul className="barre-laterale-liste">
                        {groupe.entrees.map((entree) => (
                          <li key={entree.chemin}>
                            <NavLink
                              to={entree.chemin}
                              end={entree.chemin === '/'}
                              onClick={onFermer}
                              ref={(noeud) => {
                                liensRef.current[entree.chemin] = noeud
                              }}
                              data-tooltip={t(entree.cle)}
                              className={`barre-laterale-lien${
                                entree.chemin === cheminActif ? ' barre-laterale-lien--actif' : ''
                              }`}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                                focusable="false"
                                className="barre-laterale-icone"
                              >
                                <path d={entree.icone} />
                              </svg>
                              <span className="barre-laterale-libelle barre-laterale-masquable">
                                {t(entree.cle)}
                              </span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        {/* Replier ou deplier : ordinateur seulement (le CSS le cache sur tablette et telephone) */}
        <div className="barre-laterale-replier">
          <button
            type="button"
            onClick={onBasculerReplie}
            className="barre-laterale-bouton-replier"
            data-tooltip={libelleReplier}
          >
            {replie ? (
              <IconeDeplier className="barre-laterale-icone" />
            ) : (
              <IconeReplier className="barre-laterale-icone" />
            )}
            <span className="barre-laterale-libelle barre-laterale-masquable">{libelleReplier}</span>
          </button>
        </div>

        <div className="barre-laterale-utilisateur">
          {utilisateur !== null && (
            <>
              <span className="barre-laterale-avatar" aria-hidden="true">
                {initiales(utilisateur.nom)}
              </span>
              <div className="barre-laterale-infos barre-laterale-masquable">
                <span className="barre-laterale-nom">{utilisateur.nom}</span>
                <span className="barre-laterale-role">{t(`roles.${utilisateur.role}`)}</span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => void surDeconnexion()}
            disabled={deconnexionEnCours}
            aria-label={libelleDeconnexion}
            data-tooltip={libelleDeconnexion}
            className="barre-laterale-bouton-deconnexion"
          >
            <IconeDeconnexion />
          </button>
        </div>
      </aside>
    </>
  )
}