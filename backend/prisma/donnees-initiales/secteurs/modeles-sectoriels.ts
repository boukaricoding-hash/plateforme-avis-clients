// Themes et questionnaires types (modeles) des 6 secteurs.
// Source : annexe A du cahier des charges (A1 a A5) et modele general.
// Ce fichier ne contient que des donnees : il est lu par prisma/seed.ts.

export type TexteBilingue = { fr: string; en: string };

export type ThemeModele = { code: string; libelle_fr: string; libelle_en: string };

export type QuestionModele = {
  type: "ETOILES" | "NPS" | "CHOIX_UNIQUE" | "OUI_NON" | "TEXTE_LIBRE";
  // Code du theme (doit exister dans les themes du secteur), ou absent.
  theme?: string;
  libelle: TexteBilingue;
  obligatoire: boolean;
  aide?: TexteBilingue;
  options?: TexteBilingue[];
};

export type ModeleSectoriel = {
  secteur: string;
  titre: TexteBilingue;
  message_accueil: TexteBilingue;
  message_remerciement: TexteBilingue;
  questions: QuestionModele[];
};

const ACCUEIL_STANDARD: TexteBilingue = {
  fr: "Votre avis nous aide à nous améliorer. Cela prend moins d'une minute.",
  en: "Your feedback helps us improve. It takes less than a minute.",
};

const REMERCIEMENT_STANDARD: TexteBilingue = {
  fr: "Merci pour votre avis !",
  en: "Thank you for your feedback!",
};

// Question en etoiles (1 a 5), obligatoire, rattachee a un theme.
function etoiles(theme: string, fr: string, en: string): QuestionModele {
  return { type: "ETOILES", theme, libelle: { fr, en }, obligatoire: true };
}

// Question NPS (0 a 10), obligatoire, sans theme.
function nps(fr: string, en: string): QuestionModele {
  return { type: "NPS", libelle: { fr, en }, obligatoire: true };
}

// ------------------------------------------------------------
// Themes par secteur (code technique, libelles FR et EN)
// ------------------------------------------------------------

export const THEMES_PAR_SECTEUR: Record<string, ThemeModele[]> = {
  restauration: [
    { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
    { code: "qualite_plats", libelle_fr: "Qualité des plats", libelle_en: "Food quality" },
    { code: "rapidite", libelle_fr: "Rapidité", libelle_en: "Speed" },
    { code: "proprete", libelle_fr: "Propreté", libelle_en: "Cleanliness" },
    { code: "prix", libelle_fr: "Prix", libelle_en: "Price" },
    { code: "ambiance", libelle_fr: "Ambiance", libelle_en: "Atmosphere" },
  ],
  sante: [
    { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
    { code: "temps_attente", libelle_fr: "Temps d'attente", libelle_en: "Waiting time" },
    { code: "ecoute", libelle_fr: "Écoute du personnel", libelle_en: "Staff attentiveness" },
    { code: "information", libelle_fr: "Clarté de l'information", libelle_en: "Clarity of information" },
    { code: "hygiene", libelle_fr: "Hygiène", libelle_en: "Hygiene" },
    { code: "couts", libelle_fr: "Coûts", libelle_en: "Costs" },
  ],
  education: [
    { code: "enseignements", libelle_fr: "Qualité des enseignements", libelle_en: "Quality of teaching" },
    { code: "enseignants", libelle_fr: "Écoute des enseignants", libelle_en: "Teacher availability" },
    { code: "supports", libelle_fr: "Supports et ressources", libelle_en: "Materials and resources" },
    { code: "administration", libelle_fr: "Administration", libelle_en: "Administration" },
    { code: "infrastructures", libelle_fr: "Infrastructures", libelle_en: "Facilities" },
    { code: "securite", libelle_fr: "Sécurité et ambiance", libelle_en: "Safety and atmosphere" },
  ],
  agroalimentaire: [
    { code: "gout", libelle_fr: "Goût", libelle_en: "Taste" },
    { code: "fraicheur", libelle_fr: "Fraîcheur et qualité", libelle_en: "Freshness and quality" },
    { code: "emballage", libelle_fr: "Emballage", libelle_en: "Packaging" },
    { code: "prix", libelle_fr: "Prix", libelle_en: "Price" },
    { code: "disponibilite", libelle_fr: "Disponibilité", libelle_en: "Availability" },
    { code: "confiance", libelle_fr: "Confiance", libelle_en: "Trust" },
  ],
  evenement: [
    { code: "organisation", libelle_fr: "Organisation", libelle_en: "Organisation" },
    { code: "contenu", libelle_fr: "Contenu et stands", libelle_en: "Content and stands" },
    { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
    { code: "signaletique", libelle_fr: "Signalétique", libelle_en: "Signage" },
    { code: "restauration", libelle_fr: "Restauration et services", libelle_en: "Food and services" },
    { code: "securite", libelle_fr: "Sécurité", libelle_en: "Safety" },
  ],
  general: [
    { code: "accueil", libelle_fr: "Accueil", libelle_en: "Welcome" },
    { code: "service", libelle_fr: "Service", libelle_en: "Service" },
    { code: "proprete", libelle_fr: "Propreté", libelle_en: "Cleanliness" },
    { code: "prix", libelle_fr: "Prix", libelle_en: "Price" },
  ],
};

// ------------------------------------------------------------
// Questionnaires types (un par secteur)
// ------------------------------------------------------------

export const MODELES_SECTORIELS: ModeleSectoriel[] = [
  // A1. Restauration : 6 questions en etoiles et le NPS.
  {
    secteur: "restauration",
    titre: { fr: "Avis restaurant", en: "Restaurant review" },
    message_accueil: ACCUEIL_STANDARD,
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      etoiles("accueil", "Comment avez-vous trouvé notre accueil ?", "How was our welcome?"),
      etoiles("qualite_plats", "Comment avez-vous trouvé la qualité des plats ?", "How was the food quality?"),
      etoiles("rapidite", "Comment avez-vous trouvé la rapidité du service ?", "How was the speed of service?"),
      etoiles("proprete", "Comment avez-vous trouvé la propreté du lieu ?", "How clean was the place?"),
      etoiles("prix", "Comment jugez-vous le rapport qualité-prix ?", "How would you rate the value for money?"),
      etoiles("ambiance", "Comment avez-vous trouvé l'ambiance ?", "How was the atmosphere?"),
      nps(
        "De 0 à 10, recommanderiez-vous notre restaurant à un proche ?",
        "From 0 to 10, how likely are you to recommend our restaurant to a friend?",
      ),
    ],
  },

  // A2. Sante : avertissement dans le message d'accueil, aucune question medicale.
  {
    secteur: "sante",
    titre: { fr: "Avis établissement de santé", en: "Healthcare facility review" },
    message_accueil: {
      fr: "Votre avis nous aide à nous améliorer. Cela prend moins d'une minute. Ne mentionnez aucune information médicale personnelle.",
      en: "Your feedback helps us improve. It takes less than a minute. Please do not mention any personal medical information.",
    },
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      etoiles("accueil", "Comment avez-vous été accueilli(e) à votre arrivée ?", "How were you welcomed on arrival?"),
      {
        type: "CHOIX_UNIQUE",
        theme: "temps_attente",
        libelle: { fr: "Quel a été votre temps d'attente ?", en: "How long did you wait?" },
        obligatoire: true,
        options: [
          { fr: "Moins de 15 min", en: "Less than 15 min" },
          { fr: "15 à 30 min", en: "15 to 30 min" },
          { fr: "30 à 60 min", en: "30 to 60 min" },
          { fr: "Plus d'une heure", en: "More than one hour" },
        ],
      },
      etoiles("ecoute", "Le personnel vous a-t-il écouté(e) avec respect ?", "Did the staff listen to you with respect?"),
      etoiles("information", "Les explications reçues étaient-elles claires ?", "Were the explanations you received clear?"),
      etoiles("hygiene", "Comment jugez-vous la propreté et l'hygiène des lieux ?", "How would you rate the cleanliness and hygiene of the premises?"),
      {
        type: "CHOIX_UNIQUE",
        theme: "couts",
        libelle: {
          fr: "Les tarifs et les frais vous ont-ils été expliqués clairement ?",
          en: "Were the prices and fees explained to you clearly?",
        },
        obligatoire: true,
        options: [
          { fr: "Oui", en: "Yes" },
          { fr: "En partie", en: "Partly" },
          { fr: "Non", en: "No" },
        ],
      },
      nps(
        "De 0 à 10, recommanderiez-vous cet établissement ?",
        "From 0 to 10, how likely are you to recommend this facility?",
      ),
    ],
  },

  // A3. Education : question de segmentation (etudiant, eleve ou parent) et filiere.
  {
    secteur: "education",
    titre: { fr: "Avis établissement d'enseignement", en: "School or university review" },
    message_accueil: ACCUEIL_STANDARD,
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      {
        type: "CHOIX_UNIQUE",
        libelle: { fr: "Vous êtes :", en: "You are:" },
        obligatoire: true,
        options: [
          { fr: "Étudiant(e)", en: "Student (university)" },
          { fr: "Élève", en: "Pupil" },
          { fr: "Parent", en: "Parent" },
        ],
      },
      {
        type: "TEXTE_LIBRE",
        libelle: { fr: "Quelle est votre filière ?", en: "What is your field of study?" },
        obligatoire: false,
      },
      etoiles("enseignements", "Comment jugez-vous la qualité des enseignements ?", "How would you rate the quality of teaching?"),
      etoiles("enseignants", "Comment jugez-vous la disponibilité et l'écoute des enseignants ?", "How would you rate teacher availability and attentiveness?"),
      etoiles("supports", "Comment jugez-vous la qualité des supports et des ressources ?", "How would you rate the quality of materials and resources?"),
      etoiles("administration", "Comment jugez-vous l'organisation et l'administration (scolarité, emplois du temps) ?", "How would you rate the organisation and administration (registration, timetables)?"),
      etoiles("infrastructures", "Comment jugez-vous les infrastructures (salles, Wi-Fi, bibliothèque) ?", "How would you rate the facilities (rooms, Wi-Fi, library)?"),
      etoiles("securite", "Comment jugez-vous la sécurité et l'ambiance générale ?", "How would you rate safety and the general atmosphere?"),
      nps(
        "De 0 à 10, recommanderiez-vous cet établissement ?",
        "From 0 to 10, how likely are you to recommend this institution?",
      ),
    ],
  },

  // A4. Agroalimentaire : le QR code peut contenir le produit ou le lot.
  {
    secteur: "agroalimentaire",
    titre: { fr: "Avis produit", en: "Product review" },
    message_accueil: ACCUEIL_STANDARD,
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      etoiles("gout", "Comment jugez-vous le goût du produit ?", "How would you rate the taste of the product?"),
      etoiles("fraicheur", "Comment jugez-vous sa fraîcheur et sa qualité ?", "How would you rate its freshness and quality?"),
      etoiles("emballage", "Comment jugez-vous l'emballage ?", "How would you rate the packaging?"),
      etoiles("prix", "Comment jugez-vous le prix ?", "How would you rate the price?"),
      {
        type: "CHOIX_UNIQUE",
        theme: "disponibilite",
        libelle: { fr: "Le produit est-il facile à trouver ?", en: "Is the product easy to find?" },
        obligatoire: true,
        options: [
          { fr: "Oui", en: "Yes" },
          { fr: "Parfois", en: "Sometimes" },
          { fr: "Non", en: "No" },
        ],
      },
      {
        type: "OUI_NON",
        theme: "confiance",
        libelle: {
          fr: "Avez-vous rencontré un problème avec ce produit ?",
          en: "Did you have a problem with this product?",
        },
        obligatoire: true,
        aide: {
          fr: "Si oui, décrivez-le dans le commentaire à la fin.",
          en: "If yes, please describe it in the comment at the end.",
        },
      },
      nps(
        "De 0 à 10, recommanderiez-vous ce produit ?",
        "From 0 to 10, how likely are you to recommend this product?",
      ),
    ],
  },

  // A5. Evenement : la liste des stands est a adapter par l'organisateur.
  {
    secteur: "evenement",
    titre: { fr: "Avis événement", en: "Event review" },
    message_accueil: ACCUEIL_STANDARD,
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      etoiles("organisation", "Comment jugez-vous l'organisation générale ?", "How would you rate the overall organisation?"),
      etoiles("contenu", "Comment jugez-vous l'intérêt du contenu ou des stands ?", "How would you rate the interest of the content or stands?"),
      etoiles("accueil", "Comment jugez-vous la qualité de l'accueil ?", "How would you rate the quality of the welcome?"),
      etoiles("signaletique", "Comment jugez-vous la signalétique et la facilité à s'orienter ?", "How would you rate the signage and ease of finding your way?"),
      etoiles("restauration", "Comment jugez-vous la restauration et les services ?", "How would you rate the food and services?"),
      etoiles("securite", "Comment jugez-vous la sécurité ?", "How would you rate safety?"),
      nps(
        "De 0 à 10, recommanderiez-vous cet événement ?",
        "From 0 to 10, how likely are you to recommend this event?",
      ),
      {
        type: "CHOIX_UNIQUE",
        libelle: {
          fr: "Quel stand ou quelle session vous a le plus marqué ?",
          en: "Which stand or session impressed you the most?",
        },
        obligatoire: false,
        options: [
          { fr: "Stand 1", en: "Stand 1" },
          { fr: "Stand 2", en: "Stand 2" },
          { fr: "Stand 3", en: "Stand 3" },
          { fr: "Autre", en: "Other" },
        ],
      },
    ],
  },

  // Modele general : 4 themes en etoiles et le NPS (hors annexe A).
  {
    secteur: "general",
    titre: { fr: "Avis client", en: "Customer review" },
    message_accueil: ACCUEIL_STANDARD,
    message_remerciement: REMERCIEMENT_STANDARD,
    questions: [
      etoiles("accueil", "Comment avez-vous trouvé notre accueil ?", "How was our welcome?"),
      etoiles("service", "Comment jugez-vous la qualité de notre service ?", "How would you rate the quality of our service?"),
      etoiles("proprete", "Comment avez-vous trouvé la propreté du lieu ?", "How clean was the place?"),
      etoiles("prix", "Comment jugez-vous le rapport qualité-prix ?", "How would you rate the value for money?"),
      nps(
        "De 0 à 10, recommanderiez-vous notre établissement à un proche ?",
        "From 0 to 10, how likely are you to recommend us to a friend?",
      ),
    ],
  },
];