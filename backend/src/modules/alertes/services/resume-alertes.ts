import { prisma } from "../../../configuration/base-de-donnees";
import { echapperHtml, envoyerEmail } from "../../../utilitaires/envoi-email";
import {
  choisirLangue,
  construireLienAvis,
  couper,
  formaterNote,
  surUneLigne,
  type ContenuEmail,
} from "./email-alerte";

// ------------------------------------------------------------
// Resume quotidien des alertes (jour 16)
// ------------------------------------------------------------
// Les utilisateurs qui ont choisi "alertes groupees" ne recoivent pas un e-mail
// par avis negatif : ils recoivent UN e-mail par jour avec tous les avis negatifs
// pas encore envoyes. La fonction est lancee chaque matin par la tache planifiee
// (fichier taches-arriere-plan/resume-quotidien.ts).
// Comme pour l'alerte immediate, email_envoye_le evite tout doublon.

// Nombre d'avis detailles dans un e-mail : au-dela, on ecrit "et N autres".
const AVIS_PAR_EMAIL = 20;
const LONGUEUR_COMMENTAIRE_RESUME = 200;
// Garde-fou : nombre maximum de notifications traitees a chaque passage.
const NOTIFICATIONS_PAR_PASSAGE = 2000;

export type AvisResume = {
  id: string;
  site: string;
  pointContact: string;
  note: number | null;
  nps: number | null;
  commentaire: string | null;
};

export type DonneesEmailResume = {
  langue: string;
  nom: string;
  avis: AvisResume[];
};

// Textes de l'e-mail dans chaque langue (les textes affiches gardent leurs accents).
const TEXTES = {
  fr: {
    bonjour: "Bonjour ",
    intro: "Voici les avis négatifs reçus depuis votre dernier résumé.",
    note: "note ",
    liste: "Voir tous les avis négatifs",
    pied: "Vous recevez ce résumé parce que vous avez choisi les alertes groupées.",
  },
  en: {
    bonjour: "Hello ",
    intro: "Here are the negative reviews received since your last summary.",
    note: "rating ",
    liste: "See all negative reviews",
    pied: "You are receiving this summary because you chose grouped alerts.",
  },
};

function sujetResume(nombre: number, langue: "fr" | "en"): string {
  if (langue === "fr") {
    return nombre === 1 ? "Résumé : 1 nouvel avis négatif" : "Résumé : " + nombre + " nouveaux avis négatifs";
  }
  return nombre === 1 ? "Summary: 1 new negative review" : "Summary: " + nombre + " new negative reviews";
}

function texteAutres(nombre: number, langue: "fr" | "en"): string {
  if (langue === "fr") {
    return nombre === 1 ? "… et 1 autre avis négatif." : "… et " + nombre + " autres avis négatifs.";
  }
  return nombre === 1 ? "... and 1 other negative review." : "... and " + nombre + " other negative reviews.";
}

// Adresse de la liste des avis negatifs dans le tableau de bord.
function lienListeNegatifs(): string {
  const base = (process.env["TABLEAU_DE_BORD_URL"] ?? "http://localhost:5174").replace(/\/+$/, "");
  return base + "/avis?negatifs=true";
}

// "note 1,5/5, NPS 3" : on n'ecrit que ce qui existe.
function detailsAvis(avis: AvisResume, langue: "fr" | "en"): string {
  const t = TEXTES[langue];
  const details: string[] = [];
  if (avis.note !== null) {
    details.push(t.note + formaterNote(avis.note, langue));
  }
  if (avis.nps !== null) {
    details.push("NPS " + avis.nps);
  }
  return details.join(", ");
}

// Construit le sujet, le texte et la version HTML du resume. Tout texte venant d'un client
// ou d'un utilisateur est echappe dans le HTML.
export function construireEmailResume(donnees: DonneesEmailResume): ContenuEmail {
  const langue = choisirLangue(donnees.langue);
  const t = TEXTES[langue];

  const detailles = donnees.avis.slice(0, AVIS_PAR_EMAIL);
  const restants = donnees.avis.length - detailles.length;

  // Une ligne par avis : "Table 12 (Restaurant) - note 1,5/5, NPS 3 - commentaire".
  const lignes = detailles.map((avis) => {
    const titre = surUneLigne(avis.pointContact) + " (" + surUneLigne(avis.site) + ")";
    const details = detailsAvis(avis, langue);
    const commentaire =
      avis.commentaire === null
        ? ""
        : couper(surUneLigne(avis.commentaire), LONGUEUR_COMMENTAIRE_RESUME);
    return { titre, details, commentaire, lien: construireLienAvis(avis.id) };
  });

  const texte = [
    t.bonjour + surUneLigne(donnees.nom) + ",",
    "",
    t.intro,
    "",
    ...lignes.map(
      (ligne) =>
        "- " +
        ligne.titre +
        (ligne.details !== "" ? " - " + ligne.details : "") +
        (ligne.commentaire !== "" ? " - " + ligne.commentaire : "") +
        "\n  " +
        ligne.lien,
    ),
    ...(restants > 0 ? ["", texteAutres(restants, langue)] : []),
    "",
    t.liste + " : " + lienListeNegatifs(),
    "",
    t.pied,
  ].join("\n");

  const html = [
    "<p>" + t.bonjour + echapperHtml(surUneLigne(donnees.nom)) + ",</p>",
    "<p>" + t.intro + "</p>",
    "<ul>",
    ...lignes.map(
      (ligne) =>
        '<li><a href="' +
        echapperHtml(ligne.lien) +
        '">' +
        echapperHtml(ligne.titre) +
        "</a>" +
        (ligne.details !== "" ? " - " + echapperHtml(ligne.details) : "") +
        (ligne.commentaire !== "" ? " - " + echapperHtml(ligne.commentaire) : "") +
        "</li>",
    ),
    "</ul>",
    ...(restants > 0 ? ["<p>" + texteAutres(restants, langue) + "</p>"] : []),
    '<p><a href="' + echapperHtml(lienListeNegatifs()) + '">' + t.liste + "</a></p>",
    "<p><small>" + t.pied + "</small></p>",
  ].join("\n");

  return { sujet: sujetResume(donnees.avis.length, langue), texte, html };
}

// Envoie un resume a chaque utilisateur en alertes groupees qui a des avis negatifs
// pas encore envoyes. Renvoie le nombre d'e-mails acceptes par le serveur de messagerie.
export async function envoyerResumesAlertes(): Promise<number> {
  const notifications = await prisma.notification.findMany({
    where: {
      type: "ALERTE_AVIS",
      email_envoye_le: null,
      avis_id: { not: null },
      utilisateur: { actif: true, supprime_le: null, alertes_groupees: true },
    },
    orderBy: [{ cree_le: "asc" }, { id: "asc" }],
    take: NOTIFICATIONS_PAR_PASSAGE,
    select: {
      id: true,
      utilisateur_id: true,
      utilisateur: { select: { email: true, nom: true, langue: true } },
      avis: {
        select: {
          id: true,
          note_globale: true,
          nps: true,
          commentaire: true,
          site: { select: { nom: true } },
          point_contact: { select: { nom: true } },
        },
      },
    },
  });

  // Regroupement par utilisateur : un e-mail par personne.
  const parUtilisateur = new Map<string, typeof notifications>();
  for (const notification of notifications) {
    const liste = parUtilisateur.get(notification.utilisateur_id) ?? [];
    liste.push(notification);
    parUtilisateur.set(notification.utilisateur_id, liste);
  }

  let envoyes = 0;

  for (const liste of parUtilisateur.values()) {
    const premiere = liste[0];
    if (premiere === undefined) {
      continue;
    }
    const identifiants = liste.map((notification) => notification.id);

    // 1. On reserve l'envoi : si un autre traitement l'a deja pris, on passe.
    const reservation = await prisma.notification.updateMany({
      where: { id: { in: identifiants }, email_envoye_le: null },
      data: { email_envoye_le: new Date() },
    });
    if (reservation.count === 0) {
      continue;
    }

    // 2. Construction et envoi. Si le serveur refuse, on libere la reservation :
    // le resume sera reessaye au prochain passage.
    const avis: AvisResume[] = [];
    for (const notification of liste) {
      if (notification.avis !== null) {
        avis.push({
          id: notification.avis.id,
          site: notification.avis.site.nom,
          pointContact: notification.avis.point_contact.nom,
          note: notification.avis.note_globale,
          nps: notification.avis.nps,
          commentaire: notification.avis.commentaire,
        });
      }
    }

    const contenu = construireEmailResume({
      langue: premiere.utilisateur.langue,
      nom: premiere.utilisateur.nom,
      avis,
    });
    const accepte = await envoyerEmail({ a: premiere.utilisateur.email, ...contenu });

    if (accepte) {
      envoyes += 1;
    } else {
      await prisma.notification.updateMany({
        where: { id: { in: identifiants } },
        data: { email_envoye_le: null },
      });
    }
  }

  return envoyes;
}