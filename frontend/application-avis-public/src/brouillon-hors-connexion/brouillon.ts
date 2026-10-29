import type { Langue, ValeurReponse } from '../types/avis-public'
import { creerCleUnique } from '../utilitaires/cle-unique'

// Brouillon d'un avis, garde sur le telephone (localStorage), un par QR code.
// Il contient les reponses, le commentaire, les coordonnees et la cle unique
// de l'envoi : un renvoi apres coupure du reseau garde la meme cle.

export type Brouillon = {
  // Version du questionnaire vue par le client : un brouillon d'une autre version est ignore.
  version_id: string
  cle_unique: string
  langue: Langue
  reponses: Record<string, ValeurReponse>
  commentaire: string
  contact_nom: string
  contact_tel: string
  contact_email: string
  consentement: boolean
  // Vrai des que le client a touche Envoyer et que le serveur n'a pas encore confirme.
  // C'est ce qui declenche le renvoi automatique au retour du reseau.
  envoi_en_attente: boolean
  // Date de derniere modification (millisecondes).
  mis_a_jour_le: number
}

const PREFIXE = 'brouillon-avis:'
// Un brouillon plus vieux que 24 heures est oublie.
const DUREE_MAX_MS = 24 * 60 * 60 * 1000

function cleStockage(code: string): string {
  return PREFIXE + code
}

// Brouillon vide, avec une nouvelle cle unique.
export function creerBrouillonVide(versionId: string, langue: Langue): Brouillon {
  return {
    version_id: versionId,
    cle_unique: creerCleUnique(),
    langue,
    reponses: {},
    commentaire: '',
    contact_nom: '',
    contact_tel: '',
    contact_email: '',
    consentement: false,
    envoi_en_attente: false,
    mis_a_jour_le: Date.now(),
  }
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

// Verifie la forme d'un brouillon lu : le stockage peut contenir n'importe quoi.
function versBrouillon(valeur: unknown): Brouillon | null {
  if (!estObjet(valeur)) {
    return null
  }
  const {
    version_id,
    cle_unique,
    langue,
    reponses,
    commentaire,
    contact_nom,
    contact_tel,
    contact_email,
    consentement,
    envoi_en_attente,
    mis_a_jour_le,
  } = valeur
  if (
    typeof version_id !== 'string' ||
    typeof cle_unique !== 'string' ||
    (langue !== 'fr' && langue !== 'en') ||
    !estObjet(reponses) ||
    typeof commentaire !== 'string' ||
    typeof contact_nom !== 'string' ||
    typeof contact_tel !== 'string' ||
    typeof contact_email !== 'string' ||
    typeof consentement !== 'boolean' ||
    typeof envoi_en_attente !== 'boolean' ||
    typeof mis_a_jour_le !== 'number'
  ) {
    return null
  }
  return {
    version_id,
    cle_unique,
    langue,
    reponses: reponses as Record<string, ValeurReponse>,
    commentaire,
    contact_nom,
    contact_tel,
    contact_email,
    consentement,
    envoi_en_attente,
    mis_a_jour_le,
  }
}

// Lit le brouillon d'un QR code, ou null s'il n'y en a pas, s'il est trop vieux,
// abime, ou s'il vient d'une autre version du questionnaire.
// Le stockage peut etre bloque (navigation privee) : dans ce cas, null aussi.
export function lireBrouillon(code: string, versionId: string): Brouillon | null {
  try {
    const texte = localStorage.getItem(cleStockage(code))
    if (texte === null) {
      return null
    }
    const brouillon = versBrouillon(JSON.parse(texte) as unknown)
    if (
      brouillon === null ||
      brouillon.version_id !== versionId ||
      Date.now() - brouillon.mis_a_jour_le > DUREE_MAX_MS
    ) {
      effacerBrouillon(code)
      return null
    }
    return brouillon
  } catch {
    return null
  }
}

// Enregistre le brouillon. Un echec (stockage plein ou bloque) est ignore :
// la page continue de fonctionner, seule la protection hors connexion manque.
export function sauverBrouillon(code: string, brouillon: Brouillon): void {
  try {
    const aEcrire: Brouillon = { ...brouillon, mis_a_jour_le: Date.now() }
    localStorage.setItem(cleStockage(code), JSON.stringify(aEcrire))
  } catch {
    // Rien a faire.
  }
}

export function effacerBrouillon(code: string): void {
  try {
    localStorage.removeItem(cleStockage(code))
  } catch {
    // Rien a faire.
  }
}