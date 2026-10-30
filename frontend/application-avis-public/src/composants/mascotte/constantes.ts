// Couleurs tirees de la couleur principale de l'organisation : la mascotte change de teinte
// avec elle. Le reste vient des variables du site (texte, decor, alerte, info...).
export const CLAIR = 'color-mix(in srgb, var(--couleur-principale) 62%, white)'
export const FONCE = 'color-mix(in srgb, var(--couleur-principale) 78%, black)'
// Ton le plus sombre du corps (cote ombre, dessous) : la lumiere vient d'en haut a gauche.
export const SOMBRE = 'color-mix(in srgb, var(--couleur-principale) 84%, black)'
export const JOUE = 'color-mix(in srgb, var(--couleur-decor) 70%, white)'

// Forme du corps : une bulle de dialogue avec sa petite queue en bas a gauche.
export const CORPS =
  'M74 30 H126 A46 46 0 0 1 172 76 V102 A46 46 0 0 1 126 148 H106 Q88 152 54 178 Q68 162 76 148 A46 46 0 0 1 28 102 V76 A46 46 0 0 1 74 30 Z'

// Contour de la petite queue seule (pour l'assombrir : elle est dans l'ombre du corps).
export const QUEUE = 'M106 148 Q88 152 54 178 Q68 162 76 148 Z'

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