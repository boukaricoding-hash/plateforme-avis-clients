import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../hooks/utiliser-utilisateur'
import {
  IconeAvis,
  IconeBasculerMenu,
  IconeChevron,
  IconeDeconnexion,
  IconeExports,
  IconeParametres,
  IconeQrCodes,
  IconeQuestionnaires,
  IconeSites,
  IconeTableauDeBord,
  IconeUtilisateurs,
} from './icones-menu'
import '../styles/menu-lateral.css'

type Entree = {
  chemin: string
  cle: string
  // Icone en contour fin de l'entree (voir icones-menu.tsx).
  icone: ComposantIcone
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
    entrees: [{ chemin: '/', cle: 'menu.tableauDeBord', icone: IconeTableauDeBord }],
  },
  {
    cle: 'retours',
    titre: 'menu.groupes.retours',
    entrees: [
      { chemin: '/avis', cle: 'menu.avis', icone: IconeAvis },
      { chemin: '/questionnaires', cle: 'menu.questionnaires', icone: IconeQuestionnaires },
      { chemin: '/qr-codes', cle: 'menu.qrCodes', icone: IconeQrCodes },
    ],
  },
  {
    cle: 'organisation',
    titre: 'menu.groupes.organisation',
    entrees: [
      { chemin: '/sites', cle: 'menu.sites', icone: IconeSites },
      { chemin: '/utilisateurs', cle: 'menu.utilisateurs', icone: IconeUtilisateurs },
    ],
  },
  {
    cle: 'systeme',
    titre: 'menu.groupes.systeme',
    entrees: [
      { chemin: '/exports', cle: 'menu.exports', icone: IconeExports },
      { chemin: '/parametres', cle: 'menu.parametres', icone: IconeParametres },
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

// Initiales de la pastille de l'utilisateur : premiere lettre des deux premiers mots du nom.
function initiales(nom: string): string {
  const lettres = nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0))
    .join('')
  return lettres === '' ? '?' : lettres.toUpperCase()
}

// Lettre de la pastille de l'organisation (sans logo) : premiere lettre de son nom.
function initialeOrganisation(nom: string): string {
  const lettre = nom.trim().charAt(0)
  return lettre === '' ? '?' : lettre.toUpperCase()
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

  // En-tete : nom et logo de l'organisation connectee. Sans organisation (administrateur DTS),
  // on garde la marque du produit. Si l'image du logo ne charge pas, on retombe sur la pastille.
  const organisation = utilisateur?.organisation ?? null
  const logoUrl = organisation?.logo_url ?? null
  const [logoEchoue, setLogoEchoue] = useState<string | null>(null)
  const nomMarque = organisation === null ? t('marque.produit') : organisation.nom
  // La lettre de la marque ne change pas avec la langue.
  const initialeMarque = organisation === null ? 'A' : initialeOrganisation(organisation.nom)

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

  // Barre doree de la page active : on la place avec offsetTop et offsetHeight de l'onglet.
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
        {/* En-tete fixe : logo (ou initiale), nom de l'organisation, bouton replier */}
        <div className="barre-laterale-entete">
          {logoUrl !== null && logoUrl !== logoEchoue ? (
            <img
              src={logoUrl}
              alt=""
              className="barre-laterale-logo"
              referrerPolicy="no-referrer"
              onError={() => setLogoEchoue(logoUrl)}
            />
          ) : (
            <span className="barre-laterale-pastille" aria-hidden="true">
              {initialeMarque}
            </span>
          )}
          <div className="barre-laterale-marque barre-laterale-masquable">
            <span className="barre-laterale-produit">{nomMarque}</span>
            {organisation === null && (
              <span className="barre-laterale-fournisseur">{t('marque.fournisseur')}</span>
            )}
          </div>
          {/* Replier ou deplier : ordinateur seulement (le CSS le cache sur tablette et telephone) */}
          <button
            type="button"
            onClick={onBasculerReplie}
            className="barre-laterale-bouton-replier"
            aria-label={libelleReplier}
            data-tooltip={libelleReplier}
          >
            <IconeBasculerMenu className="barre-laterale-icone" />
          </button>
        </div>

        {/* Zone du milieu : c'est la seule qui defile */}
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
                        {groupe.entrees.map((entree) => {
                          const Icone = entree.icone
                          return (
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
                                <Icone className="barre-laterale-icone" />
                                <span className="barre-laterale-libelle barre-laterale-masquable">
                                  {t(entree.cle)}
                                </span>
                              </NavLink>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        {/* Bas fixe : utilisateur (pastille, nom, role) et deconnexion */}
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