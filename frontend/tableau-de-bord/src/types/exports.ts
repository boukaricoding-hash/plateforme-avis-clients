import type { Langue } from './langue'
import type {
  ChoixPeriode,
  LigneClassement,
  PointSerie,
  ReponseKpis,
  ScoreTheme,
  StatutTraitement,
} from './tableau-de-bord'

// Types de l'ecran E16 (jour 21) : exports et rapports.
// Ils reproduisent ce que demande et renvoie le backend :
// - POST /api/v1/exports          : demande { format, langue, filtres } -> le fichier (csv, xlsx ou pdf)
// - POST /api/v1/exports/analyse  : demande { langue, filtres } -> l'analyse en JSON (lue par le robot)
// Une valeur null venant de l'API veut dire "pas de donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Demande envoyee a l'API
// ------------------------------------------------------------

export type FormatExport = 'csv' | 'xlsx' | 'pdf'

// Filtres tels qu'ils partent dans le corps de la demande (noms du backend, memes que la liste des avis).
// from et to vont toujours ensemble (AAAA-MM-JJ, jours complets). Sans les deux, csv et xlsx
// exportent tous les avis et le rapport pdf prend les 30 derniers jours.
export type FiltresExport = {
  from?: string
  to?: string
  site?: string
  point?: string
  questionnaire?: string
  statut?: StatutTraitement
  // Avis negatifs (ceux qui ont declenche une alerte) et avis avec commentaire.
  negatifs?: boolean
  avec_commentaire?: boolean
  // Tranche de notes, de 1 a 5.
  note_min?: number
  note_max?: number
  // Recherche dans le commentaire (100 caracteres au plus).
  q?: string
}

// POST /exports
export type DemandeExport = {
  format: FormatExport
  langue: Langue
  filtres: FiltresExport
}

// POST /exports/analyse : pas de format, le robot analyse avant que le format soit choisi.
export type DemandeAnalyse = {
  langue: Langue
  filtres: FiltresExport
}

// ------------------------------------------------------------
// POST /exports/analyse : ce que dit le robot
// ------------------------------------------------------------

// Le code dit de quoi parle le point (sert a choisir l'icone et la couleur).
export type CodePointAnalyse =
  // Points forts
  | 'note_elevee'
  | 'nps_eleve'
  | 'csat_eleve'
  | 'progression_note'
  | 'meilleur_theme'
  | 'meilleur_point'
  | 'aucune_alerte'
  | 'taux_reponse_eleve'
  // Points faibles
  | 'note_basse'
  | 'note_moyenne'
  | 'baisse_note'
  | 'nps_negatif'
  | 'theme_faible'
  | 'point_faible'
  | 'alertes_qui_trainent'
  | 'negatifs_concentres'
  | 'taux_reponse_faible'
  // Piste quand tout va bien
  | 'maintenir'

// Un point fort, un point faible ou une piste d'action. Les textes sont deja dans la langue demandee.
export type PointAnalyse = {
  code: CodePointAnalyse
  titre: string
  detail: string
}

// Avis negatifs par jour de la semaine (jours UTC, Africa/Lome = UTC+0).
export type NegatifsParJour = {
  total: number
  // Index 0 = dimanche, 1 = lundi, ..., 6 = samedi.
  par_jour_semaine: number[]
  pic: { date: string; nombre: number } | null
}

// Les chiffres que l'analyse a lus : memes formes que les routes /dashboard/*.
export type DonneesAnalyse = {
  kpis: ReponseKpis
  themes: ScoreTheme[]
  classement: LigneClassement[]
  serie: PointSerie[]
  negatifs: NegatifsParJour
}

export type ReponseAnalyse = {
  langue: Langue
  periode: { from: string; to: string; nombre_jours: number }
  nb_avis: number
  // false : trop peu d'avis pour conclure (points forts, points faibles et pistes sont vides).
  suffisant: boolean
  resume: string
  points_forts: PointAnalyse[]
  points_faibles: PointAnalyse[]
  pistes: PointAnalyse[]
  donnees: DonneesAnalyse
}

// ------------------------------------------------------------
// Ecran E16 (choix de l'utilisateur et etat du robot)
// ------------------------------------------------------------

// Les indications a droite de la barre : 1 Format, 2 Periode et filtres, 3 Generer, 4 Telecharger.
export type EtapeExport = 1 | 2 | 3 | 4

// Humeurs du robot : repos, ecoute (quand on tape), reflechit (pendant l'analyse),
// content (fichier pret), inquiet (il voit un probleme).
export type HumeurRobot = 'repos' | 'ecoute' | 'reflechit' | 'content' | 'inquiet'

// Etat d'une operation de l'ecran : l'analyse des avis, puis la creation du fichier.
export type EtatOperation = 'repos' | 'en_cours' | 'termine' | 'erreur'

// Periodes proposees : celles du tableau de bord, plus "tout" (aucune date, tous les avis).
export type PeriodeExport = ChoixPeriode | 'tout'

// Ce que l'utilisateur a choisi sur l'ecran. Une chaine vide veut dire "tous" (ou "pas de date").
// debut et fin (AAAA-MM-JJ) ne servent que pour la periode personnalisee.
export type FiltresEcranExport = {
  periode: PeriodeExport
  debut: string
  fin: string
  site: string
  point: string
  questionnaire: string
  statut: '' | StatutTraitement
  negatifs: boolean
  avecCommentaire: boolean
}