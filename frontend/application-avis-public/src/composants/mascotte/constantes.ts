// Couleurs tirees de la couleur principale de l'organisation : la mascotte change de teinte
// avec elle. Le reste vient des variables du site (texte, decor, alerte, info...).
// Lumiere chaude (comme un soleil doux) : elle eclaircit sans griser la couleur principale.
export const LUMIERE = '#ffcf9f'
// Ombre chaude : assombrit sans griser (un noir pur donnerait du marron terne).
export const OMBRE_CHAUDE = '#3a1208'
export const CLAIR = 'color-mix(in srgb, var(--couleur-principale) 70%, ' + LUMIERE + ')'
export const FONCE = 'color-mix(in srgb, var(--couleur-principale) 78%, black)'
// Tons sombres du corps (bas de la bulle) : la lumiere vient d'en haut.
export const SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 70%, ' + OMBRE_CHAUDE + ')'
export const JOUE = 'color-mix(in srgb, var(--couleur-decor) 55%, #ff7f6e)'

// Forme du corps : une bulle de dialogue bien ronde et joufflue, avec sa petite queue en bas a gauche.
export const CORPS =
  'M64 28 Q100 24 136 28 C160 28 176 44 176 68 Q179 84 176 98 C176 126 158 146 132 146 H110 Q94 150 60 174 Q70 160 76 146 C44 146 24 126 24 98 Q21 84 24 68 C24 44 40 28 64 28 Z'

// Contour de la petite queue seule (pour l'assombrir : elle est dans l'ombre du corps).
export const QUEUE = 'M110 146 Q94 150 60 174 Q70 160 76 146 Z'

// Etoile a 4 branches (centree sur 0,0) pour les eclats.
export const ETOILE = 'M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z'

// Confettis du merci : position, couleur, retard et duree de chute.
export const CONFETTIS = [
  { x: 18, c: 'var(--couleur-decor)', r: 0, d: 2.4 },
  { x: 40, c: 'var(--alerte)', r: 0.5, d: 2.8 },
  { x: 62, c: 'var(--info)', r: 0.2, d: 2.5 },
  { x: 84, c: 'var(--succes)', r: 0.9, d: 3 },
  { x: 106, c: 'var(--couleur-principale)', r: 0.3, d: 2.6 },
  { x: 128, c: 'var(--alerte)', r: 1.1, d: 2.9 },
  { x: 150, c: 'var(--couleur-decor)', r: 0.6, d: 2.5 },
  { x: 172, c: 'var(--info)', r: 0.1, d: 2.7 },
  { x: 30, c: 'var(--succes)', r: 1.3, d: 3 },
  { x: 140, c: 'var(--couleur-principale)', r: 1.5, d: 2.6 },
]