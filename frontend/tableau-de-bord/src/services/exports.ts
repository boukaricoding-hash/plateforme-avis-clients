import type {
  DemandeAnalyse,
  DemandeExport,
  FormatExport,
  ReponseAnalyse,
} from '../types/exports'
import { appeler } from './api'
import type { FichierRecupere } from './telechargement'
import { enregistrerFichier, recupererFichier, telechargerFichier } from './telechargement'

// Tous les appels de l'ecran E16 (exports et rapports, jour 21).
// Responsable et Gestionnaire seulement (le serveur repond 403 sinon). Le Gestionnaire
// n'exporte que son perimetre : le serveur le decide, jamais le navigateur.
// Les composants n'appellent jamais fetch directement.

// Meme prefixe que dans api.ts : le fichier est recupere par recupererFichier, qui envoie
// le cookie de session sur la meme adresse.
const BASE = '/api/v1'

// Nom enregistre si le serveur n'en donne pas (il donne d'habitude "avis-AAAA-MM-JJ.xlsx").
const NOMS_PAR_DEFAUT: Record<FormatExport, string> = {
  csv: 'avis.csv',
  xlsx: 'avis.xlsx',
  pdf: 'rapport-avis.pdf',
}

// POST /exports/analyse : le robot analyse les avis filtres (note, themes, points de contact,
// alertes, jours des avis negatifs) et renvoie points forts, points faibles et pistes d'action.
// Sans format : l'analyse se fait avant que le format soit choisi. Erreur 400 si les filtres sont
// invalides (par exemple from sans to, ou une periode de plus de 366 jours).
export function analyserAvis(demande: DemandeAnalyse): Promise<ReponseAnalyse> {
  return appeler<ReponseAnalyse>('/exports/analyse', {
    method: 'POST',
    body: JSON.stringify(demande),
  })
}

// Premier temps (indication 3) : POST /exports, le serveur fabrique le fichier (csv, xlsx ou
// rapport pdf) et il arrive dans la page, sans etre enregistre sur l'appareil.
// Erreur 422 EXPORT_TROP_VOLUMINEUX si trop d'avis (csv et xlsx) : il faut reduire la periode.
export function creerExport(demande: DemandeExport): Promise<FichierRecupere> {
  return recupererFichier(`${BASE}/exports`, NOMS_PAR_DEFAUT[demande.format], {
    corps: demande,
  })
}

// Second temps (indication 4) : le fichier deja cree est enregistre sur l'appareil.
// Renvoie le nom du fichier enregistre.
export function enregistrerExport(fichier: FichierRecupere): string {
  return enregistrerFichier(fichier)
}

// Les deux temps d'un coup : le fichier est cree puis enregistre des qu'il est pret.
// Renvoie le nom du fichier enregistre. Memes erreurs que creerExport.
export function genererExport(demande: DemandeExport): Promise<string> {
  return telechargerFichier(`${BASE}/exports`, NOMS_PAR_DEFAUT[demande.format], {
    corps: demande,
  })
}