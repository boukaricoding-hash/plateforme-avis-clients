import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { HumeurMascotte } from '../types'
import { utiliserAnimationsReduites } from './utiliser-ressort'

// Comment le corps bouge dans chaque humeur.
type Comportement = {
  // Hauteur du flottement au repos (unites du dessin). 0 = pose au sol.
  flottement: number
  // Amplitude de la respiration (proportion de la hauteur du corps).
  respiration: number
  // Duree d'un cycle de flottement et de respiration (secondes).
  periode: number
  // Inclinaison de repos (degres) et amplitude du balancement autour d'elle.
  inclinaison: number
  balancement: number
  // Posture tassee au repos (0 = droite, 0.05 = un peu ecrasee).
  affaissement: number
  // Si elle saute : hauteur, pause entre deux sauts (secondes), petit mouvement de rotation au depart.
  saut: { hauteur: number; intervalle: number; elan: number } | null
}

const COMPORTEMENTS: Record<HumeurMascotte, Comportement> = {
  reflexion: {
    flottement: 3, respiration: 0.01, periode: 4,
    inclinaison: 4, balancement: 1.5, affaissement: 0, saut: null,
  },
  // Un seul sursaut a l'arrivee (la pause entre deux sauts est tres longue).
  surpris: {
    flottement: 2, respiration: 0.012, periode: 3.2,
    inclinaison: 0, balancement: 0, affaissement: 0,
    saut: { hauteur: 12, intervalle: 99, elan: 0 },
  },
  accueil: {
    flottement: 5, respiration: 0.01, periode: 3.4,
    inclinaison: 0, balancement: 0, affaissement: 0, saut: null,
  },
  attentif: {
    flottement: 4, respiration: 0.01, periode: 3.8,
    inclinaison: -3, balancement: 1, affaissement: 0, saut: null,
  },
  ecoute: {
    flottement: 4, respiration: 0.01, periode: 3.6,
    inclinaison: 5, balancement: 1.5, affaissement: 0, saut: null,
  },
  triste: {
    flottement: 1, respiration: 0.014, periode: 4.2,
    inclinaison: -2, balancement: 0.5, affaissement: 0.05, saut: null,
  },
  content: {
    flottement: 0, respiration: 0.008, periode: 3,
    inclinaison: 0, balancement: 0, affaissement: 0,
    saut: { hauteur: 14, intervalle: 1.5, elan: 0 },
  },
  ravi: {
    flottement: 0, respiration: 0.008, periode: 3,
    inclinaison: -1, balancement: 0, affaissement: 0,
    saut: { hauteur: 22, intervalle: 1.15, elan: 35 },
  },
}

// Gravite du dessin (unites par seconde au carre) : un peu « dessin anime », elle flotte en l'air.
const GRAVITE = 520
// Pas de calcul fixe : le resultat ne depend pas de la vitesse du telephone.
const PAS = 1 / 120
// Ecart maximum entre deux images (evite un saut quand l'onglet revient au premier plan).
const ECART_MAX = 1 / 30
// Preparation avant le saut : duree et profondeur de l'accroupissement.
const DUREE_PREPARATION = 0.17
const AMPLEUR_PREPARATION = 0.13

type Etat = {
  // Avancement du cycle de flottement et de respiration (radians).
  cycle: number
  // Hauteur du saut (negatif = en l'air) et vitesse.
  y: number
  vy: number
  // Ecrasement (0 = droite, positif = ecrasee, negatif = etiree) et sa vitesse.
  ecrasement: number
  vEcrasement: number
  // Inclinaison (degres) et sa vitesse.
  rot: number
  vRot: number
  // Hauteur de flottement adoucie quand l'humeur change.
  flottement: number
  phase: 'repos' | 'prepare' | 'vol'
  // Temps restant avant la phase suivante.
  chrono: number
  // Alterne gauche / droite pour le petit mouvement de rotation du saut.
  sens: number
}

// Anime le corps de la mascotte : flottement, respiration, inclinaison, sauts avec preparation,
// etirement, ecrasement et rebond a l'atterrissage, et l'ombre au sol qui suit la hauteur.
// Ecrit directement dans le dessin (pas de rendu React a chaque image) : leger sur un petit telephone.
export function utiliserMouvement(
  humeur: HumeurMascotte,
  refCorps: RefObject<SVGGElement | null>,
  refOmbre: RefObject<SVGGElement | null>,
): void {
  const reduit = utiliserAnimationsReduites()
  // L'etat est garde d'une humeur a l'autre : le mouvement continue sans a-coup.
  const etat = useRef<Etat | null>(null)

  useEffect(() => {
    const corps = refCorps.current
    const ombre = refOmbre.current
    if (!corps || !ombre) return

    if (reduit) {
      corps.style.transform = ''
      ombre.style.transform = ''
      ombre.style.opacity = ''
      return
    }

    const c = COMPORTEMENTS[humeur]
    if (etat.current === null) {
      etat.current = {
        cycle: 0, y: 0, vy: 0,
        ecrasement: c.affaissement, vEcrasement: 0,
        rot: c.inclinaison, vRot: 0,
        flottement: c.flottement,
        phase: 'repos', chrono: c.saut ? c.saut.intervalle : 0, sens: 1,
      }
    }
    const e = etat.current

    // Transition vers la nouvelle humeur.
    if (c.saut && e.phase === 'repos') e.chrono = 0.05
    if (!c.saut && e.phase === 'prepare') e.phase = 'repos'
    if (c.affaissement > 0.02) e.vEcrasement += 1.5

    let image = 0
    let precedent: number | null = null

    const boucle = (maintenant: number) => {
      const dt = precedent === null ? 0 : Math.min((maintenant - precedent) / 1000, ECART_MAX)
      precedent = maintenant

      // Decisions du saut : attendre, s'accroupir, partir.
      if (e.phase === 'repos' && c.saut) {
        e.chrono -= dt
        if (e.chrono <= 0) {
          e.phase = 'prepare'
          e.chrono = DUREE_PREPARATION
        }
      } else if (e.phase === 'prepare') {
        e.chrono -= dt
        if (e.chrono <= 0) {
          if (c.saut) {
            e.phase = 'vol'
            e.vy = -Math.sqrt(2 * GRAVITE * c.saut.hauteur)
            e.sens = -e.sens
            e.vRot += c.saut.elan * e.sens
          } else {
            e.phase = 'repos'
          }
        }
      }

      e.cycle += (dt * 2 * Math.PI) / c.periode
      e.flottement += (c.flottement - e.flottement) * (1 - Math.exp(-dt * 4))
      const rotCible = c.inclinaison + c.balancement * Math.sin(e.cycle)
      const ecrasementCible = c.affaissement + (e.phase === 'prepare' ? AMPLEUR_PREPARATION : 0)

      // Physique, par petits pas fixes.
      let reste = dt
      while (reste > 0) {
        const h = Math.min(PAS, reste)
        reste -= h

        if (e.phase === 'vol') {
          e.vy += GRAVITE * h
          e.y += e.vy * h
          if (e.y >= 0 && e.vy > 0) {
            // Atterrissage : elle s'ecrase d'autant plus qu'elle tombe vite, puis petit rebond.
            const impact = e.vy
            e.y = 0
            e.vEcrasement += impact * 0.018
            if (impact > 70) {
              e.vy = -impact * 0.22
            } else {
              e.vy = 0
              e.phase = 'repos'
              e.chrono = c.saut ? c.saut.intervalle : 0
            }
          }
        }

        // Ressort d'ecrasement et ressort d'inclinaison.
        e.vEcrasement += (260 * (ecrasementCible - e.ecrasement) - 16 * e.vEcrasement) * h
        e.ecrasement += e.vEcrasement * h
        e.vRot += (90 * (rotCible - e.rot) - 10 * e.vRot) * h
        e.rot += e.vRot * h
      }

      // Rendu : hauteur totale, ecrasement / etirement (volume conserve), respiration.
      const flotte = -e.flottement * (0.5 - 0.5 * Math.cos(e.cycle))
      const yTotal = e.y + flotte
      const ecras = Math.min(0.25, Math.max(-0.1, e.ecrasement))
      const etirement = e.phase === 'vol' ? Math.min(0.1, Math.abs(e.vy) * 0.0007) : 0
      const respiration = 1 + c.respiration * Math.sin(e.cycle)
      const sy = respiration * (1 - ecras) * (1 + etirement)
      const sx = 1 / sy

      corps.style.transform =
        'translate(0px, ' + yTotal.toFixed(2) + 'px) rotate(' + e.rot.toFixed(2) +
        'deg) scale(' + sx.toFixed(4) + ', ' + sy.toFixed(4) + ')'

      // Ombre au sol : plus petite et plus claire quand elle est haut, plus large quand elle s'ecrase.
      const k = Math.min(1, Math.max(0, -yTotal) / 26)
      const echelle = (1 - 0.35 * k) * (1 + 0.8 * Math.max(0, ecras))
      ombre.style.transform = 'scale(' + echelle.toFixed(3) + ', 1)'
      ombre.style.opacity = (1 - 0.55 * k).toFixed(3)

      image = requestAnimationFrame(boucle)
    }

    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [humeur, reduit, refCorps, refOmbre])
}