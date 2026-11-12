import { prisma } from "../../../configuration/base-de-donnees";
import { calculerClassement, type LigneClassement } from "../../tableaux-de-bord/services/classement";
import { filtreAvis, type PorteeDashboard } from "../../tableaux-de-bord/services/indicateurs";
import { calculerKpis, type ResultatKpis } from "../../tableaux-de-bord/services/kpis";
import { calculerSerieTemporelle, type PointSerie } from "../../tableaux-de-bord/services/serie-temporelle";
import { calculerScoresThemes, type ScoreTheme } from "../../tableaux-de-bord/services/themes";
import type { PeriodeDashboard } from "../../tableaux-de-bord/validations/dashboard";
import type { LangueExport } from "./collecte-avis";
import type { ContenuAnalyse } from "./export-xlsx";

// ------------------------------------------------------------
// Analyse des avis (jour 21)
// ------------------------------------------------------------
// Le "robot" de l'ecran E16, la feuille "Analyse" d'Excel et le rapport PDF utilisent ce fichier.
// Ce n'est PAS une IA externe : ce sont des regles (seuils, comparaisons, classements)
// appliquees aux chiffres du tableau de bord. Rien ne quitte le serveur.
// - Les chiffres viennent des services du tableau de bord (kpis, themes, classement, serie) :
//   l'analyse ne peut donc pas dire autre chose que l'ecran.
// - Elle porte sur la periode, le site, le point de contact et le questionnaire demandes.
//   Les autres filtres de l'export (statut, negatifs, note, recherche) ne s'y appliquent pas.
// - Sans from ni to : les 30 derniers jours (comme le tableau de bord).
// - Seuils de couleur du tableau de bord : vert a partir de 4,2, rouge sous 3,5.
// - Les textes sont ecrits comme un conseiller le dirait au chef d'entreprise : en mots, sans
//   score ni pourcentage (les chiffres sont dans le tableau de bord). Chaque point faible a sa
//   piste d'action, concrete : quoi faire, avec qui, et quand verifier l'effet.

const AVIS_MIN_ANALYSE = 5;
const REPONSES_MIN_THEME = 5;
const AVIS_MIN_POINT = 3;
const NOTE_VERTE = 4.2;
const NOTE_ROUGE = 3.5;
const ECART_NOTE_SIGNIFICATIF = 0.2;
const NPS_TRES_BON = 50;
const NPS_BON = 30;
const CSAT_BON = 80;
const TAUX_REPONSE_BON = 30;
const TAUX_REPONSE_FAIBLE = 10;
const SCANS_MIN_TAUX = 20;
const HEURES_ALERTE_QUI_TRAINE = 48;
const NEGATIFS_MIN_CONCENTRATION = 5;
const NEGATIFS_MIN_JOUR = 3;
const PART_JOUR_CONCENTRE = 0.4;
const NOMBRE_POINTS_RETENUS = 3;

export type CodePoint =
  | "note_elevee"
  | "nps_eleve"
  | "csat_eleve"
  | "progression_note"
  | "meilleur_theme"
  | "meilleur_point"
  | "aucune_alerte"
  | "taux_reponse_eleve"
  | "note_basse"
  | "note_moyenne"
  | "baisse_note"
  | "nps_negatif"
  | "theme_faible"
  | "point_faible"
  | "alertes_qui_trainent"
  | "negatifs_concentres"
  | "taux_reponse_faible"
  | "maintenir";

export type PointAnalyse = {
  code: CodePoint;
  titre: string;
  detail: string;
};

export type NegatifsParJour = {
  total: number;
  // Index 0 = dimanche, 1 = lundi, ..., 6 = samedi (jours UTC, Africa/Lome = UTC+0).
  par_jour_semaine: number[];
  pic: { date: string; nombre: number } | null;
};

// Tout ce que l'analyse a lu : le rapport PDF reutilise ces chiffres pour ses graphiques.
export type DonneesAnalyse = {
  kpis: ResultatKpis;
  themes: ScoreTheme[];
  classement: LigneClassement[];
  serie: PointSerie[];
  negatifs: NegatifsParJour;
};

export type ResultatAnalyse = {
  langue: LangueExport;
  periode: { from: string; to: string; nombre_jours: number };
  nb_avis: number;
  // false : trop peu d'avis pour conclure (points et pistes vides).
  suffisant: boolean;
  resume: string;
  points_forts: PointAnalyse[];
  points_faibles: PointAnalyse[];
  pistes: PointAnalyse[];
  donnees: DonneesAnalyse;
};

type Candidat = { poids: number; point: PointAnalyse };

// ------------------------------------------------------------
// Petits outils de texte
// ------------------------------------------------------------

function choisir(langue: LangueExport, fr: string, en: string): string {
  return langue === "en" ? en : fr;
}

const JOURS_SEMAINE: Record<LangueExport, string[]> = {
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// "AAAA-MM-JJ" -> "JJ/MM/AAAA" en francais, inchange en anglais.
function dateEnTexte(jour: string, langue: LangueExport): string {
  if (langue === "en") {
    return jour;
  }
  const [annee, mois, jourDuMois] = jour.split("-");
  return `${jourDuMois}/${mois}/${annee}`;
}

function libelleTheme(theme: ScoreTheme, langue: LangueExport): string {
  if (langue === "en" && theme.libelle_en.trim() !== "") {
    return theme.libelle_en;
  }
  return theme.libelle_fr;
}

// ------------------------------------------------------------
// Avis negatifs par jour de la semaine
// ------------------------------------------------------------

// Un avis negatif est un avis qui a declenche une alerte (comme dans la liste des avis).
async function lireNegatifs(portee: PorteeDashboard, debut: Date, fin: Date): Promise<NegatifsParJour> {
  const parJourSemaine = [0, 0, 0, 0, 0, 0, 0];
  const where = filtreAvis(portee, debut, fin);
  if (where === null) {
    return { total: 0, par_jour_semaine: parJourSemaine, pic: null };
  }

  const avis = await prisma.avis.findMany({
    where: { ...where, alerte: { isNot: null } },
    select: { soumis_le: true },
  });

  const parDate = new Map<string, number>();
  for (const ligne of avis) {
    const jourSemaine = ligne.soumis_le.getUTCDay();
    parJourSemaine[jourSemaine] = (parJourSemaine[jourSemaine] ?? 0) + 1;
    const date = ligne.soumis_le.toISOString().slice(0, 10);
    parDate.set(date, (parDate.get(date) ?? 0) + 1);
  }

  let pic: NegatifsParJour["pic"] = null;
  for (const [date, nombreDeNegatifs] of parDate) {
    if (pic === null || nombreDeNegatifs > pic.nombre || (nombreDeNegatifs === pic.nombre && date < pic.date)) {
      pic = { date, nombre: nombreDeNegatifs };
    }
  }

  return { total: avis.length, par_jour_semaine: parJourSemaine, pic };
}

// ------------------------------------------------------------
// Points forts
// ------------------------------------------------------------

function candidatsForts(donnees: DonneesAnalyse, langue: LangueExport): Candidat[] {
  const t = (fr: string, en: string): string => choisir(langue, fr, en);
  const { kpis, themes, classement } = donnees;
  const indicateurs = kpis.indicateurs;
  const candidats: Candidat[] = [];

  const note = indicateurs.note_moyenne;
  if (note !== null && note >= NOTE_VERTE) {
    candidats.push({
      poids: 90,
      point: {
        code: "note_elevee",
        titre: t("Vos clients sont très satisfaits", "Your customers are very satisfied"),
        detail: t(
          "Les avis sont très positifs : vous réussissez ce qui compte le plus. Gardez les habitudes qui marchent.",
          "Reviews are very positive: you are getting what matters most right. Keep the habits that work.",
        ),
      },
    });
  }

  const nps = indicateurs.nps;
  if (nps !== null && nps >= NPS_BON) {
    candidats.push({
      poids: nps >= NPS_TRES_BON ? 85 : 70,
      point: {
        code: "nps_eleve",
        titre: t("Vos clients vous recommandent", "Your customers recommend you"),
        detail: t(
          "Beaucoup de clients parleraient de vous autour d’eux : c’est la meilleure publicité possible.",
          "Many customers would speak of you to the people around them: that is the best advertising there is.",
        ),
      },
    });
  }

  const csat = indicateurs.csat;
  if (csat !== null && csat >= CSAT_BON) {
    candidats.push({
      poids: 60,
      point: {
        code: "csat_eleve",
        titre: t("Vos clients repartent contents", "Your customers leave happy"),
        detail: t(
          "La grande majorité des clients qui donnent une note sont satisfaits de leur passage chez vous.",
          "Most customers who leave a rating are happy with their visit.",
        ),
      },
    });
  }

  const evolutionNote = kpis.evolution.note_moyenne.difference;
  if (evolutionNote !== null && evolutionNote >= ECART_NOTE_SIGNIFICATIF) {
    candidats.push({
      poids: 80,
      point: {
        code: "progression_note",
        titre: t("La satisfaction progresse", "Satisfaction is improving"),
        detail: t(
          "Vos clients sont plus contents qu’avant : ce que vous avez changé récemment fonctionne.",
          "Your customers are happier than before: what you changed recently is working.",
        ),
      },
    });
  }

  // Meilleur theme : celui qui a assez de reponses et le meilleur score (themes tries du plus faible au meilleur).
  const themesFiables = themes.filter((theme) => theme.nb_reponses >= REPONSES_MIN_THEME);
  const meilleurTheme = themesFiables.at(-1);
  if (meilleurTheme !== undefined && (themesFiables.length > 1 || meilleurTheme.score >= NOTE_ROUGE)) {
    const solide = meilleurTheme.score >= NOTE_VERTE;
    candidats.push({
      poids: solide ? 75 : 40,
      point: {
        code: "meilleur_theme",
        titre: t(`Votre atout : ${libelleTheme(meilleurTheme, langue)}`, `Your strength: ${libelleTheme(meilleurTheme, langue)}`),
        detail: solide
          ? t(
              "C’est ce que vos clients apprécient le plus chez vous. Mettez-le en avant et félicitez l’équipe.",
              "This is what your customers appreciate most about you. Show it off and congratulate the team.",
            )
          : t(
              "C’est ce qui marche le mieux chez vous, même si cela peut encore progresser.",
              "This is what works best for you, although it can still improve.",
            ),
      },
    });
  }

  // Meilleur point de contact (le classement est trie de la meilleure note a la plus basse).
  const pointsFiables = classement.filter((point) => point.note_moyenne !== null && point.nb_avis >= AVIS_MIN_POINT);
  const meilleurPoint = pointsFiables[0];
  if (
    meilleurPoint !== undefined &&
    meilleurPoint.note_moyenne !== null &&
    (pointsFiables.length > 1 || meilleurPoint.note_moyenne >= NOTE_ROUGE)
  ) {
    const solide = meilleurPoint.note_moyenne >= NOTE_VERTE;
    candidats.push({
      poids: solide ? 70 : 35,
      point: {
        code: "meilleur_point",
        titre: t(
          `Votre meilleur point de contact : ${meilleurPoint.nom}`,
          `Your best contact point: ${meilleurPoint.nom}`,
        ),
        detail: t(
          `${meilleurPoint.site_nom} : c’est là que les clients sont les plus contents. Regardez ce qui s’y fait de bien pour l’appliquer ailleurs.`,
          `${meilleurPoint.site_nom}: this is where customers are happiest. Look at what is done well there and apply it elsewhere.`,
        ),
      },
    });
  }

  if (kpis.alertes_ouvertes.nombre === 0 && indicateurs.nb_avis >= 10) {
    candidats.push({
      poids: 50,
      point: {
        code: "aucune_alerte",
        titre: t("Aucun client mécontent en attente", "No unhappy customer waiting"),
        detail: t(
          "Tous les clients mécontents ont reçu une réponse : continuez à réagir aussi vite.",
          "Every unhappy customer has had an answer: keep reacting this quickly.",
        ),
      },
    });
  }

  const tauxReponse = indicateurs.taux_reponse;
  if (tauxReponse !== null && tauxReponse >= TAUX_REPONSE_BON && indicateurs.nb_scans >= SCANS_MIN_TAUX) {
    candidats.push({
      poids: 45,
      point: {
        code: "taux_reponse_eleve",
        titre: t("Vos clients répondent volontiers", "Your customers gladly answer"),
        detail: t(
          "Beaucoup de clients qui scannent le QR code vont jusqu’au bout et laissent leur avis : votre invitation est bien placée.",
          "Many customers who scan the QR code go all the way and leave a review: your invitation is well placed.",
        ),
      },
    });
  }

  return candidats;
}

// ------------------------------------------------------------
// Points faibles
// ------------------------------------------------------------

function candidatsFaibles(donnees: DonneesAnalyse, langue: LangueExport): Candidat[] {
  const t = (fr: string, en: string): string => choisir(langue, fr, en);
  const { kpis, themes, classement, negatifs } = donnees;
  const indicateurs = kpis.indicateurs;
  const candidats: Candidat[] = [];

  const note = indicateurs.note_moyenne;
  if (note !== null && note < NOTE_ROUGE) {
    candidats.push({
      poids: 95,
      point: {
        code: "note_basse",
        titre: t("Vos clients sont mécontents", "Your customers are unhappy"),
        detail: t(
          "Trop d’avis sont mauvais : c’est le signal le plus urgent à traiter.",
          "Too many reviews are bad: this is the most urgent signal to deal with.",
        ),
      },
    });
  } else if (note !== null && note < NOTE_VERTE) {
    candidats.push({
      poids: 45,
      point: {
        code: "note_moyenne",
        titre: t("La satisfaction peut mieux faire", "Satisfaction could be better"),
        detail: t(
          "Vos clients sont moyennement contents : il manque peu de choses pour qu’ils soient vraiment satisfaits.",
          "Your customers are only fairly happy: it would not take much to make them truly satisfied.",
        ),
      },
    });
  }

  const evolutionNote = kpis.evolution.note_moyenne.difference;
  if (evolutionNote !== null && evolutionNote <= -ECART_NOTE_SIGNIFICATIF) {
    candidats.push({
      poids: 85,
      point: {
        code: "baisse_note",
        titre: t("La satisfaction recule", "Satisfaction is dropping"),
        detail: t(
          "Vos clients sont moins contents qu’avant : quelque chose a changé depuis la période précédente.",
          "Your customers are less happy than before: something has changed since the previous period.",
        ),
      },
    });
  }

  const nps = indicateurs.nps;
  if (nps !== null && nps < 0) {
    candidats.push({
      poids: 80,
      point: {
        code: "nps_negatif",
        titre: t("Plus de clients déçus que de clients fidèles", "More disappointed customers than loyal ones"),
        detail: t(
          "Peu de clients vous recommanderaient aujourd’hui : il faut regagner leur confiance.",
          "Few customers would recommend you today: you need to win back their trust.",
        ),
      },
    });
  }

  // Theme le plus faible : le premier de la liste (triee du plus faible au meilleur) avec assez de reponses.
  const themesFiables = themes.filter((theme) => theme.nb_reponses >= REPONSES_MIN_THEME);
  const pireTheme = themesFiables[0];
  // Un theme n'est un point faible que s'il decoit vraiment (sous le vert) : en mots, un theme tres bien
  // note ne peut pas etre "ce qui decoit le plus".
  if (pireTheme !== undefined && pireTheme.score < NOTE_VERTE && (themesFiables.length > 1 || pireTheme.score < NOTE_ROUGE)) {
    candidats.push({
      poids: pireTheme.score < NOTE_ROUGE ? 90 : 60,
      point: {
        code: "theme_faible",
        titre: t(
          `${libelleTheme(pireTheme, langue)} : ce qui déçoit le plus`,
          `${libelleTheme(pireTheme, langue)}: what disappoints the most`,
        ),
        detail: t(
          "C’est le point sur lequel vos clients sont le moins satisfaits en ce moment.",
          "This is where your customers are the least satisfied right now.",
        ),
      },
    });
  }

  // Point de contact le plus faible : le dernier du classement avec assez d'avis.
  const pointsFiables = classement.filter((point) => point.note_moyenne !== null && point.nb_avis >= AVIS_MIN_POINT);
  const pirePoint = pointsFiables.at(-1);
  // Meme regle : un point de contact bien note (vert) n'est pas un point faible.
  if (
    pirePoint !== undefined &&
    pirePoint.note_moyenne !== null &&
    pirePoint.note_moyenne < NOTE_VERTE &&
    (pointsFiables.length > 1 || pirePoint.note_moyenne < NOTE_ROUGE)
  ) {
    candidats.push({
      poids: pirePoint.note_moyenne < NOTE_ROUGE ? 85 : 55,
      point: {
        code: "point_faible",
        titre: t(
          `Un point de contact à surveiller : ${pirePoint.nom}`,
          `A contact point to watch: ${pirePoint.nom}`,
        ),
        detail: t(
          `${pirePoint.site_nom} : c’est là que les clients sont le moins satisfaits.`,
          `${pirePoint.site_nom}: this is where customers are the least satisfied.`,
        ),
      },
    });
  }

  const alertes = kpis.alertes_ouvertes;
  if (alertes.nombre > 0) {
    const heures = alertes.anciennete_max_heures;
    const traine = heures !== null && heures >= HEURES_ALERTE_QUI_TRAINE;
    candidats.push({
      poids: traine ? 88 : 50,
      point: {
        code: "alertes_qui_trainent",
        titre: traine
          ? t("Des clients mécontents attendent", "Unhappy customers are waiting")
          : t("Des clients mécontents à rappeler", "Unhappy customers to call back"),
        detail: traine
          ? t(
              "Certains attendent une réponse depuis plusieurs jours : plus vous tardez, plus ils risquent de partir.",
              "Some have been waiting for an answer for several days: the longer you wait, the more likely they are to leave.",
            )
          : t(
              "Des clients mécontents n’ont pas encore reçu de réponse : répondre vite change tout.",
              "Some unhappy customers have not had an answer yet: answering quickly makes all the difference.",
            ),
      },
    });
  }

  // Jour de la semaine qui concentre les avis negatifs.
  if (negatifs.total >= NEGATIFS_MIN_CONCENTRATION) {
    let jourMax = 0;
    for (let jour = 1; jour < negatifs.par_jour_semaine.length; jour += 1) {
      if ((negatifs.par_jour_semaine[jour] ?? 0) > (negatifs.par_jour_semaine[jourMax] ?? 0)) {
        jourMax = jour;
      }
    }
    const nombreJour = negatifs.par_jour_semaine[jourMax] ?? 0;
    const part = nombreJour / negatifs.total;
    if (nombreJour >= NEGATIFS_MIN_JOUR && part >= PART_JOUR_CONCENTRE) {
      const nomJour = JOURS_SEMAINE[langue][jourMax] ?? "";
      candidats.push({
        poids: 65,
        point: {
          code: "negatifs_concentres",
          titre: t(`Les clients se plaignent surtout le ${nomJour}`, `Customers complain mostly on ${nomJour}s`),
          detail: t(
            "Une grande partie des avis négatifs arrive ce jour-là : quelque chose ne va pas particulièrement ce jour-là.",
            "A large share of the negative reviews comes on that day: something goes wrong on that day in particular.",
          ),
        },
      });
    }
  }

  const tauxReponse = indicateurs.taux_reponse;
  if (tauxReponse !== null && tauxReponse < TAUX_REPONSE_FAIBLE && indicateurs.nb_scans >= SCANS_MIN_TAUX) {
    candidats.push({
      poids: 45,
      point: {
        code: "taux_reponse_faible",
        titre: t("Peu de clients laissent un avis", "Few customers leave a review"),
        detail: t(
          "Beaucoup de clients scannent le QR code sans aller jusqu’au bout : vous perdez des avis utiles.",
          "Many customers scan the QR code without going all the way: you are losing useful reviews.",
        ),
      },
    });
  }

  return candidats;
}

// Les plus importants d'abord ; a poids egal, l'ordre alphabetique du code (resultat stable).
function retenir(candidats: Candidat[]): PointAnalyse[] {
  return [...candidats]
    .sort((a, b) => b.poids - a.poids || a.point.code.localeCompare(b.point.code))
    .slice(0, NOMBRE_POINTS_RETENUS)
    .map((candidat) => candidat.point);
}

// ------------------------------------------------------------
// Pistes d'action : une par point faible retenu
// ------------------------------------------------------------

function pisteDuPoint(point: PointAnalyse, donnees: DonneesAnalyse, langue: LangueExport): PointAnalyse {
  const t = (fr: string, en: string): string => choisir(langue, fr, en);
  const { themes, classement, negatifs } = donnees;

  let titre: string;
  let detail: string;

  switch (point.code) {
    case "note_basse":
    case "note_moyenne":
      titre = t("Comprendre ce qui déçoit", "Understand what disappoints");
      detail = t(
        "Cette semaine, lisez les commentaires des clients mécontents et repérez le problème qui revient le plus souvent. Corrigez-le en premier, puis regardez dans 15 jours si les avis s’améliorent.",
        "This week, read the comments from unhappy customers and spot the problem that comes up most often. Fix it first, then check in 15 days whether the reviews improve.",
      );
      break;
    case "baisse_note":
      titre = t("Trouver ce qui a changé", "Find out what changed");
      detail = t(
        "Demandez à l’équipe ce qui a changé depuis la période précédente (personnel, offre, affluence, travaux). Remettez en place sans attendre ce qui marchait avant.",
        "Ask the team what has changed since the previous period (staff, offer, crowds, works). Put back in place, without waiting, what worked before.",
      );
      break;
    case "nps_negatif":
      titre = t("Reconquérir les clients déçus", "Win back disappointed customers");
      detail = t(
        "Contactez les clients mécontents qui ont laissé leurs coordonnées : écoutez-les, excusez-vous et proposez un geste (remise, remplacement). Un client rattrapé revient souvent.",
        "Contact the unhappy customers who left their contact details: listen to them, apologise and offer a gesture (discount, replacement). A customer you win back often returns.",
      );
      break;
    case "theme_faible": {
      const pire = themes.filter((theme) => theme.nb_reponses >= REPONSES_MIN_THEME)[0];
      const nom = pire !== undefined ? libelleTheme(pire, langue) : "";
      titre = t(`Améliorer : ${nom}`, `Improve: ${nom}`);
      detail = t(
        "Réunissez cette semaine l’équipe concernée, demandez-lui ce qui bloque et choisissez une seule amélioration simple. Regardez dans 15 jours si les clients le ressentent.",
        "This week, bring together the team concerned, ask them what is getting in the way and pick a single simple improvement. Check in 15 days whether customers notice it.",
      );
      break;
    }
    case "point_faible": {
      const pire = classement.filter((ligne) => ligne.note_moyenne !== null && ligne.nb_avis >= AVIS_MIN_POINT).at(-1);
      const nom = pire !== undefined ? pire.nom : "";
      titre = t(`Aller voir sur place : ${nom}`, `Go and see on site: ${nom}`);
      detail = t(
        "Passez-y cette semaine, observez ce qui se passe et lisez les derniers commentaires. Parlez avec l’équipe sur place pour corriger ce qui déçoit les clients.",
        "Go there this week, watch what happens and read the latest comments. Talk with the team on site to fix what disappoints customers.",
      );
      break;
    }
    case "alertes_qui_trainent":
      titre = t("Répondre aux clients mécontents", "Answer unhappy customers");
      detail = t(
        "Aujourd’hui, contactez les clients mécontents, en commençant par celui qui attend depuis le plus longtemps. Passez ensuite chaque avis en « Traité ».",
        "Today, contact the unhappy customers, starting with the one who has been waiting the longest. Then set each review to “Resolved”.",
      );
      break;
    case "negatifs_concentres": {
      let jourMax = 0;
      for (let jour = 1; jour < negatifs.par_jour_semaine.length; jour += 1) {
        if ((negatifs.par_jour_semaine[jour] ?? 0) > (negatifs.par_jour_semaine[jourMax] ?? 0)) {
          jourMax = jour;
        }
      }
      const nomJour = JOURS_SEMAINE[langue][jourMax] ?? "";
      titre = t(`Renforcer l’équipe le ${nomJour}`, `Strengthen the team on ${nomJour}s`);
      detail = t(
        "Prévoyez plus de personnel ou un responsable présent ce jour-là, et demandez à l’équipe ce qui se passe de différent ce jour-là.",
        "Plan more staff or a manager on duty that day, and ask the team what is different about that day.",
      );
      break;
    }
    case "taux_reponse_faible":
      titre = t("Encourager les clients à répondre", "Encourage customers to answer");
      detail = t(
        "Placez le QR code bien en vue, à hauteur des yeux, et invitez les clients à scanner : « Une minute pour nous aider à progresser ? ». Raccourcissez le questionnaire s’il est long.",
        "Place the QR code in plain sight, at eye level, and invite customers to scan it: “One minute to help us improve?”. Shorten the questionnaire if it is long.",
      );
      break;
    default:
      titre = t("Suivre ce point", "Keep an eye on this");
      detail = t(
        "Surveillez ce point à la prochaine période.",
        "Watch this point over the next period.",
      );
  }

  return { code: point.code, titre, detail };
}

// ------------------------------------------------------------
// Construction de l'analyse (sans acces a la base : testable avec des chiffres fabriques)
// ------------------------------------------------------------

export function construireAnalyse(donnees: DonneesAnalyse, langue: LangueExport): ResultatAnalyse {
  const t = (fr: string, en: string): string => choisir(langue, fr, en);
  const { kpis } = donnees;
  const indicateurs = kpis.indicateurs;
  const periode = {
    from: kpis.periode.from,
    to: kpis.periode.to,
    nombre_jours: kpis.periode.nombre_jours,
  };
  const intervalle = t(
    `Du ${dateEnTexte(periode.from, langue)} au ${dateEnTexte(periode.to, langue)}`,
    `From ${dateEnTexte(periode.from, langue)} to ${dateEnTexte(periode.to, langue)}`,
  );

  if (indicateurs.nb_avis < AVIS_MIN_ANALYSE) {
    return {
      langue,
      periode,
      nb_avis: indicateurs.nb_avis,
      suffisant: false,
      resume: t(
        `${intervalle} : ${indicateurs.nb_avis} avis seulement. C’est trop peu pour une analyse fiable (minimum ${AVIS_MIN_ANALYSE}). Élargissez la période ou les filtres.`,
        `${intervalle}: only ${indicateurs.nb_avis} reviews. That is too few for a reliable analysis (minimum ${AVIS_MIN_ANALYSE}). Widen the period or the filters.`,
      ),
      points_forts: [],
      points_faibles: [],
      pistes: [],
      donnees,
    };
  }

  const pointsFaibles = retenir(candidatsFaibles(donnees, langue));
  const pistes = pointsFaibles.map((point) => pisteDuPoint(point, donnees, langue));
  if (pistes.length === 0) {
    pistes.push({
      code: "maintenir",
      titre: t("Continuer sur cette lancée", "Keep going"),
      detail: t(
        "Rien d’inquiétant : continuez ainsi, félicitez l’équipe et partagez ce qui marche avec tout le monde.",
        "Nothing worrying: keep going, congratulate the team and share what works with everyone.",
      ),
    });
  }

  // Resume : un avis d'ensemble en mots (satisfaction, tendance), sans chiffre. Seule la periode reste.
  const note = indicateurs.note_moyenne;
  const evolution = kpis.evolution.note_moyenne.difference;
  const niveauVert = note !== null && note >= NOTE_VERTE;
  let satisfaction: string;
  if (note === null) {
    satisfaction = t(
      "il n’y a pas encore assez de notes pour juger la satisfaction",
      "there are not enough ratings yet to judge satisfaction",
    );
  } else if (note >= NOTE_VERTE) {
    satisfaction = t("vos clients sont très satisfaits", "your customers are very satisfied");
  } else if (note >= NOTE_ROUGE) {
    satisfaction = t("vos clients sont moyennement satisfaits", "your customers are only fairly satisfied");
  } else {
    satisfaction = t("vos clients sont mécontents", "your customers are unhappy");
  }

  let tendance = "";
  if (note !== null && evolution !== null && evolution >= ECART_NOTE_SIGNIFICATIF) {
    tendance = niveauVert
      ? t(", et la satisfaction progresse", ", and satisfaction is improving")
      : t(", mais la satisfaction progresse", ", but satisfaction is improving");
  } else if (note !== null && evolution !== null && evolution <= -ECART_NOTE_SIGNIFICATIF) {
    tendance = niveauVert
      ? t(", mais la satisfaction recule", ", but satisfaction is dropping")
      : t(", et la satisfaction recule", ", and satisfaction is dropping");
  }

  let suite: string;
  if (pointsFaibles.length === 0) {
    suite = t("Rien d’inquiétant : continuez ainsi.", "Nothing worrying: keep it up.");
  } else if (niveauVert) {
    suite = t("Quelques points restent à surveiller.", "A few points remain to keep an eye on.");
  } else {
    suite = t("Voici ce qu’il faut améliorer en premier.", "Here is what to improve first.");
  }

  return {
    langue,
    periode,
    nb_avis: indicateurs.nb_avis,
    suffisant: true,
    resume: `${intervalle}${langue === "fr" ? " : " : ": "}${satisfaction}${tendance}. ${suite}`,
    points_forts: retenir(candidatsForts(donnees, langue)),
    points_faibles: pointsFaibles,
    pistes,
    donnees,
  };
}

// ------------------------------------------------------------
// Lecture des chiffres puis analyse
// ------------------------------------------------------------

export async function analyserAvis(
  portee: PorteeDashboard,
  periode: PeriodeDashboard,
  langue: LangueExport,
  maintenant: Date = new Date(),
): Promise<ResultatAnalyse> {
  // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
  const kpis = await calculerKpis(portee, periode, maintenant);
  const themes = await calculerScoresThemes(portee, periode.debut, periode.fin);
  const classement = await calculerClassement(portee, periode.debut, periode.fin);
  const serie = await calculerSerieTemporelle(portee, periode.debut, periode.fin);
  const negatifs = await lireNegatifs(portee, periode.debut, periode.fin);

  return construireAnalyse({ kpis, themes, classement, serie, negatifs }, langue);
}

// ------------------------------------------------------------
// Mise en forme pour la feuille "Analyse" d'Excel
// ------------------------------------------------------------

export function versContenuAnalyse(resultat: ResultatAnalyse): ContenuAnalyse {
  const t = (fr: string, en: string): string => choisir(resultat.langue, fr, en);
  const separateur = resultat.langue === "fr" ? " : " : ": ";
  const enLignes = (points: PointAnalyse[]): string[] =>
    points.map((point) => `• ${point.titre}${separateur}${point.detail}`);

  const sections: ContenuAnalyse["sections"] = [{ titre: t("Résumé", "Summary"), lignes: [resultat.resume] }];

  if (resultat.suffisant) {
    sections.push(
      { titre: t("Points forts", "Strengths"), lignes: enLignes(resultat.points_forts) },
      { titre: t("Points faibles", "Weaknesses"), lignes: enLignes(resultat.points_faibles) },
      { titre: t("Pistes d’action", "Suggested actions"), lignes: enLignes(resultat.pistes) },
    );
  }

  sections.push({
    titre: t("À savoir", "Good to know"),
    lignes: [
      t(
        "Cette analyse est calculée par des règles sur vos données (comparaisons, seuils, classements). Ce n’est pas un modèle d’IA externe : rien ne quitte le serveur.",
        "This analysis is computed by rules applied to your data (comparisons, thresholds, rankings). It is not an external AI model: nothing leaves the server.",
      ),
      t(
        "Elle porte sur la période, le site, le point de contact et le questionnaire choisis. Les autres filtres de l’export ne s’y appliquent pas.",
        "It covers the chosen period, site, contact point and questionnaire. The other export filters do not apply to it.",
      ),
    ],
  });

  return {
    titre: t("Analyse des avis", "Review analysis"),
    sections,
  };
}
