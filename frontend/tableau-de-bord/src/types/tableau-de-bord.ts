// Types de l'ecran E7 (jour 14) : formes des reponses de l'API /dashboard/*,
// des listes de filtres (sites, points de contact, questionnaires) et des filtres eux-memes.
// Une valeur null venant de l'API veut dire "aucune donnee" : ne jamais l'afficher comme 0.

// ------------------------------------------------------------
// Filtres
// ------------------------------------------------------------

// Les periodes proposees dans la barre de filtres.
export type ChoixPeriode = 'aujourdhui' | '7jours' | '30jours' | 'mois' | 'personnalisee'

// Etat de la barre de filtres. Une chaine vide veut dire "tous" (ou "pas de date").
// debut et fin (AAAA-MM-JJ) ne servent que pour la periode personnalisee.
export type FiltresTableau = {
  periode: ChoixPeriode
  debut: string
  fin: string
  site: string
  point: string
  questionnaire: string
}

// Filtres tels qu'ils partent dans l'adresse de l'API (noms du backend).
// from et to vont toujours ensemble.
export type FiltresApi = {
  from?: string
  to?: string
  site?: string
  point?: string
  questionnaire?: string
}

// ------------------------------------------------------------
// Valeurs communes
// ------------------------------------------------------------

// Periode renvoyee par l'API : dates "AAAA-MM-JJ", derniere journee comprise.
export type PeriodeApi = {
  from: string
  to: string
  nombre_jours: number
}

// Evolution par rapport a la periode precedente (meme duree).
export type Variation = {
  precedent: number | null
  // Ecart en valeur (points de note, points de NPS, avis...).
  difference: number | null
  // Ecart en pourcentage de la valeur precedente (null si elle vaut 0 ou manque).
  pourcentage: number | null
}

export type StatutTraitement = 'NOUVEAU' | 'EN_COURS' | 'TRAITE' | 'IGNORE'

export type NiveauAlerte = 'NORMAL' | 'PRIORITAIRE'

export type TypeQuestion =
  | 'ETOILES'
  | 'EMOJIS'
  | 'NPS'
  | 'CHOIX_UNIQUE'
  | 'CHOIX_MULTIPLE'
  | 'OUI_NON'
  | 'ECHELLE'
  | 'TEXTE_LIBRE'

// ------------------------------------------------------------
// GET /dashboard/kpis
// ------------------------------------------------------------

export type RepartitionNote = {
  // De 1 a 5.
  note: number
  nombre: number
}

export type Indicateurs = {
  nb_avis: number
  note_moyenne: number | null
  csat: number | null
  nps: number | null
  nb_promoteurs: number
  nb_passifs: number
  nb_detracteurs: number
  nb_reponses_nps: number
  nb_scans: number
  taux_reponse: number | null
  repartition_notes: RepartitionNote[]
}

export type Evolution = {
  nb_avis: Variation
  note_moyenne: Variation
  csat: Variation
  nps: Variation
  taux_reponse: Variation
}

export type AlerteOuverte = {
  avis_id: string
  cree_le: string
  anciennete_heures: number
  motifs: string[]
}

export type AlertesOuvertes = {
  nombre: number
  plus_ancienne_le: string | null
  anciennete_max_heures: number | null
  plus_anciennes: AlerteOuverte[]
}

export type ReponseKpis = {
  periode: PeriodeApi & { precedente: { from: string; to: string } }
  indicateurs: Indicateurs
  evolution: Evolution
  alertes_ouvertes: AlertesOuvertes
}

// ------------------------------------------------------------
// GET /dashboard/themes
// ------------------------------------------------------------

export type ScoreTheme = {
  theme_id: string
  code: string
  libelle_fr: string
  libelle_en: string
  // Moyenne sur 5.
  score: number
  nb_reponses: number
}

export type ReponseThemes = {
  periode: PeriodeApi
  // Deja tries : points faibles en premier.
  themes: ScoreTheme[]
}

// ------------------------------------------------------------
// GET /dashboard/timeseries
// ------------------------------------------------------------

export type PointSerie = {
  // "AAAA-MM-JJ"
  date: string
  nb_avis: number
  note_moyenne: number | null
  nps: number | null
}

export type ReponseSerie = {
  periode: PeriodeApi
  // Un point par jour de la periode, jours sans avis compris.
  points: PointSerie[]
}

// ------------------------------------------------------------
// GET /dashboard/ranking
// ------------------------------------------------------------

export type LigneClassement = {
  point_contact_id: string
  nom: string
  // Texte libre : table, chambre, service, salle, stand...
  type: string
  site_id: string
  site_nom: string
  nb_avis: number
  note_moyenne: number | null
  csat: number | null
  nps: number | null
}

export type ReponseClassement = {
  periode: PeriodeApi
  points_contact: LigneClassement[]
}

// ------------------------------------------------------------
// GET /dashboard/questions
// ------------------------------------------------------------

export type RepartitionReponse = {
  valeur: number | string
  nombre: number
}

export type DetailQuestion = {
  questionnaire_id: string
  type: TypeQuestion
  libelle: { fr: string; en: string | null }
  ordre: number
  echelle_min: number | null
  echelle_max: number | null
  nb_reponses: number
  // Question avec moyenne seulement (etoiles, emojis, echelle, NPS).
  moyenne: number | null
  // Question NPS seulement.
  nps: number | null
  // Question oui/non seulement.
  pourcentage_oui: number | null
  repartition: RepartitionReponse[]
}

export type ReponseQuestions = {
  periode: PeriodeApi
  questions: DetailQuestion[]
}

// ------------------------------------------------------------
// GET /dashboard/derniers-avis (meme format que la liste des avis)
// ------------------------------------------------------------

export type AvisRecent = {
  id: string
  // Date ISO complete (UTC).
  soumis_le: string
  langue: string
  appareil: string | null
  note_globale: number | null
  nps: number | null
  // Commentaire coupe pour la liste, ou null s'il n'y en a pas.
  commentaire_extrait: string | null
  statut_traitement: StatutTraitement
  site: { id: string; nom: string }
  point_contact: { id: string; nom: string; type: string }
  en_alerte: boolean
  niveau_alerte: NiveauAlerte | null
}

export type ReponseDerniersAvis = {
  periode: PeriodeApi
  avis: AvisRecent[]
}

// ------------------------------------------------------------
// Listes qui remplissent la barre de filtres
// ------------------------------------------------------------

// GET /sites
export type SiteFiltre = {
  id: string
  nom: string
  adresse: string | null
  ville: string | null
  telephone: string | null
  actif: boolean
  cree_le: string
}

export type ReponseSites = {
  sites: SiteFiltre[]
}

// GET /points-contact?site_id=...
export type PointContactFiltre = {
  id: string
  site_id: string
  nom: string
  type: string
  zone: string | null
  code_public: string
  actif: boolean
  revoque_le: string | null
  cree_le: string
}

export type ReponsePointsContact = {
  points_contact: PointContactFiltre[]
}

// GET /questionnaires : le titre est un texte multilingue.
export type QuestionnaireFiltre = {
  id: string
  titre: { fr: string; en?: string }
  statut: 'BROUILLON' | 'ACTIF' | 'INACTIF'
  langue_defaut: string
  date_debut: string | null
  date_fin: string | null
  cree_le: string
  modifie_le: string
  version: { numero: number; publie_le: string | null } | null
  nombre_points_contact: number
}

export type ReponseQuestionnaires = {
  questionnaires: QuestionnaireFiltre[]
}

// ------------------------------------------------------------
// Ensemble des donnees de l'ecran (rempli par le hook du jour 14)
// ------------------------------------------------------------

export type DonneesTableau = {
  kpis: ReponseKpis
  themes: ReponseThemes
  serie: ReponseSerie
  classement: ReponseClassement
  questions: ReponseQuestions
  derniersAvis: ReponseDerniersAvis
}