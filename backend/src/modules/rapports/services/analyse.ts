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

function nombre(valeur: number, decimales: number, langue: LangueExport): string {
  const texte = String(Number(valeur.toFixed(decimales)));
  return langue === "fr" ? texte.replace(".", ",") : texte;
}

function avecSigne(valeur: number, decimales: number, langue: LangueExport): string {
  const texte = nombre(Math.abs(valeur), decimales, langue);
  if (valeur > 0) {
    return `+${texte}`;
  }
  return valeur < 0 ? `-${texte}` : texte;
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

function dureeEnTexte(heures: number, langue: LangueExport): string {
  if (heures >= 48) {
    const jours = Math.floor(heures / 24);
    return choisir(langue, `${jours} jours`, `${jours} days`);
  }
  return `${Math.max(1, Math.round(heures))} h`;
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
        titre: t("Note moyenne élevée", "High average rating"),
        detail: t(
          `${nombre(note, 2, langue)}/5 sur ${indicateurs.nb_avis} avis, au niveau « vert » (4,2 et plus).`,
          `${nombre(note, 2, langue)}/5 over ${indicateurs.nb_avis} reviews, in the green zone (4.2 and above).`,
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
        titre: t("Clients très recommandeurs", "Customers who recommend you"),
        detail: t(
          `NPS de ${nombre(nps, 1, langue)} : les promoteurs sont bien plus nombreux que les détracteurs.`,
          `NPS of ${nombre(nps, 1, langue)}: promoters clearly outnumber detractors.`,
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
        titre: t("Clients satisfaits", "Satisfied customers"),
        detail: t(
          `${nombre(csat, 1, langue)} % des avis notés sont à 4 ou 5 sur 5.`,
          `${nombre(csat, 1, langue)}% of rated reviews are 4 or 5 out of 5.`,
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
        titre: t("Note en progression", "Rating going up"),
        detail: t(
          `${avecSigne(evolutionNote, 2, langue)} point par rapport à la période précédente.`,
          `${avecSigne(evolutionNote, 2, langue)} points compared with the previous period.`,
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
        titre: t(`Thème le mieux noté : ${libelleTheme(meilleurTheme, langue)}`, `Best rated theme: ${libelleTheme(meilleurTheme, langue)}`),
        detail: t(
          `Score de ${nombre(meilleurTheme.score, 2, langue)}/5 sur ${meilleurTheme.nb_reponses} réponses${solide ? "." : " : c’est votre point le plus solide, même s’il peut encore progresser."}`,
          `Score of ${nombre(meilleurTheme.score, 2, langue)}/5 over ${meilleurTheme.nb_reponses} answers${solide ? "." : ": your strongest area, although it can still improve."}`,
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
          `Point de contact le mieux noté : ${meilleurPoint.nom}`,
          `Best rated contact point: ${meilleurPoint.nom}`,
        ),
        detail: t(
          `${meilleurPoint.site_nom} : ${nombre(meilleurPoint.note_moyenne, 2, langue)}/5 sur ${meilleurPoint.nb_avis} avis.`,
          `${meilleurPoint.site_nom}: ${nombre(meilleurPoint.note_moyenne, 2, langue)}/5 over ${meilleurPoint.nb_avis} reviews.`,
        ),
      },
    });
  }

  if (kpis.alertes_ouvertes.nombre === 0 && indicateurs.nb_avis >= 10) {
    candidats.push({
      poids: 50,
      point: {
        code: "aucune_alerte",
        titre: t("Aucune alerte en attente", "No pending alert"),
        detail: t(
          "Toutes les alertes ont été prises en charge : aucun avis négatif ne reste sans réponse.",
          "All alerts have been handled: no negative review is left unanswered.",
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
        titre: t("Bon taux de réponse", "Good response rate"),
        detail: t(
          `${nombre(tauxReponse, 1, langue)} % des clients qui scannent le QR code envoient leur avis.`,
          `${nombre(tauxReponse, 1, langue)}% of customers who scan the QR code send their review.`,
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
        titre: t("Note moyenne basse", "Low average rating"),
        detail: t(
          `${nombre(note, 2, langue)}/5 sur ${indicateurs.nb_avis} avis, au niveau « rouge » (sous 3,5).`,
          `${nombre(note, 2, langue)}/5 over ${indicateurs.nb_avis} reviews, in the red zone (below 3.5).`,
        ),
      },
    });
  } else if (note !== null && note < NOTE_VERTE) {
    candidats.push({
      poids: 45,
      point: {
        code: "note_moyenne",
        titre: t("Note moyenne à améliorer", "Average rating to improve"),
        detail: t(
          `${nombre(note, 2, langue)}/5 sur ${indicateurs.nb_avis} avis, au niveau « orange » (entre 3,5 et 4,2).`,
          `${nombre(note, 2, langue)}/5 over ${indicateurs.nb_avis} reviews, in the orange zone (between 3.5 and 4.2).`,
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
        titre: t("Note en baisse", "Rating going down"),
        detail: t(
          `${avecSigne(evolutionNote, 2, langue)} point par rapport à la période précédente.`,
          `${avecSigne(evolutionNote, 2, langue)} points compared with the previous period.`,
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
        titre: t("Plus de détracteurs que de promoteurs", "More detractors than promoters"),
        detail: t(
          `NPS de ${nombre(nps, 1, langue)} : ${indicateurs.nb_detracteurs} détracteurs contre ${indicateurs.nb_promoteurs} promoteurs.`,
          `NPS of ${nombre(nps, 1, langue)}: ${indicateurs.nb_detracteurs} detractors against ${indicateurs.nb_promoteurs} promoters.`,
        ),
      },
    });
  }

  // Theme le plus faible : le premier de la liste (triee du plus faible au meilleur) avec assez de reponses.
  const themesFiables = themes.filter((theme) => theme.nb_reponses >= REPONSES_MIN_THEME);
  const pireTheme = themesFiables[0];
  if (pireTheme !== undefined && (themesFiables.length > 1 || pireTheme.score < NOTE_ROUGE)) {
    const poids = pireTheme.score < NOTE_ROUGE ? 90 : pireTheme.score < NOTE_VERTE ? 60 : 25;
    candidats.push({
      poids,
      point: {
        code: "theme_faible",
        titre: t(`Thème le moins bien noté : ${libelleTheme(pireTheme, langue)}`, `Lowest rated theme: ${libelleTheme(pireTheme, langue)}`),
        detail: t(
          `Score de ${nombre(pireTheme.score, 2, langue)}/5 sur ${pireTheme.nb_reponses} réponses, le plus bas des ${themesFiables.length} thèmes.`,
          `Score of ${nombre(pireTheme.score, 2, langue)}/5 over ${pireTheme.nb_reponses} answers, the lowest of ${themesFiables.length} themes.`,
        ),
      },
    });
  }

  // Point de contact le plus faible : le dernier du classement avec assez d'avis.
  const pointsFiables = classement.filter((point) => point.note_moyenne !== null && point.nb_avis >= AVIS_MIN_POINT);
  const pirePoint = pointsFiables.at(-1);
  if (
    pirePoint !== undefined &&
    pirePoint.note_moyenne !== null &&
    (pointsFiables.length > 1 || pirePoint.note_moyenne < NOTE_ROUGE)
  ) {
    const poids = pirePoint.note_moyenne < NOTE_ROUGE ? 85 : pirePoint.note_moyenne < NOTE_VERTE ? 55 : 20;
    candidats.push({
      poids,
      point: {
        code: "point_faible",
        titre: t(
          `Point de contact le moins bien noté : ${pirePoint.nom}`,
          `Lowest rated contact point: ${pirePoint.nom}`,
        ),
        detail: t(
          `${pirePoint.site_nom} : ${nombre(pirePoint.note_moyenne, 2, langue)}/5 sur ${pirePoint.nb_avis} avis.`,
          `${pirePoint.site_nom}: ${nombre(pirePoint.note_moyenne, 2, langue)}/5 over ${pirePoint.nb_avis} reviews.`,
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
          ? t("Alertes qui traînent", "Alerts left waiting")
          : t("Alertes en attente", "Pending alerts"),
        detail:
          heures !== null
            ? t(
                `${alertes.nombre} alerte(s) ouverte(s), la plus ancienne depuis ${dureeEnTexte(heures, langue)}.`,
                `${alertes.nombre} open alert(s), the oldest one for ${dureeEnTexte(heures, langue)}.`,
              )
            : t(`${alertes.nombre} alerte(s) ouverte(s).`, `${alertes.nombre} open alert(s).`),
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
      const pic =
        negatifs.pic !== null && negatifs.pic.nombre >= NEGATIFS_MIN_JOUR
          ? t(
              ` Pic le ${dateEnTexte(negatifs.pic.date, langue)} : ${negatifs.pic.nombre} avis négatifs.`,
              ` Peak on ${dateEnTexte(negatifs.pic.date, langue)}: ${negatifs.pic.nombre} negative reviews.`,
            )
          : "";
      candidats.push({
        poids: 65,
        point: {
          code: "negatifs_concentres",
          titre: t(`Avis négatifs concentrés le ${nomJour}`, `Negative reviews concentrated on ${nomJour}s`),
          detail: t(
            `${nombreJour} des ${negatifs.total} avis négatifs (${nombre(part * 100, 0, langue)} %) arrivent ce jour-là.${pic}`,
            `${nombreJour} of the ${negatifs.total} negative reviews (${nombre(part * 100, 0, langue)}%) come on that day.${pic}`,
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
        titre: t("Taux de réponse faible", "Low response rate"),
        detail: t(
          `Seulement ${nombre(tauxReponse, 1, langue)} % des clients qui scannent le QR code envoient leur avis.`,
          `Only ${nombre(tauxReponse, 1, langue)}% of customers who scan the QR code send their review.`,
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
  const { kpis, themes, classement, negatifs } = donnees;

  let titre: string;
  let detail: string;

  switch (point.code) {
    case "note_basse":
    case "note_moyenne":
      titre = t("Relire les avis les plus bas", "Read the lowest reviews");
      detail = t(
        "Lisez les commentaires des avis notés 1 et 2, repérez ce qui revient et choisissez une action simple à lancer cette semaine.",
        "Read the comments of the reviews rated 1 and 2, spot what comes back and pick one simple action to start this week.",
      );
      break;
    case "baisse_note":
      titre = t("Comprendre la baisse", "Understand the drop");
      detail = t(
        "Comparez avec la période précédente : qu’est-ce qui a changé (équipe, offre, affluence, travaux) ? Corrigez le plus vite ce qui explique l’écart.",
        "Compare with the previous period: what changed (team, offer, crowds, works)? Fix as soon as possible what explains the gap.",
      );
      break;
    case "nps_negatif":
      titre = t("Écouter les détracteurs", "Listen to detractors");
      detail = t(
        "Rappelez les clients mécontents qui ont laissé leurs coordonnées pour comprendre leurs raisons et leur proposer un geste.",
        "Call back the unhappy customers who left their contact details to understand their reasons and offer a gesture.",
      );
      break;
    case "theme_faible": {
      const pire = themes.filter((theme) => theme.nb_reponses >= REPONSES_MIN_THEME)[0];
      const nom = pire !== undefined ? libelleTheme(pire, langue) : "";
      titre = t(`Agir sur le thème « ${nom} »`, `Act on the theme "${nom}"`);
      detail = t(
        "Regardez le détail par question de ce thème dans le tableau de bord, puis fixez une action corrective avec l’équipe concernée.",
        "Look at the per-question detail of this theme in the dashboard, then agree on a corrective action with the team concerned.",
      );
      break;
    }
    case "point_faible": {
      const pire = classement.filter((ligne) => ligne.note_moyenne !== null && ligne.nb_avis >= AVIS_MIN_POINT).at(-1);
      const nom = pire !== undefined ? pire.nom : "";
      titre = t(`Aller voir « ${nom} »`, `Go and check "${nom}"`);
      detail = t(
        "Passez sur place et lisez ses derniers commentaires pour comprendre ce qui déçoit les clients à cet endroit.",
        "Visit it and read its latest comments to understand what disappoints customers there.",
      );
      break;
    }
    case "alertes_qui_trainent":
      titre = t("Traiter les alertes ouvertes", "Handle the open alerts");
      detail = t(
        `Traitez en premier les ${kpis.alertes_ouvertes.nombre} alerte(s) ouverte(s), de la plus ancienne à la plus récente, puis passez les avis en « Traité ».`,
        `Handle the ${kpis.alertes_ouvertes.nombre} open alert(s) first, from the oldest to the newest, then set the reviews to "Resolved".`,
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
      titre = t(`Renforcer le ${nomJour}`, `Strengthen ${nomJour}s`);
      detail = t(
        `Prévoyez plus d’équipe ou une vigilance particulière le ${nomJour} : c’est là que les clients se plaignent le plus.`,
        `Plan more staff or extra care on ${nomJour}s: that is when customers complain the most.`,
      );
      break;
    }
    case "taux_reponse_faible":
      titre = t("Mieux montrer le QR code", "Make the QR code more visible");
      detail = t(
        "Placez le QR code plus en vue (3 x 3 cm minimum, bon contraste, support mat) et invitez les clients à scanner.",
        "Place the QR code where it is easier to see (3 x 3 cm minimum, good contrast, matte surface) and invite customers to scan.",
      );
      break;
    default:
      titre = t("Suivre ce point", "Keep an eye on this");
      detail = t("Surveillez cet indicateur à la prochaine période.", "Watch this indicator over the next period.");
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

  // Resume : volume, note avec son evolution, NPS.
  const note = indicateurs.note_moyenne;
  const evolution = kpis.evolution.note_moyenne.difference;
  let texteNote: string;
  if (note === null) {
    texteNote = t("aucune note", "no rating");
  } else if (evolution === null) {
    texteNote = `${nombre(note, 2, langue)}/5`;
  } else if (evolution === 0) {
    texteNote = t(
      `${nombre(note, 2, langue)}/5 (stable par rapport à la période précédente)`,
      `${nombre(note, 2, langue)}/5 (stable compared with the previous period)`,
    );
  } else {
    texteNote = t(
      `${nombre(note, 2, langue)}/5 (${avecSigne(evolution, 2, langue)} par rapport à la période précédente)`,
      `${nombre(note, 2, langue)}/5 (${avecSigne(evolution, 2, langue)} compared with the previous period)`,
    );
  }
  const texteNps =
    indicateurs.nps === null ? t("aucun NPS", "no NPS") : `NPS ${nombre(indicateurs.nps, 1, langue)}`;

  const pointsFaibles = retenir(candidatsFaibles(donnees, langue));
  const pistes = pointsFaibles.map((point) => pisteDuPoint(point, donnees, langue));
  if (pistes.length === 0) {
    pistes.push({
      code: "maintenir",
      titre: t("Maintenir le niveau", "Keep up the level"),
      detail: t(
        "Rien d’inquiétant sur la période : continuez ainsi et partagez les bonnes pratiques avec toute l’équipe.",
        "Nothing worrying over the period: keep going and share good practices with the whole team.",
      ),
    });
  }

  return {
    langue,
    periode,
    nb_avis: indicateurs.nb_avis,
    suffisant: true,
    resume: t(
      `${intervalle} : ${indicateurs.nb_avis} avis, note moyenne ${texteNote}, ${texteNps}.`,
      `${intervalle}: ${indicateurs.nb_avis} reviews, average rating ${texteNote}, ${texteNps}.`,
    ),
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