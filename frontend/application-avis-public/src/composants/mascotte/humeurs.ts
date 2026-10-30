import type { HumeurMascotte } from './types'

// Chaque humeur est decrite par des nombres seulement. C'est ce qui permet de passer
// d'une humeur a l'autre en continu (la bouche se deforme, les sourcils glissent)
// au lieu d'un fondu entre deux dessins.
// Les valeurs viennent des traces actuels de visage.tsx : le dessin ne change pas.

// Un sourcil : courbe de (x1, y1) a (x2, y2) avec le point de controle (cx, cy).
// Toujours dessine du bord exterieur vers l'interieur du visage.
export type Sourcil = {
  x1: number
  y1: number
  cx: number
  cy: number
  x2: number
  y2: number
}

export type ParametresHumeur = {
  bouche: {
    // Coin gauche et coin droit.
    gx: number
    gy: number
    dx: number
    dy: number
    // Hauteur du point de controle de la courbe du bas (celle du sourire).
    bas: number
    // Hauteur du point de controle de la courbe du haut.
    // Egale a « bas » : un simple trait. Plus haute : une bouche ouverte.
    haut: number
    // 0 = trait seul, 1 = bouche ouverte pleine (le trait s'efface, le remplissage apparait).
    remplissage: number
    // Langue (visible seulement quand la bouche est ouverte).
    langueY: number
    langueRx: number
    langueRy: number
  }
  sourcils: {
    g: Sourcil
    d: Sourcil
    // 0 = pas de sourcils, 1 = visibles.
    opacite: number
  }
  yeux: {
    // 1 = ouverts, 0 = fermes (paupieres baissees).
    ouverture: number
    // 0 = pas de sourire des yeux, 1 = yeux fermes qui rient (arcs).
    rire: number
    // Deplacement du regard et taille des pupilles (elles se dilatent avec l'emotion).
    pupilleX: number
    pupilleY: number
    rayonPupille: number
  }
  joues: { opacite: number }
  goutte: { opacite: number }
}

export const PARAMETRES_HUMEURS: Record<HumeurMascotte, ParametresHumeur> = {
  reflexion: {
    bouche: {
      gx: 93, gy: 118, dx: 109, dy: 115,
      bas: 117, haut: 117, remplissage: 0,
      langueY: 118, langueRx: 0, langueRy: 0,
    },
    sourcils: {
      g: { x1: 64, y1: 64, cx: 78, cy: 60, x2: 92, y2: 62 },
      d: { x1: 136, y1: 56, cx: 122, cy: 46, x2: 108, y2: 54 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: -4, pupilleY: -3, rayonPupille: 9 },
    joues: { opacite: 0.7 },
    goutte: { opacite: 0 },
  },
  surpris: {
    bouche: {
      gx: 93, gy: 111, dx: 107, dy: 111,
      bas: 134, haut: 98, remplissage: 1,
      langueY: 124, langueRx: 4.5, langueRy: 2.6,
    },
    sourcils: {
      g: { x1: 62, y1: 52, cx: 78, cy: 40, x2: 94, y2: 50 },
      d: { x1: 138, y1: 52, cx: 122, cy: 40, x2: 106, y2: 50 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: 0, pupilleY: 0, rayonPupille: 7 },
    joues: { opacite: 0.6 },
    goutte: { opacite: 0 },
  },
  accueil: {
    bouche: {
      gx: 81, gy: 106, dx: 119, dy: 106,
      bas: 144, haut: 110, remplissage: 1,
      langueY: 122, langueRx: 9, langueRy: 5.5,
    },
    sourcils: {
      g: { x1: 64, y1: 60, cx: 78, cy: 52, x2: 92, y2: 58 },
      d: { x1: 136, y1: 60, cx: 122, cy: 52, x2: 108, y2: 58 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: 0, pupilleY: 0, rayonPupille: 9 },
    joues: { opacite: 0.7 },
    goutte: { opacite: 0 },
  },
  attentif: {
    bouche: {
      gx: 90, gy: 114, dx: 110, dy: 114,
      bas: 120, haut: 120, remplissage: 0,
      langueY: 118, langueRx: 0, langueRy: 0,
    },
    sourcils: {
      g: { x1: 64, y1: 62, cx: 78, cy: 54, x2: 92, y2: 60 },
      d: { x1: 136, y1: 62, cx: 122, cy: 54, x2: 108, y2: 60 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: 4, pupilleY: 3, rayonPupille: 9.5 },
    joues: { opacite: 0.7 },
    goutte: { opacite: 0 },
  },
  content: {
    bouche: {
      gx: 80, gy: 106, dx: 120, dy: 106,
      bas: 134, haut: 112, remplissage: 1,
      langueY: 119, langueRx: 9, langueRy: 5,
    },
    sourcils: {
      g: { x1: 64, y1: 58, cx: 78, cy: 48, x2: 92, y2: 56 },
      d: { x1: 136, y1: 58, cx: 122, cy: 48, x2: 108, y2: 56 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: 0, pupilleY: -1, rayonPupille: 9.8 },
    joues: { opacite: 0.9 },
    goutte: { opacite: 0 },
  },
  triste: {
    bouche: {
      gx: 86, gy: 123, dx: 114, dy: 123,
      bas: 109, haut: 109, remplissage: 0,
      langueY: 118, langueRx: 0, langueRy: 0,
    },
    sourcils: {
      g: { x1: 64, y1: 70, cx: 78, cy: 66, x2: 92, y2: 58 },
      d: { x1: 136, y1: 70, cx: 122, cy: 66, x2: 108, y2: 58 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: 0, pupilleY: 4, rayonPupille: 8 },
    joues: { opacite: 0.7 },
    goutte: { opacite: 1 },
  },
  ecoute: {
    bouche: {
      gx: 91, gy: 116, dx: 109, dy: 116,
      bas: 121, haut: 121, remplissage: 0,
      langueY: 118, langueRx: 0, langueRy: 0,
    },
    sourcils: {
      g: { x1: 66, y1: 64, cx: 78, cy: 60, x2: 90, y2: 63 },
      d: { x1: 134, y1: 60, cx: 122, cy: 52, x2: 110, y2: 58 },
      opacite: 1,
    },
    yeux: { ouverture: 1, rire: 0, pupilleX: -3, pupilleY: -4, rayonPupille: 9 },
    joues: { opacite: 0.7 },
    goutte: { opacite: 0 },
  },
  ravi: {
    bouche: {
      gx: 76, gy: 104, dx: 124, dy: 104,
      bas: 142, haut: 112, remplissage: 1,
      langueY: 124, langueRx: 12, langueRy: 7,
    },
    sourcils: {
      g: { x1: 64, y1: 58, cx: 78, cy: 48, x2: 92, y2: 56 },
      d: { x1: 136, y1: 58, cx: 122, cy: 48, x2: 108, y2: 56 },
      opacite: 1,
    },
    yeux: { ouverture: 0, rire: 1, pupilleX: 0, pupilleY: 0, rayonPupille: 9 },
    joues: { opacite: 0.9 },
    goutte: { opacite: 0 },
  },
}