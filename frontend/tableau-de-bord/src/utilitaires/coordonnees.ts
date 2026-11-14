// Coordonnees de l'entreprise montrees sur l'ecran de connexion : bouton de contact,
// pied de page et mentions legales.
// Une valeur vide = l'element correspondant n'est pas affiche (aucune fausse information).
// Pour renseigner une valeur, ecrire entre les guillemets, sans toucher au reste du fichier.
type Coordonnees = {
  // Numero WhatsApp avec l'indicatif du pays ; espaces et "+" sont acceptes
  whatsapp: string
  // Adresse e-mail de contact
  email: string
  // Nom de l'entreprise dans les mentions legales
  nomLegal: string
  // Responsable de la publication
  responsable: string
  // Adresse postale de l'entreprise
  adresse: string
  // Nom de l'hebergeur du site
  hebergeur: string
}

export const COORDONNEES: Coordonnees = {
  whatsapp: '',
  email: '',
  nomLegal: 'DATA TRACE SERVICE',
  responsable: '',
  adresse: '',
  hebergeur: '',
}

// Lien WhatsApp avec un message deja ecrit, ou null si aucun numero n'est renseigne.
export function lienWhatsapp(message: string): string | null {
  const chiffres = COORDONNEES.whatsapp.replace(/\D/g, '')
  if (chiffres === '') {
    return null
  }
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`
}

// Lien e-mail avec un sujet et un message, ou null si aucune adresse n'est renseignee.
export function lienEmail(sujet: string, message: string): string | null {
  const adresse = COORDONNEES.email.trim()
  if (adresse === '') {
    return null
  }
  return `mailto:${adresse}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message)}`
}

// Vrai si au moins un moyen de contact est renseigne.
export function contactDisponible(): boolean {
  return lienWhatsapp('') !== null || lienEmail('', '') !== null
}