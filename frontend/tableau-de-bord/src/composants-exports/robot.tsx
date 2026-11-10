import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { HumeurRobot } from '../types/exports'

// Le robot de l'ecran E16 (exports et rapports, jour 21).
// Dessin SVG anime a la main (requestAnimationFrame) : aucune bibliotheque, aucun appel a l'API.
// - Les yeux et la tete suivent le curseur, avec des ressorts (ils depassent un peu puis se posent).
// - Cinq humeurs, donnees par le hook utiliser-export : repos, ecoute, reflechit, content, inquiet.
// - La teinte vient de --couleur-principale (couleur de l'organisation) ; les deux themes sont geres.
// - prefers-reduced-motion : le robot prend la pose de son humeur, sans mouvement.
// Le texte lu par les lecteurs d'ecran vient de la page (etiquette) : aucun texte n'est ecrit ici.

type Proprietes = {
  humeur: HumeurRobot
  // Phrase lue par les lecteurs d'ecran, dans la langue choisie (donnee par la page)
  etiquette: string
  // Largeur en pixels ; le dessin garde ses proportions. Une classe CSS peut la remplacer.
  taille?: number
  className?: string
}

// ------------------------------------------------------------
// Geometrie (repere du dessin : 200 de large, 232 de haut, 12 de marge en haut)
// ------------------------------------------------------------

const LARGEUR_VUE = 200
const HAUTEUR_VUE = 232

const SOL_Y = 204
const COU_Y = 138
const ANTENNE_Y = 42
const OEIL_G = { x: 78, y: 82 }
const OEIL_D = { x: 122, y: 82 }
const OEIL_RX = 14.5
const OEIL_RY = 17
const PUPILLE_R = 7.6
const SOURCIL_Y = 58
const BOUCHE_Y = 112
const EPAULE_G = { x: 58, y: 156 }
const EPAULE_D = { x: 142, y: 156 }
const BARRES_X = [84, 96, 108]
const BARRES_BAS = 176
const BARRES_MAX = 16

// ------------------------------------------------------------
// Poses des humeurs
// ------------------------------------------------------------

type Pose = {
  // Yeux : ouverture (1 = normale), joie (0 a 1 : yeux souriants), taille de la pupille
  ouverture: number
  joie: number
  pupille: number
  // Bouche : sourire (-1 triste a 1 grand sourire), ouverture (0 a 1), largeur (1 = normale)
  sourire: number
  bouche: number
  largeur: number
  // Sourcils : hausse en pixels et angle en degres (sens des aiguilles d'une montre)
  sourcilGY: number
  sourcilDY: number
  sourcilGAngle: number
  sourcilDAngle: number
  joue: number
  // Tete : inclinaison en degres, decalage vers le bas en pixels
  inclinaison: number
  teteY: number
  // Part du mouvement du curseur suivie par le regard et la tete (0 a 1), plus un regard fixe
  suit: number
  regardX: number
  regardY: number
  // Bras en degres : positif = vers l'exterieur pour le bras gauche, negatif pour le bras droit
  brasG: number
  brasD: number
  antenne: number
  // Pulsations de l'ampoule par seconde
  frequencePouls: number
  // Sauts de joie : hauteur en pixels et duree en secondes apres l'arrivee de l'humeur
  rebond: number
  dureeRebond: number
  // Coup donne au corps a l'arrivee de l'humeur (negatif = vers le haut)
  sursaut: number
  // Tremblement en degres
  tremblement: number
  // Elements du decor : bulles de reflexion, etincelles, goutte de sueur (0 ou 1)
  pensee: number
  etincelles: number
  goutte: number
}

const POSES: Record<HumeurRobot, Pose> = {
  repos: {
    ouverture: 1,
    joie: 0,
    pupille: 1,
    sourire: 0.35,
    bouche: 0,
    largeur: 1,
    sourcilGY: 0,
    sourcilDY: 0,
    sourcilGAngle: 0,
    sourcilDAngle: 0,
    joue: 0.16,
    inclinaison: 0,
    teteY: 0,
    suit: 1,
    regardX: 0,
    regardY: 0,
    brasG: 12,
    brasD: -12,
    antenne: 0,
    frequencePouls: 0.45,
    rebond: 0,
    dureeRebond: 0,
    sursaut: 0,
    tremblement: 0,
    pensee: 0,
    etincelles: 0,
    goutte: 0,
  },
  ecoute: {
    ouverture: 1.12,
    joie: 0,
    pupille: 1.15,
    sourire: 0.1,
    bouche: 0.9,
    largeur: 0.45,
    sourcilGY: -3,
    sourcilDY: -3,
    sourcilGAngle: 0,
    sourcilDAngle: 0,
    joue: 0.12,
    inclinaison: 6,
    teteY: 1.5,
    suit: 1,
    regardX: 0,
    regardY: 0,
    brasG: 26,
    brasD: -26,
    antenne: 10,
    frequencePouls: 1.1,
    rebond: 0,
    dureeRebond: 0,
    sursaut: -60,
    tremblement: 0,
    pensee: 0,
    etincelles: 0,
    goutte: 0,
  },
  reflechit: {
    ouverture: 0.82,
    joie: 0,
    pupille: 0.95,
    sourire: -0.05,
    bouche: 0,
    largeur: 0.6,
    sourcilGY: -5,
    sourcilDY: 1,
    sourcilGAngle: -6,
    sourcilDAngle: 4,
    joue: 0.1,
    inclinaison: -5,
    teteY: 0,
    suit: 0.25,
    regardX: 2.6,
    regardY: -3.6,
    brasG: 10,
    brasD: 135,
    antenne: -8,
    frequencePouls: 2.2,
    rebond: 0,
    dureeRebond: 0,
    sursaut: -30,
    tremblement: 0,
    pensee: 1,
    etincelles: 0,
    goutte: 0,
  },
  content: {
    ouverture: 1,
    joie: 1,
    pupille: 1,
    sourire: 0.95,
    bouche: 0.45,
    largeur: 1.15,
    sourcilGY: -3,
    sourcilDY: -3,
    sourcilGAngle: 3,
    sourcilDAngle: -3,
    joue: 0.55,
    inclinaison: 0,
    teteY: -1,
    suit: 0.6,
    regardX: 0,
    regardY: 0,
    brasG: 155,
    brasD: -155,
    antenne: 0,
    frequencePouls: 1.6,
    rebond: 18,
    dureeRebond: 2.2,
    sursaut: 0,
    tremblement: 0,
    pensee: 0,
    etincelles: 1,
    goutte: 0,
  },
  inquiet: {
    ouverture: 1.12,
    joie: 0,
    pupille: 0.72,
    sourire: -0.75,
    bouche: 0.2,
    largeur: 0.8,
    sourcilGY: -1,
    sourcilDY: -1,
    sourcilGAngle: -14,
    sourcilDAngle: 14,
    joue: 0,
    inclinaison: -3,
    teteY: 2,
    suit: 0.5,
    regardX: 0,
    regardY: 0,
    brasG: -30,
    brasD: 30,
    antenne: -16,
    frequencePouls: 3.2,
    rebond: 0,
    dureeRebond: 0,
    sursaut: -140,
    tremblement: 0.9,
    pensee: 0,
    etincelles: 0,
    goutte: 1,
  },
}

// Couleur de l'ampoule et des yeux selon l'humeur (variables du theme : sombre et clair)
const COULEUR_SIGNAL: Record<HumeurRobot, string> = {
  repos: 'var(--couleur-principale)',
  ecoute: 'var(--info)',
  reflechit: 'var(--alerte)',
  content: 'var(--succes)',
  inquiet: 'var(--erreur)',
}

// ------------------------------------------------------------
// Petits outils (ressorts, nombres, formes)
// ------------------------------------------------------------

type Ressort = { x: number; v: number; cible: number; raideur: number; amortissement: number }

function creerRessort(valeur: number, raideur: number, amortissement: number): Ressort {
  return { x: valeur, v: 0, cible: valeur, raideur, amortissement }
}

// Un pas de calcul : la force tire vers la cible, le frottement freine.
function avancer(ressort: Ressort, dt: number): void {
  const force = (ressort.cible - ressort.x) * ressort.raideur - ressort.v * ressort.amortissement
  ressort.v += force * dt
  ressort.x += ressort.v * dt
}

function limiter(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur))
}

function nombre(valeur: number): string {
  return valeur.toFixed(2)
}

function echelleVerticale(centre: { x: number; y: number }, facteur: number): string {
  return `translate(${centre.x} ${centre.y}) scale(1 ${nombre(facteur)}) translate(${-centre.x} ${-centre.y})`
}

function dessinerBouche(sourire: number, ouverture: number, largeur: number): string {
  const demi = 14 * largeur
  const gauche = 100 - demi
  const droite = 100 + demi
  // Bord du haut : une courbe (sourire ou moue). Milieu = BOUCHE_Y + 9 * sourire.
  const haut = BOUCHE_Y + 18 * sourire
  const milieuHaut = BOUCHE_Y + 9 * sourire
  // Bord du bas : arrondi, il descend sous le bord du haut de 12 * ouverture au milieu
  // (milieu d'une courbe a deux points de controle a la meme hauteur : 0,25 * bord + 0,75 * controle).
  const controleBas = (milieuHaut + 12 * ouverture - 0.25 * BOUCHE_Y) / 0.75
  return `M ${nombre(gauche)} ${BOUCHE_Y} Q 100 ${nombre(haut)} ${nombre(droite)} ${BOUCHE_Y} C ${nombre(droite)} ${nombre(controleBas)} ${nombre(gauche)} ${nombre(controleBas)} ${nombre(gauche)} ${BOUCHE_Y} Z`
}

// Hauteurs des trois barres du panneau de poitrine (un petit indicateur qui vit avec l'humeur).
function hauteursBarres(humeur: HumeurRobot, t: number): number[] {
  return BARRES_X.map((_, i) => {
    let hauteur: number
    if (humeur === 'repos') {
      hauteur = 5 + 2 * Math.sin(2 * Math.PI * (t * 0.6 + i * 0.2))
    } else if (humeur === 'ecoute') {
      hauteur = 4 + 11 * Math.abs(Math.sin(t * (5 + i * 1.9)) * Math.cos(t * (3.1 + i * 0.8)))
    } else if (humeur === 'reflechit') {
      hauteur = 4 + 11 * Math.max(0, Math.sin(2 * Math.PI * (t * 1.1 - i * 0.16)))
    } else if (humeur === 'content') {
      hauteur = 11 + 4 * Math.sin(2 * Math.PI * (t * 2.6 + i * 0.2))
    } else {
      hauteur = i === 1 ? 4 + (Math.sin(t * 9) > 0 ? 11 : 4) : 4
    }
    return limiter(hauteur, 3, BARRES_MAX)
  })
}

// Valeurs du premier dessin (humeur de repos) : le robot est complet meme avant la premiere image.
const BOUCHE_INITIALE = dessinerBouche(
  POSES.repos.sourire,
  POSES.repos.bouche,
  POSES.repos.largeur,
)
const BARRES_INITIALES = hauteursBarres('repos', 0)

// ------------------------------------------------------------
// Elements du dessin que l'animation deplace
// ------------------------------------------------------------

const NOMS = [
  'ombre',
  'corps',
  'tete',
  'antenne',
  'halo',
  'ampoule',
  'oeilG',
  'oeilD',
  'regardG',
  'regardD',
  'pupilleG',
  'pupilleD',
  'refletG',
  'refletD',
  'paupiereG',
  'paupiereD',
  'sourcilG',
  'sourcilD',
  'bouche',
  'joueG',
  'joueD',
  'brasG',
  'brasD',
  'barre0',
  'barre1',
  'barre2',
  'pensee0',
  'pensee1',
  'pensee2',
  'etincelleG',
  'etincelleD',
  'goutte',
] as const

type Nom = (typeof NOMS)[number]
type Elements = Record<Nom, SVGElement>

function collecter(racine: SVGSVGElement): Elements | null {
  const resultat = {} as Elements
  for (const nom of NOMS) {
    const element = racine.querySelector<SVGElement>(`[data-r="${nom}"]`)
    if (element === null) {
      return null
    }
    resultat[nom] = element
  }
  return resultat
}

// ------------------------------------------------------------
// Animation
// ------------------------------------------------------------

// Pas de calcul fixe : les ressorts restent stables meme si l'ecran saccade.
const PAS = 1 / 120

function demarrerAnimation(
  svg: SVGSVGElement,
  el: Elements,
  lireHumeur: () => HumeurRobot,
): () => void {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)')
  const depart = POSES[lireHumeur()]

  // Chaque valeur qui bouge est un ressort : (valeur de depart, raideur, amortissement).
  const r = {
    ouverture: creerRessort(depart.ouverture, 200, 18),
    clignement: creerRessort(1, 700, 40),
    joie: creerRessort(depart.joie, 140, 16),
    pupille: creerRessort(depart.pupille, 200, 18),
    sourire: creerRessort(depart.sourire, 150, 15),
    bouche: creerRessort(depart.bouche, 150, 15),
    largeur: creerRessort(depart.largeur, 150, 15),
    sourcilGY: creerRessort(depart.sourcilGY, 160, 14),
    sourcilDY: creerRessort(depart.sourcilDY, 160, 14),
    sourcilGAngle: creerRessort(depart.sourcilGAngle, 160, 14),
    sourcilDAngle: creerRessort(depart.sourcilDAngle, 160, 14),
    joue: creerRessort(depart.joue, 60, 10),
    inclinaison: creerRessort(depart.inclinaison, 90, 10),
    teteX: creerRessort(0, 110, 12),
    teteY: creerRessort(depart.teteY, 110, 12),
    regardX: creerRessort(depart.regardX, 230, 20),
    regardY: creerRessort(depart.regardY, 230, 20),
    brasG: creerRessort(depart.brasG, 110, 9),
    brasD: creerRessort(depart.brasD, 110, 9),
    antenne: creerRessort(depart.antenne, 150, 5),
    corpsY: creerRessort(0, 170, 12),
    pensee: creerRessort(depart.pensee, 60, 10),
    etincelles: creerRessort(depart.etincelles, 60, 10),
    goutte: creerRessort(depart.goutte, 60, 10),
    barres: BARRES_INITIALES.map((hauteur) => creerRessort(hauteur, 300, 26)),
  }
  const tous: Ressort[] = [...Object.values(r).filter((v): v is Ressort => !Array.isArray(v)), ...r.barres]

  const pensees = [el.pensee0, el.pensee1, el.pensee2]
  const barres = [el.barre0, el.barre1, el.barre2]
  const etincelles = [el.etincelleG, el.etincelleD]
  const POSITION_ETINCELLES = [
    { x: 24, y: 46 },
    { x: 178, y: 58 },
  ]

  let temps = 0
  let dernierInstant = performance.now()
  let humeurAffichee = lireHumeur()
  // Loin dans le passe : pas de saut de joie quand le robot apparait deja content
  let debutHumeur = -100
  let pointeur: { x: number; y: number } | null = null
  const errance = { x: 0, y: 0, prochain: 0 }
  let prochainClignement = 1.2 + Math.random() * 2
  let finClignement = 0
  let visible = true
  let identifiant = 0

  function image(maintenant: number): void {
    const dt = Math.min((maintenant - dernierInstant) / 1000, 1 / 30)
    dernierInstant = maintenant
    temps += dt
    if (!visible) {
      return
    }

    const calme = reduit.matches
    const humeur = lireHumeur()
    const pose = POSES[humeur]

    // Nouvelle humeur : le temps repart de zero et le corps recoit un petit coup.
    if (humeur !== humeurAffichee) {
      humeurAffichee = humeur
      debutHumeur = temps
      r.corpsY.v += pose.sursaut
    }
    const duree = temps - debutHumeur

    // --- Ce que regarde le robot : le curseur, ou une errance douce si le curseur n'a pas bouge ---
    let curseurX = 0
    let curseurY = 0
    if (!calme) {
      if (pointeur !== null) {
        const zone = svg.getBoundingClientRect()
        curseurX = Math.tanh((pointeur.x - (zone.left + zone.width / 2)) / 260)
        curseurY = Math.tanh((pointeur.y - (zone.top + zone.height * 0.4)) / 260)
      } else {
        if (temps >= errance.prochain) {
          errance.x = (Math.random() * 2 - 1) * 0.7
          errance.y = (Math.random() * 2 - 1) * 0.5
          errance.prochain = temps + 1.4 + Math.random() * 2.6
        }
        curseurX = errance.x
        curseurY = errance.y
      }
    }
    const suiviTete = Math.min(1, pose.suit + 0.35)
    const hesite = humeur === 'reflechit' && !calme ? Math.sin(temps * 1.6) * 1.4 : 0
    const gaiete = humeur === 'content' && !calme

    // --- Cibles des ressorts ---
    r.ouverture.cible = pose.ouverture
    r.joie.cible = pose.joie
    r.pupille.cible = pose.pupille
    r.sourire.cible = pose.sourire
    r.bouche.cible = pose.bouche
    r.largeur.cible = pose.largeur
    r.sourcilGY.cible = pose.sourcilGY
    r.sourcilDY.cible = pose.sourcilDY
    r.sourcilGAngle.cible = pose.sourcilGAngle
    r.sourcilDAngle.cible = pose.sourcilDAngle
    r.joue.cible = pose.joue
    r.regardX.cible = limiter(pose.regardX + hesite + curseurX * 6.4 * pose.suit, -8, 8)
    r.regardY.cible = limiter(pose.regardY + curseurY * 4.8 * pose.suit, -6.5, 6.5)
    r.inclinaison.cible =
      pose.inclinaison + curseurX * 3.5 * suiviTete + (gaiete ? Math.sin(temps * 2.4) * 3 : 0)
    r.teteX.cible = curseurX * 2.6 * suiviTete
    r.teteY.cible = pose.teteY + curseurY * 1.4 * suiviTete
    r.brasG.cible =
      pose.brasG + (calme ? 0 : Math.sin(temps * 1.1) * 2.2) + (gaiete ? Math.sin(temps * 7) * 9 : 0)
    r.brasD.cible =
      pose.brasD -
      (calme ? 0 : Math.sin(temps * 1.1 + 1.3) * 2.2) -
      (gaiete ? Math.sin(temps * 7 + 1) * 9 : 0)
    r.antenne.cible = pose.antenne - r.inclinaison.v * 0.05
    r.pensee.cible = pose.pensee
    r.etincelles.cible = pose.etincelles
    r.goutte.cible = pose.goutte

    // Sauts de joie : quelques bonds qui s'amenuisent, puis le robot se pose.
    const facteurSaut =
      pose.dureeRebond > 0 && !calme ? Math.max(0, 1 - duree / pose.dureeRebond) : 0
    r.corpsY.cible = -pose.rebond * facteurSaut * Math.abs(Math.sin(Math.PI * duree * 1.7))

    // Clignement des yeux, de temps en temps (parfois deux fois de suite)
    if (!calme && temps >= prochainClignement) {
      r.clignement.cible = 0
      finClignement = temps + 0.11
      prochainClignement = temps + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3.4)
    }
    if (r.clignement.cible === 0 && temps >= finClignement) {
      r.clignement.cible = 1
    }

    const hauteurs = hauteursBarres(humeur, calme ? 0 : temps)
    hauteurs.forEach((hauteur, i) => {
      r.barres[i].cible = hauteur
    })

    // --- Calcul des ressorts (ou arrivee directe si l'animation est reduite) ---
    if (calme) {
      for (const ressort of tous) {
        ressort.x = ressort.cible
        ressort.v = 0
      }
    } else {
      let reste = dt
      while (reste > 1e-6) {
        const pas = Math.min(PAS, reste)
        for (const ressort of tous) {
          avancer(ressort, pas)
        }
        reste -= pas
      }
    }

    // --- Dessin ---
    const tremblement = calme ? 0 : Math.sin(temps * 37) * pose.tremblement
    const respiration = calme ? 0 : Math.sin((2 * Math.PI * temps) / 3.4) * 0.012
    const etirement = limiter(-r.corpsY.v / 1900, -0.08, 0.1)
    const echelleY = 1 + respiration + etirement
    const hauteurSaut = Math.max(0, -r.corpsY.x)

    el.ombre.setAttribute('rx', nombre(44 - hauteurSaut * 0.5))
    el.ombre.setAttribute('opacity', nombre(0.24 - hauteurSaut * 0.006))
    el.corps.setAttribute(
      'transform',
      `translate(0 ${nombre(r.corpsY.x)}) translate(100 ${SOL_Y}) scale(${nombre(1 / echelleY)} ${nombre(echelleY)}) translate(-100 ${-SOL_Y})`,
    )
    el.tete.setAttribute(
      'transform',
      `translate(${nombre(r.teteX.x)} ${nombre(r.teteY.x)}) rotate(${nombre(r.inclinaison.x + tremblement)} 100 ${COU_Y})`,
    )
    el.antenne.setAttribute('transform', `rotate(${nombre(r.antenne.x)} 100 ${ANTENNE_Y})`)

    const pouls = calme ? 0.5 : 0.5 + 0.5 * Math.sin(2 * Math.PI * pose.frequencePouls * temps)
    el.halo.setAttribute('opacity', nombre(0.16 + 0.26 * pouls))
    el.halo.setAttribute('r', nombre(12 + 4 * pouls))
    el.ampoule.setAttribute('r', nombre(6.6 + 0.9 * pouls))

    const ouvertureYeux = Math.max(0.05, r.ouverture.x * r.clignement.x)
    el.oeilG.setAttribute('transform', echelleVerticale(OEIL_G, ouvertureYeux))
    el.oeilD.setAttribute('transform', echelleVerticale(OEIL_D, ouvertureYeux))
    const regard = `translate(${nombre(r.regardX.x)} ${nombre(r.regardY.x)})`
    el.regardG.setAttribute('transform', regard)
    el.regardD.setAttribute('transform', regard)
    const rayon = nombre(PUPILLE_R * r.pupille.x)
    el.pupilleG.setAttribute('r', rayon)
    el.pupilleD.setAttribute('r', rayon)
    const reflet = `translate(${nombre(r.regardX.x * 0.28)} ${nombre(r.regardY.x * 0.28)})`
    el.refletG.setAttribute('transform', reflet)
    el.refletD.setAttribute('transform', reflet)
    const paupiere = nombre(122 - 28 * limiter(r.joie.x, 0, 1.2))
    el.paupiereG.setAttribute('cy', paupiere)
    el.paupiereD.setAttribute('cy', paupiere)

    el.sourcilG.setAttribute(
      'transform',
      `translate(0 ${nombre(r.sourcilGY.x)}) rotate(${nombre(r.sourcilGAngle.x)} ${OEIL_G.x} ${SOURCIL_Y})`,
    )
    el.sourcilD.setAttribute(
      'transform',
      `translate(0 ${nombre(r.sourcilDY.x)}) rotate(${nombre(r.sourcilDAngle.x)} ${OEIL_D.x} ${SOURCIL_Y})`,
    )

    const oscillationBouche = calme
      ? 0
      : humeur === 'reflechit'
        ? Math.sin(temps * 2.1) * 0.1
        : pose.tremblement * Math.sin(temps * 31) * 0.05
    el.bouche.setAttribute(
      'd',
      dessinerBouche(
        limiter(r.sourire.x + oscillationBouche, -1.2, 1.2),
        limiter(r.bouche.x, 0, 1.2),
        Math.max(0.3, r.largeur.x),
      ),
    )
    const joue = nombre(limiter(r.joue.x, 0, 1))
    el.joueG.setAttribute('opacity', joue)
    el.joueD.setAttribute('opacity', joue)

    el.brasG.setAttribute(
      'transform',
      `translate(${EPAULE_G.x} ${EPAULE_G.y}) rotate(${nombre(r.brasG.x + tremblement * 3)})`,
    )
    el.brasD.setAttribute(
      'transform',
      `translate(${EPAULE_D.x} ${EPAULE_D.y}) rotate(${nombre(r.brasD.x - tremblement * 3)})`,
    )

    barres.forEach((barre, i) => {
      const hauteur = limiter(r.barres[i].x, 2, BARRES_MAX + 2)
      barre.setAttribute('y', nombre(BARRES_BAS - hauteur))
      barre.setAttribute('height', nombre(hauteur))
    })

    pensees.forEach((bulle, i) => {
      const onde = calme ? 1 : Math.max(0, Math.sin(2 * Math.PI * (temps * 0.85 - i * 0.16)))
      bulle.setAttribute('opacity', nombre(limiter(r.pensee.x, 0, 1) * (0.3 + 0.7 * onde)))
    })

    etincelles.forEach((etincelle, i) => {
      const force = limiter(r.etincelles.x, 0, 1)
      const echelle = force * (calme ? 1 : 0.8 + 0.2 * Math.sin(temps * 5 + i * 2))
      const position = POSITION_ETINCELLES[i]
      etincelle.setAttribute(
        'transform',
        `translate(${position.x} ${position.y}) rotate(${nombre(calme ? 0 : temps * 20 * (i === 0 ? 1 : -1))}) scale(${nombre(echelle)})`,
      )
      etincelle.setAttribute('opacity', nombre(force))
    })

    const phaseGoutte = calme ? 0.4 : (temps * 0.6) % 1
    el.goutte.setAttribute('transform', `translate(148 ${nombre(60 + phaseGoutte * 22)})`)
    el.goutte.setAttribute(
      'opacity',
      nombre(limiter(r.goutte.x, 0, 1) * Math.sin(Math.PI * phaseGoutte)),
    )
  }

  function boucle(maintenant: number): void {
    identifiant = window.requestAnimationFrame(boucle)
    image(maintenant)
  }

  function surPointeur(evenement: PointerEvent): void {
    pointeur = { x: evenement.clientX, y: evenement.clientY }
  }

  // Un clic ou un toucher sur le robot : il sursaute et cligne des yeux.
  function surToucher(): void {
    r.corpsY.v -= 170
    r.antenne.v += 380
    if (!reduit.matches) {
      r.clignement.cible = 0
      finClignement = temps + 0.12
    }
  }

  // Le robot ne calcule rien tant qu'il n'est pas visible a l'ecran.
  let observateur: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== 'undefined') {
    observateur = new IntersectionObserver((entrees) => {
      const derniere = entrees[entrees.length - 1]
      if (derniere !== undefined) {
        visible = derniere.isIntersecting
      }
    })
    observateur.observe(svg)
  }

  window.addEventListener('pointermove', surPointeur, { passive: true })
  svg.addEventListener('pointerdown', surToucher)

  // Premier dessin tout de suite (avant l'affichage), puis une image a chaque rafraichissement.
  image(dernierInstant)
  identifiant = window.requestAnimationFrame(boucle)

  return () => {
    window.cancelAnimationFrame(identifiant)
    window.removeEventListener('pointermove', surPointeur)
    svg.removeEventListener('pointerdown', surToucher)
    observateur?.disconnect()
  }
}

// ------------------------------------------------------------
// Couleurs (variables du theme, teinte de l'organisation)
// ------------------------------------------------------------

const TRANSITION_COULEUR = 'fill 0.45s ease, stroke 0.45s ease'

function styleRobot(humeur: HumeurRobot): CSSProperties {
  return {
    display: 'block',
    overflow: 'visible',
    '--robot-signal': COULEUR_SIGNAL[humeur],
    '--robot-oeil': 'color-mix(in srgb, var(--robot-signal) 26%, #ffffff)',
    '--robot-pupille': 'color-mix(in srgb, var(--robot-signal) 20%, #090a1c)',
    '--robot-bouche': 'color-mix(in srgb, var(--robot-signal) 22%, #05060f)',
    '--robot-corps': 'color-mix(in srgb, var(--couleur-principale) 24%, var(--surface))',
    '--robot-corps-clair': 'color-mix(in srgb, var(--couleur-principale) 38%, var(--surface))',
    '--robot-contour': 'color-mix(in srgb, var(--couleur-principale) 55%, var(--bordure-forte))',
    '--robot-visiere-haut': 'color-mix(in srgb, var(--couleur-principale) 12%, #121330)',
    '--robot-visiere-bas': 'color-mix(in srgb, var(--couleur-principale) 6%, #080917)',
    '--robot-panneau': 'color-mix(in srgb, var(--couleur-principale) 8%, #0a0b1d)',
  } as CSSProperties
}

const STYLE_OEIL: CSSProperties = { fill: 'var(--robot-oeil)', transition: TRANSITION_COULEUR }
const STYLE_PUPILLE: CSSProperties = { fill: 'var(--robot-pupille)', transition: TRANSITION_COULEUR }
const STYLE_SIGNAL: CSSProperties = { fill: 'var(--robot-signal)', transition: TRANSITION_COULEUR }
const STYLE_MEMBRE: CSSProperties = {
  fill: 'var(--robot-corps-clair)',
  stroke: 'var(--robot-contour)',
}
const STYLE_SOURCIL: CSSProperties = { stroke: 'var(--robot-oeil)', transition: TRANSITION_COULEUR }

// ------------------------------------------------------------
// Composant
// ------------------------------------------------------------

export function Robot({ humeur, etiquette, taille = 160, className }: Proprietes) {
  const racine = useRef<SVGSVGElement>(null)
  const humeurCourante = useRef<HumeurRobot>(humeur)
  // Les identifiants du dessin (degrade, decoupe) doivent etre uniques sur la page.
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const idVisiere = `${base}-visiere`
  const idCorps = `${base}-corps`
  const idDecoupeG = `${base}-decoupe-g`
  const idDecoupeD = `${base}-decoupe-d`
  const idDecoupeVisiere = `${base}-decoupe-visiere`

  // L'animation lit l'humeur a chaque image : changer d'humeur ne relance rien.
  useEffect(() => {
    humeurCourante.current = humeur
  }, [humeur])

  useLayoutEffect(() => {
    const svg = racine.current
    if (svg === null) {
      return
    }
    const elements = collecter(svg)
    if (elements === null) {
      return
    }
    return demarrerAnimation(svg, elements, () => humeurCourante.current)
  }, [])

  return (
    <svg
      ref={racine}
      viewBox={`0 -12 ${LARGEUR_VUE} ${HAUTEUR_VUE}`}
      width={taille}
      height={Math.round((taille * HAUTEUR_VUE) / LARGEUR_VUE)}
      role="img"
      aria-label={etiquette}
      data-humeur={humeur}
      className={className}
      style={styleRobot(humeur)}
    >
      <defs>
        <linearGradient id={idVisiere} gradientUnits="userSpaceOnUse" x1="0" y1="52" x2="0" y2="128">
          <stop offset="0" style={{ stopColor: 'var(--robot-visiere-haut)' }} />
          <stop offset="1" style={{ stopColor: 'var(--robot-visiere-bas)' }} />
        </linearGradient>
        <linearGradient id={idCorps} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--robot-corps-clair)' }} />
          <stop offset="1" style={{ stopColor: 'var(--robot-corps)' }} />
        </linearGradient>
        <clipPath id={idDecoupeVisiere}>
          <rect x="46" y="52" width="108" height="76" rx="28" />
        </clipPath>
        <clipPath id={idDecoupeG}>
          <ellipse cx={OEIL_G.x} cy={OEIL_G.y} rx={OEIL_RX} ry={OEIL_RY} />
        </clipPath>
        <clipPath id={idDecoupeD}>
          <ellipse cx={OEIL_D.x} cy={OEIL_D.y} rx={OEIL_RX} ry={OEIL_RY} />
        </clipPath>
      </defs>

      {/* Ombre au sol : elle rapetisse quand le robot saute */}
      <ellipse data-r="ombre" cx="100" cy="209" rx="44" ry="6" opacity="0.24" fill="#000000" />

      <g data-r="corps">
        {/* Pieds */}
        <rect x="68" y="192" width="26" height="12" rx="6" style={STYLE_MEMBRE} strokeWidth="2" />
        <rect x="106" y="192" width="26" height="12" rx="6" style={STYLE_MEMBRE} strokeWidth="2" />

        {/* Torse et panneau de poitrine */}
        <rect
          x="56"
          y="142"
          width="88"
          height="54"
          rx="26"
          fill={`url(#${idCorps})`}
          style={{ stroke: 'var(--robot-contour)' }}
          strokeWidth="2"
        />
        <rect x="76" y="154" width="48" height="28" rx="11" style={{ fill: 'var(--robot-panneau)' }} />
        {BARRES_X.map((x, i) => (
          <rect
            key={x}
            data-r={`barre${i}`}
            x={x}
            y={BARRES_BAS - BARRES_INITIALES[i]}
            width="8"
            height={BARRES_INITIALES[i]}
            rx="2.5"
            style={STYLE_SIGNAL}
          />
        ))}

        {/* Cou */}
        <rect x="86" y="134" width="28" height="12" rx="3" style={STYLE_MEMBRE} strokeWidth="2" />

        {/* Tete : elle pivote autour du cou */}
        <g data-r="tete">
          {/* Antenne : elle oscille autour de sa base */}
          <g data-r="antenne">
            <line
              x1="100"
              y1={ANTENNE_Y}
              x2="100"
              y2="24"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ stroke: 'var(--robot-contour)' }}
            />
            <circle data-r="halo" cx="100" cy="18" r="14" opacity="0.3" style={STYLE_SIGNAL} />
            <circle
              data-r="ampoule"
              cx="100"
              cy="18"
              r="7"
              strokeWidth="2"
              style={{ ...STYLE_SIGNAL, stroke: 'var(--robot-contour)' }}
            />
          </g>

          {/* Oreilles */}
          <rect x="24" y="74" width="12" height="32" rx="6" style={STYLE_MEMBRE} strokeWidth="2" />
          <rect x="164" y="74" width="12" height="32" rx="6" style={STYLE_MEMBRE} strokeWidth="2" />

          {/* Crane */}
          <rect
            x="34"
            y="40"
            width="132"
            height="100"
            rx="38"
            fill={`url(#${idCorps})`}
            style={{ stroke: 'var(--robot-contour)' }}
            strokeWidth="2"
          />

          {/* Visiere sombre et reflet */}
          <rect x="46" y="52" width="108" height="76" rx="28" fill={`url(#${idVisiere})`} />
          <ellipse
            cx="80"
            cy="62"
            rx="24"
            ry="5"
            transform="rotate(-10 80 62)"
            fill="#ffffff"
            opacity="0.07"
          />

          {/* Joues */}
          <ellipse
            data-r="joueG"
            cx="62"
            cy="106"
            rx="7"
            ry="4.5"
            fill="#ff8fab"
            opacity={POSES.repos.joue}
          />
          <ellipse
            data-r="joueD"
            cx="138"
            cy="106"
            rx="7"
            ry="4.5"
            fill="#ff8fab"
            opacity={POSES.repos.joue}
          />

          {/* Oeil gauche */}
          <g data-r="oeilG">
            <ellipse cx={OEIL_G.x} cy={OEIL_G.y} rx={OEIL_RX} ry={OEIL_RY} style={STYLE_OEIL} />
            <g clipPath={`url(#${idDecoupeG})`}>
              <g data-r="regardG">
                <circle
                  data-r="pupilleG"
                  cx={OEIL_G.x}
                  cy={OEIL_G.y}
                  r={PUPILLE_R}
                  style={STYLE_PUPILLE}
                />
                <circle
                  data-r="refletG"
                  cx={OEIL_G.x - 2.6}
                  cy={OEIL_G.y - 3.2}
                  r="2.5"
                  fill="#ffffff"
                  opacity="0.9"
                />
              </g>
            </g>
          </g>

          {/* Oeil droit */}
          <g data-r="oeilD">
            <ellipse cx={OEIL_D.x} cy={OEIL_D.y} rx={OEIL_RX} ry={OEIL_RY} style={STYLE_OEIL} />
            <g clipPath={`url(#${idDecoupeD})`}>
              <g data-r="regardD">
                <circle
                  data-r="pupilleD"
                  cx={OEIL_D.x}
                  cy={OEIL_D.y}
                  r={PUPILLE_R}
                  style={STYLE_PUPILLE}
                />
                <circle
                  data-r="refletD"
                  cx={OEIL_D.x - 2.6}
                  cy={OEIL_D.y - 3.2}
                  r="2.5"
                  fill="#ffffff"
                  opacity="0.9"
                />
              </g>
            </g>
          </g>
          {/* Paupieres basses : elles montent quand le robot est content (yeux souriants), */}
          {/* et restent dans la visiere (decoupe) pour ne jamais deborder sur le crane. */}
          <g clipPath={`url(#${idDecoupeVisiere})`}>
            <ellipse
              data-r="paupiereG"
              cx={OEIL_G.x}
              cy="122"
              rx="15.8"
              ry="18"
              fill={`url(#${idVisiere})`}
            />
            <ellipse
              data-r="paupiereD"
              cx={OEIL_D.x}
              cy="122"
              rx="15.8"
              ry="18"
              fill={`url(#${idVisiere})`}
            />
          </g>

          {/* Sourcils */}
          <line
            data-r="sourcilG"
            x1={OEIL_G.x - 12}
            y1={SOURCIL_Y}
            x2={OEIL_G.x + 12}
            y2={SOURCIL_Y}
            strokeWidth="4.2"
            strokeLinecap="round"
            style={STYLE_SOURCIL}
          />
          <line
            data-r="sourcilD"
            x1={OEIL_D.x - 12}
            y1={SOURCIL_Y}
            x2={OEIL_D.x + 12}
            y2={SOURCIL_Y}
            strokeWidth="4.2"
            strokeLinecap="round"
            style={STYLE_SOURCIL}
          />

          {/* Bouche */}
          <path
            data-r="bouche"
            d={BOUCHE_INITIALE}
            strokeWidth="3.4"
            strokeLinejoin="round"
            style={{
              fill: 'var(--robot-bouche)',
              stroke: 'var(--robot-oeil)',
              transition: TRANSITION_COULEUR,
            }}
          />
        </g>

        {/* Bras (devant le corps et la tete : la main peut venir au menton) */}
        <g
          data-r="brasG"
          transform={`translate(${EPAULE_G.x} ${EPAULE_G.y}) rotate(${POSES.repos.brasG})`}
        >
          <rect x="-5.5" y="0" width="11" height="31" rx="5.5" style={STYLE_MEMBRE} strokeWidth="2" />
          <circle cx="0" cy="0" r="7" style={STYLE_MEMBRE} strokeWidth="2" />
          <circle cx="0" cy="32" r="7.5" style={STYLE_MEMBRE} strokeWidth="2" />
        </g>
        <g
          data-r="brasD"
          transform={`translate(${EPAULE_D.x} ${EPAULE_D.y}) rotate(${POSES.repos.brasD})`}
        >
          <rect x="-5.5" y="0" width="11" height="31" rx="5.5" style={STYLE_MEMBRE} strokeWidth="2" />
          <circle cx="0" cy="0" r="7" style={STYLE_MEMBRE} strokeWidth="2" />
          <circle cx="0" cy="32" r="7.5" style={STYLE_MEMBRE} strokeWidth="2" />
        </g>

        {/* Goutte de sueur (quand il est inquiet) */}
        <path
          data-r="goutte"
          d="M0 -7 C4 -1 5 3 0 6 C-5 3 -4 -1 0 -7 Z"
          transform="translate(148 62)"
          opacity="0"
          style={{ fill: 'var(--info)' }}
        />
      </g>

      {/* Bulles de reflexion (quand il analyse) */}
      <circle data-r="pensee0" cx="150" cy="36" r="3.2" opacity="0" style={STYLE_SIGNAL} />
      <circle data-r="pensee1" cx="161" cy="23" r="4.6" opacity="0" style={STYLE_SIGNAL} />
      <circle data-r="pensee2" cx="176" cy="8" r="6.4" opacity="0" style={STYLE_SIGNAL} />

      {/* Etincelles (quand le fichier est pret) */}
      <path
        data-r="etincelleG"
        d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
        transform="translate(24 46) scale(0)"
        opacity="0"
        style={STYLE_SIGNAL}
      />
      <path
        data-r="etincelleD"
        d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
        transform="translate(178 58) scale(0)"
        opacity="0"
        style={STYLE_SIGNAL}
      />
    </svg>
  )
}