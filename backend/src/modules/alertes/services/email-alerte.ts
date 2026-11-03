import { prisma } from "../../../configuration/base-de-donnees";
import { echapperHtml, envoyerEmail } from "../../../utilitaires/envoi-email";

// ------------------------------------------------------------
// E-mail d'alerte : avis negatif (jour 16)
// ------------------------------------------------------------
// Ce fichier construit l'e-mail et l'envoie aux destinataires qui veulent
// l'alerte tout de suite (alertes_groupees = false). Les autres recoivent
// le resume quotidien (fichier resume-alertes.ts).
// Chaque notification garde la date d'envoi dans email_envoye_le :
// un meme e-mail ne part jamais deux fois.

const LONGUEUR_COMMENTAIRE_EMAIL = 300;

export type LangueEmail = "fr" | "en";

export type DonneesEmailAlerte = {
  langue: string;
  nom: string;
  site: string;
  pointContact: string;
  note: number | null;
  nps: number | null;
  commentaire: string | null;
  lien: string;
};

export type ContenuEmail = {
  sujet: string;
  texte: string;
  html: string;
};

// Textes de l'e-mail dans chaque langue (les textes affiches gardent leurs accents).
const TEXTES = {
  fr: {
    sujet: "Avis négatif : ",
    bonjour: "Bonjour ",
    intro: "Un avis négatif vient d'être reçu.",
    site: "Site : ",
    pointContact: "Point de contact : ",
    note: "Note : ",
    nps: "NPS : ",
    commentaire: "Commentaire : ",
    lien: "Voir l'avis",
    pied: "Vous recevez ce message parce que vous suivez les avis de cet établissement.",
  },
  en: {
    sujet: "Negative review: ",
    bonjour: "Hello ",
    intro: "A negative review has just been received.",
    site: "Site: ",
    pointContact: "Contact point: ",
    note: "Rating: ",
    nps: "NPS: ",
    commentaire: "Comment: ",
    lien: "View the review",
    pied: "You are receiving this message because you follow this business's reviews.",
  },
} satisfies Record<LangueEmail, Record<string, string>>;

export function choisirLangue(langue: string): LangueEmail {
  return langue === "en" ? "en" : "fr";
}

// Texte sur une seule ligne, sans retour a la ligne : sert pour le sujet et l'extrait.
export function surUneLigne(texte: string): string {
  return texte.replace(/\s+/g, " ").trim();
}

export function couper(texte: string, longueur: number): string {
  return texte.length > longueur ? texte.slice(0, longueur - 3) + "..." : texte;
}

// Note affichee avec une decimale au plus (virgule en francais, point en anglais).
export function formaterNote(note: number, langue: LangueEmail): string {
  const arrondie = String(Math.round(note * 10) / 10);
  return (langue === "fr" ? arrondie.replace(".", ",") : arrondie) + "/5";
}

// Adresse de la fiche de l'avis dans le tableau de bord.
export function construireLienAvis(avisId: string): string {
  const base = (process.env["TABLEAU_DE_BORD_URL"] ?? "http://localhost:5174").replace(/\/+$/, "");
  return base + "/avis/" + encodeURIComponent(avisId);
}

// Construit le sujet, le texte et la version HTML. Tout texte venant d'un client ou
// d'un utilisateur est echappe dans le HTML.
export function construireEmailAlerte(donnees: DonneesEmailAlerte): ContenuEmail {
  const langue = choisirLangue(donnees.langue);
  const t = TEXTES[langue];

  const site = surUneLigne(donnees.site);
  const pointContact = surUneLigne(donnees.pointContact);
  const commentaire =
    donnees.commentaire === null
      ? ""
      : couper(surUneLigne(donnees.commentaire), LONGUEUR_COMMENTAIRE_EMAIL);

  const sujet = t.sujet + pointContact + " (" + site + ")";

  // Les lignes d'information : on n'ecrit que ce qui existe.
  const lignes: { libelle: string; valeur: string }[] = [
    { libelle: t.site, valeur: site },
    { libelle: t.pointContact, valeur: pointContact },
  ];
  if (donnees.note !== null) {
    lignes.push({ libelle: t.note, valeur: formaterNote(donnees.note, langue) });
  }
  if (donnees.nps !== null) {
    lignes.push({ libelle: t.nps, valeur: String(donnees.nps) });
  }
  if (commentaire !== "") {
    lignes.push({ libelle: t.commentaire, valeur: commentaire });
  }

  const texte = [
    t.bonjour + surUneLigne(donnees.nom) + ",",
    "",
    t.intro,
    "",
    ...lignes.map((ligne) => ligne.libelle + ligne.valeur),
    "",
    t.lien + " : " + donnees.lien,
    "",
    t.pied,
  ].join("\n");

  const html = [
    "<p>" + t.bonjour + echapperHtml(surUneLigne(donnees.nom)) + ",</p>",
    "<p>" + t.intro + "</p>",
    "<ul>",
    ...lignes.map(
      (ligne) => "<li><strong>" + ligne.libelle + "</strong>" + echapperHtml(ligne.valeur) + "</li>",
    ),
    "</ul>",
    '<p><a href="' + echapperHtml(donnees.lien) + '">' + t.lien + "</a></p>",
    "<p><small>" + t.pied + "</small></p>",
  ].join("\n");

  return { sujet, texte, html };
}

// Envoie l'e-mail d'un avis negatif aux destinataires en alerte immediate.
// Renvoie le nombre d'e-mails acceptes par le serveur de messagerie.
// Ne leve pas d'erreur pour un e-mail refuse : la notification reste, l'e-mail sera
// reessaye au prochain appel (email_envoye_le reste vide).
export async function envoyerEmailsAlerteImmediate(avisId: string): Promise<number> {
  const avis = await prisma.avis.findUnique({
    where: { id: avisId },
    select: {
      id: true,
      note_globale: true,
      nps: true,
      commentaire: true,
      site: { select: { nom: true } },
      point_contact: { select: { nom: true } },
    },
  });
  if (!avis) {
    return 0;
  }

  const notifications = await prisma.notification.findMany({
    where: {
      avis_id: avis.id,
      type: "ALERTE_AVIS",
      email_envoye_le: null,
      utilisateur: { actif: true, supprime_le: null, alertes_groupees: false },
    },
    select: {
      id: true,
      utilisateur: { select: { email: true, nom: true, langue: true } },
    },
  });

  const lien = construireLienAvis(avis.id);
  let envoyes = 0;

  for (const notification of notifications) {
    // 1. On reserve l'envoi : si un autre traitement l'a deja pris, on passe.
    const reservation = await prisma.notification.updateMany({
      where: { id: notification.id, email_envoye_le: null },
      data: { email_envoye_le: new Date() },
    });
    if (reservation.count === 0) {
      continue;
    }

    // 2. Envoi. Si le serveur refuse, on libere la reservation pour un nouvel essai.
    const contenu = construireEmailAlerte({
      langue: notification.utilisateur.langue,
      nom: notification.utilisateur.nom,
      site: avis.site.nom,
      pointContact: avis.point_contact.nom,
      note: avis.note_globale,
      nps: avis.nps,
      commentaire: avis.commentaire,
      lien,
    });
    const accepte = await envoyerEmail({ a: notification.utilisateur.email, ...contenu });

    if (accepte) {
      envoyes += 1;
    } else {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { email_envoye_le: null },
      });
    }
  }

  return envoyes;
}