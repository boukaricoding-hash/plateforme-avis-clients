import "dotenv/config";
import { prisma } from "../configuration/base-de-donnees";
import { declencherAlerteSiNecessaire } from "../modules/alertes/services/alertes";
import {
  debutDuJourUtc,
  recalculerAgregatsPeriode,
} from "../modules/agregats/services/calcul-agregats";
import { clonerModele } from "../modules/questionnaires/services/modeles";

// ------------------------------------------------------------
// Donnees de demonstration (jour 7) : npm run demo
// ------------------------------------------------------------
// Cree environ 200 avis varies sur 28 jours pour l'organisation "Restaurant Demo"
// (celle de prisma/seed.ts), avec des avis negatifs, des alertes, des statuts
// melanges et des scans. Lancer d'abord le seed.
//
// Relancable sans doublon :
// - les avis de demonstration portent la cle "demo:N" ; au relancement ils sont
//   supprimes (avec leurs reponses, alertes, notifications et historique) puis recrees ;
// - TOUS les scans de l'organisation de demonstration sont supprimes puis recrees
//   (un scan n'a pas de marqueur) ;
// - les autres avis de l'organisation (tests a la main) ne sont jamais touches.
// Le tirage est deterministe (graine fixe) : memes chiffres a chaque lancement.

const NOM_ORGANISATION = "Restaurant Demo";
const NOMBRE_AVIS = 200;
const NOMBRE_JOURS = 28;
const NOMBRE_SCANS_SANS_AVIS = 110;
const PREFIXE_CLE = "demo:";
const GRAINE = 20261029;

const UNE_SECONDE_EN_MS = 1000;
const UNE_MINUTE_EN_MS = 60 * UNE_SECONDE_EN_MS;
const UNE_HEURE_EN_MS = 60 * UNE_MINUTE_EN_MS;
const UN_JOUR_EN_MS = 24 * UNE_HEURE_EN_MS;

type Statut = "NOUVEAU" | "EN_COURS" | "TRAITE" | "IGNORE";
type Alea = () => number;

// Note moyenne attendue par theme : la rapidite est le point faible, la proprete le point fort.
const MOYENNE_PAR_THEME: Record<string, number> = {
  accueil: 4.3,
  qualite_plats: 4.2,
  rapidite: 3.1,
  proprete: 4.4,
  prix: 3.6,
  ambiance: 4.0,
};

const COMMENTAIRES_POSITIFS = [
  "Très bon repas, le service était chaleureux.",
  "Plats délicieux et bien présentés, on reviendra !",
  "Excellent accueil, merci à toute l'équipe.",
  "Ambiance agréable et cuisine savoureuse.",
  "Super rapport qualité-prix, je recommande.",
  "Personnel souriant et attentionné.",
  "Le poulet braisé était parfait.",
  "Une belle découverte, tout était très bon.",
];
const COMMENTAIRES_NEUTRES = [
  "C'était correct, sans plus.",
  "Bon repas mais le service pourrait être plus rapide.",
  "Plats corrects, un peu d'attente avant d'être servi.",
  "Rien à redire sur la cuisine, l'ambiance est moyenne.",
  "Bien dans l'ensemble, quelques améliorations possibles.",
];
const COMMENTAIRES_NEGATIFS = [
  "Service très lent, nous avons attendu plus de 40 minutes.",
  "Le plat est arrivé froid, c'est dommage.",
  "Table sale à notre arrivée et personnel peu aimable.",
  "Trop cher pour la qualité proposée.",
  "Commande oubliée, il a fallu relancer deux fois.",
  "Je suis déçu, la viande n'était pas assez cuite.",
  "Bruit et mauvaise organisation, nous ne reviendrons pas.",
];
const COMMENTAIRES_SUIVI = [
  "Client rappelé, geste commercial accordé.",
  "Problème signalé à l'équipe de salle.",
  "Excuses présentées, point suivi en réunion.",
];
const PRENOMS = ["Kossi", "Ama", "Yaovi", "Afi", "Komla", "Akouvi", "Mawuli", "Esso"];

// ------------------------------------------------------------
// Tirage au hasard repetable
// ------------------------------------------------------------

function creerAlea(graine: number): Alea {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Entier entre min et max, bornes comprises.
function entre(alea: Alea, min: number, max: number): number {
  return min + Math.floor(alea() * (max - min + 1));
}

function choisir<T>(alea: Alea, liste: readonly T[]): T {
  return liste[Math.floor(alea() * liste.length)] as T;
}

// Environ une loi normale centree, ecart-type 0,5.
function gauss(alea: Alea): number {
  return alea() + alea() + alea() - 1.5;
}

function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

function tirer(alea: Alea, choix: Array<[Statut, number]>): Statut {
  let t = alea();
  for (const [statut, probabilite] of choix) {
    t -= probabilite;
    if (t < 0) {
      return statut;
    }
  }
  return choix[0]?.[0] ?? "NOUVEAU";
}

// ------------------------------------------------------------
// Dates
// ------------------------------------------------------------

// Jour (0 = aujourd'hui, 1 = hier...) : un peu plus d'avis du vendredi au dimanche.
function choisirDecalage(alea: Alea, debutAujourdhui: Date): number {
  const poids: number[] = [];
  for (let decalage = 0; decalage < NOMBRE_JOURS; decalage++) {
    const jourSemaine = new Date(debutAujourdhui.getTime() - decalage * UN_JOUR_EN_MS).getUTCDay();
    let p = decalage === 0 ? 0.4 : 1;
    if (jourSemaine === 5 || jourSemaine === 6 || jourSemaine === 0) {
      p *= 1.6;
    }
    poids.push(p);
  }
  const total = poids.reduce((somme, p) => somme + p, 0);
  let tirage = alea() * total;
  for (const [decalage, p] of poids.entries()) {
    tirage -= p;
    if (tirage < 0) {
      return decalage;
    }
  }
  return 0;
}

// Heure de repas (midi ou soir). Aujourd'hui : quelques heures avant maintenant.
function instantAleatoire(
  alea: Alea,
  maintenant: Date,
  debutAujourdhui: Date,
  decalage: number,
): Date {
  if (decalage === 0) {
    return new Date(maintenant.getTime() - entre(alea, 10, 300) * UNE_MINUTE_EN_MS);
  }
  const heure = alea() < 0.5 ? entre(alea, 12, 14) : entre(alea, 19, 22);
  const debutJour = debutAujourdhui.getTime() - decalage * UN_JOUR_EN_MS;
  return new Date(
    debutJour +
      heure * UNE_HEURE_EN_MS +
      entre(alea, 0, 59) * UNE_MINUTE_EN_MS +
      entre(alea, 0, 59) * UNE_SECONDE_EN_MS,
  );
}

// ------------------------------------------------------------
// Fabrication d'un avis
// ------------------------------------------------------------

type QuestionDemo = {
  id: string;
  type: string;
  code_theme: string | null;
  echelle_min: number | null;
  echelle_max: number | null;
};

type PointDemo = { id: string; site_id: string };

type AvisDemo = {
  index: number;
  decalage: number;
  soumis_le: Date;
  point: PointDemo;
  langue: string;
  appareil: string;
  reponses: Array<{ question_id: string; valeur_numerique: number }>;
  note_globale: number | null;
  nps: number | null;
  commentaire: string | null;
  consentement: boolean;
  contact_nom: string | null;
  contact_tel: string | null;
  contact_email: string | null;
  negatif: boolean;
  statut: Statut;
};

type Seuils = { note: number; nps: number };

function genererAvis(
  alea: Alea,
  index: number,
  questions: QuestionDemo[],
  points: PointDemo[],
  seuils: Seuils,
  maintenant: Date,
  debutAujourdhui: Date,
): AvisDemo {
  const decalage = choisirDecalage(alea, debutAujourdhui);
  const soumisLe = instantAleatoire(alea, maintenant, debutAujourdhui, decalage);
  const point = choisir(alea, points);

  // Humeur du client : la plupart sont contents, quelques-uns tres mecontents.
  const tirageHumeur = alea();
  const humeur =
    tirageHumeur < 0.12
      ? -2.2 + gauss(alea) * 0.8
      : tirageHumeur < 0.3
        ? 0.7 + gauss(alea) * 0.6
        : 0.1 + gauss(alea);

  // 1. Notes : etoiles, emojis et echelle (ramenees sur 5 pour la note globale).
  const reponses: Array<{ question_id: string; valeur_numerique: number }> = [];
  const notesSur5: number[] = [];
  for (const question of questions) {
    if (question.type === "ETOILES" || question.type === "EMOJIS") {
      const base =
        (question.code_theme !== null ? MOYENNE_PAR_THEME[question.code_theme] : undefined) ?? 4;
      const note = borner(Math.round(base + humeur + gauss(alea) * 1.6), 1, 5);
      reponses.push({ question_id: question.id, valeur_numerique: note });
      notesSur5.push(note);
    } else if (question.type === "ECHELLE") {
      const min = question.echelle_min ?? 1;
      const max = question.echelle_max ?? 5;
      if (max <= min) {
        continue;
      }
      const note = borner(Math.round(4 + humeur + gauss(alea) * 1.6), 1, 5);
      const valeur = Math.round(((note - 1) / 4) * (max - min) + min);
      reponses.push({ question_id: question.id, valeur_numerique: valeur });
      notesSur5.push(((valeur - min) / (max - min)) * 4 + 1);
    }
  }

  const moyenne =
    notesSur5.length > 0 ? notesSur5.reduce((somme, n) => somme + n, 0) / notesSur5.length : 4;
  const noteGlobale = notesSur5.length > 0 ? Math.round(moyenne * 100) / 100 : null;

  // 2. NPS : suit la satisfaction generale, avec un peu de hasard.
  let nps: number | null = null;
  for (const question of questions) {
    if (question.type === "NPS" && nps === null) {
      nps = borner(Math.round((moyenne - 1) * 2.5 + (alea() + alea() - 1) * 2), 0, 10);
      reponses.push({ question_id: question.id, valeur_numerique: nps });
    }
  }

  // 3. Avis negatif : meme regle que les alertes (seuils de l'organisation).
  const negatif =
    (noteGlobale !== null && noteGlobale <= seuils.note) || (nps !== null && nps <= seuils.nps);

  // 4. Langue, appareil et commentaire (les commentaires sont en francais).
  const langue = alea() < 0.12 ? "en" : "fr";
  const appareil = alea() < 0.9 ? "mobile" : "tablette";
  let commentaire: string | null = null;
  if (langue === "fr" && alea() < 0.4) {
    commentaire =
      moyenne <= 2.4
        ? choisir(alea, COMMENTAIRES_NEGATIFS)
        : moyenne <= 3.6
          ? choisir(alea, COMMENTAIRES_NEUTRES)
          : choisir(alea, COMMENTAIRES_POSITIFS);
  }

  // 5. Quelques clients laissent leurs coordonnees avec leur consentement.
  const consentement = alea() < 0.1;
  const prenom = choisir(alea, PRENOMS);
  const contactNom = consentement ? prenom : null;
  const contactTel = consentement ? "+2289" + String(entre(alea, 1000000, 9999999)) : null;
  const contactEmail = consentement ? prenom.toLowerCase() + index + "@exemple.tg" : null;

  // 6. Statut de traitement : les vieux avis sont traites, les recents sont a traiter.
  let statut: Statut;
  if (negatif) {
    if (decalage >= 14) {
      statut = tirer(alea, [["TRAITE", 0.65], ["IGNORE", 0.25], ["EN_COURS", 0.1]]);
    } else if (decalage >= 3) {
      statut = tirer(alea, [["TRAITE", 0.4], ["EN_COURS", 0.3], ["NOUVEAU", 0.25], ["IGNORE", 0.05]]);
    } else {
      statut = tirer(alea, [["NOUVEAU", 0.7], ["EN_COURS", 0.3]]);
    }
  } else if (decalage >= 7) {
    statut = tirer(alea, [["TRAITE", 0.5], ["IGNORE", 0.1], ["NOUVEAU", 0.4]]);
  } else {
    statut = tirer(alea, [["NOUVEAU", 0.8], ["TRAITE", 0.2]]);
  }

  return {
    index,
    decalage,
    soumis_le: soumisLe,
    point,
    langue,
    appareil,
    reponses,
    note_globale: noteGlobale,
    nps,
    commentaire,
    consentement,
    contact_nom: contactNom,
    contact_tel: contactTel,
    contact_email: contactEmail,
    negatif,
    statut,
  };
}

// ------------------------------------------------------------
// Programme principal
// ------------------------------------------------------------

async function main(): Promise<void> {
  const alea = creerAlea(GRAINE);
  const maintenant = new Date();
  const debutAujourdhui = debutDuJourUtc(maintenant);
  const debutFenetre = new Date(debutAujourdhui.getTime() - (NOMBRE_JOURS - 1) * UN_JOUR_EN_MS);

  // 1. L'organisation de demonstration et son responsable (crees par prisma/seed.ts).
  const organisation = await prisma.organisation.findFirst({
    where: { nom: NOM_ORGANISATION, supprime_le: null },
    select: {
      id: true,
      secteur_id: true,
      seuil_alerte_note: true,
      seuil_alerte_nps: true,
    },
  });
  if (!organisation) {
    throw new Error('Organisation "' + NOM_ORGANISATION + '" introuvable : lancez d\'abord le seed.');
  }
  const responsable = await prisma.utilisateur.findFirst({
    where: { organisation_id: organisation.id, role: "RESPONSABLE", actif: true, supprime_le: null },
    select: { id: true },
  });
  if (!responsable) {
    throw new Error("Aucun responsable actif dans l'organisation de demonstration.");
  }

  // 2. Le questionnaire de l'organisation : clone du modele restauration s'il n'existe pas.
  let questionnaire = await prisma.questionnaire.findFirst({
    where: { organisation_id: organisation.id, est_modele: false, supprime_le: null },
    orderBy: { cree_le: "asc" },
    select: { id: true },
  });
  if (!questionnaire) {
    const modele = await prisma.questionnaire.findFirst({
      where: { est_modele: true, secteur_id: organisation.secteur_id, supprime_le: null },
      select: { id: true },
    });
    if (!modele) {
      throw new Error("Modele de questionnaire introuvable : lancez d'abord le seed.");
    }
    const copieId = await clonerModele(organisation.id, modele.id);
    if (copieId === null) {
      throw new Error("Le modele n'a pas pu etre copie.");
    }
    questionnaire = { id: copieId };
    console.log("Questionnaire de l'organisation cree depuis le modele.");
  }

  await prisma.questionnaire.update({ where: { id: questionnaire.id }, data: { statut: "ACTIF" } });

  const version = await prisma.questionnaireVersion.findFirst({
    where: { questionnaire_id: questionnaire.id },
    orderBy: { numero: "desc" },
    select: {
      id: true,
      publie_le: true,
      questions: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          type: true,
          echelle_min: true,
          echelle_max: true,
          theme: { select: { code: true } },
        },
      },
    },
  });
  if (!version) {
    throw new Error("Le questionnaire n'a aucune version.");
  }
  if (version.publie_le === null) {
    await prisma.questionnaireVersion.update({ where: { id: version.id }, data: { publie_le: new Date() } });
  }
  const questions: QuestionDemo[] = version.questions.map((question) => ({
    id: question.id,
    type: question.type,
    code_theme: question.theme ? question.theme.code : null,
    echelle_min: question.echelle_min,
    echelle_max: question.echelle_max,
  }));

  // 3. Les tables sans questionnaire recoivent celui de l'organisation.
  await prisma.pointContact.updateMany({
    where: { organisation_id: organisation.id, questionnaire_id: null, supprime_le: null },
    data: { questionnaire_id: questionnaire.id },
  });
  const points: PointDemo[] = await prisma.pointContact.findMany({
    where: {
      organisation_id: organisation.id,
      questionnaire_id: questionnaire.id,
      supprime_le: null,
      actif: true,
    },
    select: { id: true, site_id: true },
  });
  if (points.length === 0) {
    throw new Error("Aucun point de contact actif : lancez d'abord le seed.");
  }

  // 4. Nettoyage de l'ancienne demonstration. On retient le plus ancien jour deja
  // present pour que les agregats de ces jours soient recalcules (ou retires) a la fin.
  const [premierAvis, premierScan, premierAgregat] = [
    await prisma.avis.aggregate({
      where: { organisation_id: organisation.id },
      _min: { soumis_le: true },
    }),
    await prisma.scan.aggregate({
      where: { organisation_id: organisation.id },
      _min: { cree_le: true },
    }),
    await prisma.agregatQuotidien.aggregate({
      where: { organisation_id: organisation.id },
      _min: { date: true },
    }),
  ];
  let premierJour = debutFenetre;
  for (const ancien of [premierAvis._min.soumis_le, premierScan._min.cree_le, premierAgregat._min.date]) {
    if (ancien !== null && ancien.getTime() < premierJour.getTime()) {
      premierJour = ancien;
    }
  }

  const anciens = await prisma.avis.findMany({
    where: { organisation_id: organisation.id, cle_idempotence: { startsWith: PREFIXE_CLE } },
    select: { id: true },
  });
  const anciensIds = anciens.map((ligne) => ligne.id);
  if (anciensIds.length > 0) {
    await prisma.notification.deleteMany({ where: { avis_id: { in: anciensIds } } });
    await prisma.alerte.deleteMany({ where: { avis_id: { in: anciensIds } } });
    await prisma.avisSuivi.deleteMany({ where: { avis_id: { in: anciensIds } } });
    await prisma.reponse.deleteMany({ where: { avis_id: { in: anciensIds } } });
    await prisma.avis.deleteMany({ where: { id: { in: anciensIds } } });
  }
  await prisma.scan.deleteMany({ where: { organisation_id: organisation.id } });
  console.log("Ancienne demonstration supprimee : " + anciensIds.length + " avis.");

  // 5. Les avis, du plus ancien au plus recent.
  const seuils: Seuils = { note: organisation.seuil_alerte_note, nps: organisation.seuil_alerte_nps };
  const avisDemo: AvisDemo[] = [];
  for (let index = 1; index <= NOMBRE_AVIS; index++) {
    avisDemo.push(genererAvis(alea, index, questions, points, seuils, maintenant, debutAujourdhui));
  }
  avisDemo.sort((a, b) => a.soumis_le.getTime() - b.soumis_le.getTime());

  let nombreNegatifs = 0;
  for (const demo of avisDemo) {
    // Les requetes se font l'une apres l'autre : on ne prend qu'une connexion a la fois.
    const avis = await prisma.avis.create({
      data: {
        organisation_id: organisation.id,
        site_id: demo.point.site_id,
        point_contact_id: demo.point.id,
        version_id: version.id,
        soumis_le: demo.soumis_le,
        langue: demo.langue,
        appareil: demo.appareil,
        note_globale: demo.note_globale,
        nps: demo.nps,
        commentaire: demo.commentaire,
        consentement: demo.consentement,
        contact_nom: demo.contact_nom,
        contact_tel: demo.contact_tel,
        contact_email: demo.contact_email,
        statut_traitement: demo.statut,
        cle_idempotence: PREFIXE_CLE + demo.index,
        reponses: {
          create: demo.reponses.map((reponse) => ({
            organisation_id: organisation.id,
            question_id: reponse.question_id,
            valeur_numerique: reponse.valeur_numerique,
          })),
        },
      },
      select: { id: true },
    });

    // Alerte et notifications, par le vrai service, puis datees a l'heure de l'avis.
    if (demo.negatif) {
      nombreNegatifs += 1;
      await declencherAlerteSiNecessaire(avis.id);
      await prisma.alerte.updateMany({ where: { avis_id: avis.id }, data: { cree_le: demo.soumis_le } });

      const lue = demo.statut === "TRAITE" || demo.statut === "IGNORE" || demo.decalage >= 3;
      const dateLecture = new Date(
        Math.min(demo.soumis_le.getTime() + 30 * UNE_MINUTE_EN_MS, maintenant.getTime()),
      );
      await prisma.notification.updateMany({
        where: { avis_id: avis.id },
        data: { cree_le: demo.soumis_le, lue_le: lue ? dateLecture : null },
      });
    }

    // Historique des changements de statut, signes par le responsable.
    if (demo.statut !== "NOUVEAU") {
      const etapes: Array<[Statut, Statut]> =
        demo.statut === "TRAITE" && demo.negatif && alea() < 0.5
          ? [["NOUVEAU", "EN_COURS"], ["EN_COURS", "TRAITE"]]
          : [["NOUVEAU", demo.statut]];

      let instant = demo.soumis_le.getTime();
      for (const [index, [ancien, nouveau]] of etapes.entries()) {
        instant += entre(alea, 20, 20 * 60) * UNE_MINUTE_EN_MS;
        const derniere = index === etapes.length - 1;
        await prisma.avisSuivi.create({
          data: {
            organisation_id: organisation.id,
            avis_id: avis.id,
            utilisateur_id: responsable.id,
            type: "CHANGEMENT_STATUT",
            ancien_statut: ancien,
            nouveau_statut: nouveau,
            commentaire:
              derniere && nouveau === "TRAITE" && demo.negatif ? choisir(alea, COMMENTAIRES_SUIVI) : null,
            cree_le: new Date(Math.min(instant, maintenant.getTime())),
          },
        });
      }
    }
  }
  console.log("Avis crees : " + avisDemo.length + " (dont " + nombreNegatifs + " negatifs).");

  // 6. Les scans : un avant chaque avis, plus des scans sans avis (taux de reponse d'environ 65 %).
  const scans: Array<{ organisation_id: string; point_contact_id: string; cree_le: Date }> = [];
  for (const demo of avisDemo) {
    scans.push({
      organisation_id: organisation.id,
      point_contact_id: demo.point.id,
      cree_le: new Date(demo.soumis_le.getTime() - entre(alea, 40, 240) * UNE_SECONDE_EN_MS),
    });
  }
  for (let numero = 0; numero < NOMBRE_SCANS_SANS_AVIS; numero++) {
    const decalage = choisirDecalage(alea, debutAujourdhui);
    scans.push({
      organisation_id: organisation.id,
      point_contact_id: choisir(alea, points).id,
      cree_le: instantAleatoire(alea, maintenant, debutAujourdhui, decalage),
    });
  }
  await prisma.scan.createMany({ data: scans });
  console.log("Scans crees : " + scans.length + ".");

  // 7. Agregats : tous les jours concernes, anciens et nouveaux.
  const traites = await recalculerAgregatsPeriode(premierJour, maintenant);
  console.log("Agregats recalcules (" + traites + " lignes traitees).");

  // 8. Resume.
  const alertesOuvertes = await prisma.alerte.count({
    where: {
      organisation_id: organisation.id,
      avis: { statut_traitement: { in: ["NOUVEAU", "EN_COURS"] }, supprime_le: null },
    },
  });
  console.log("--- Resume ---");
  console.log("Avis de l'organisation : " + (await prisma.avis.count({ where: { organisation_id: organisation.id } })));
  console.log("Alertes ouvertes : " + alertesOuvertes);
  console.log("Scans : " + (await prisma.scan.count({ where: { organisation_id: organisation.id } })));
  console.log(
    "Lignes d'agregats : " +
      (await prisma.agregatQuotidien.count({ where: { organisation_id: organisation.id } })),
  );
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });