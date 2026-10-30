// Les humeurs de la mascotte. Chaque ecran choisit celle qui lui va :
// - accueil : elle sourit et fait coucou ;
// - attentif : elle regarde la question ;
// - content : bonne note, elle saute de joie ;
// - triste : mauvaise note, elle est embetee (sans dramatiser) ;
// - ecoute : le client ecrit son commentaire, elle penche la tete ;
// - ravi : merci, elle est ravie et il y a des confettis.
export type HumeurMascotte = 'accueil' | 'attentif' | 'content' | 'triste' | 'ecoute' | 'ravi'

export type ProprietesMascotte = {
  humeur: HumeurMascotte
  // Largeur en pixels (la hauteur suit).
  taille?: number
  className?: string
  // Texte lu par les lecteurs d'ecran. Sans lui, la mascotte est purement decoratrice.
  titre?: string
}