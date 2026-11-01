import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Configuration lue dans backend/.env :
// SMTP_HOTE, SMTP_PORT, SMTP_SECURISE, SMTP_UTILISATEUR, SMTP_MOT_DE_PASSE, EMAIL_EXPEDITEUR.
// En local : Mailpit (localhost:1025, messages visibles sur http://localhost:8025).

let transporteur: Transporter | null = null;

function lireTransporteur(): Transporter | null {
  if (transporteur) {
    return transporteur;
  }

  const hote = process.env["SMTP_HOTE"];
  if (!hote) {
    return null;
  }

  const utilisateur = process.env["SMTP_UTILISATEUR"] ?? "";
  const motDePasse = process.env["SMTP_MOT_DE_PASSE"] ?? "";

  transporteur = nodemailer.createTransport({
    host: hote,
    port: Number(process.env["SMTP_PORT"]) || 587,
    secure: process.env["SMTP_SECURISE"] === "true",
    // Sans identifiants (Mailpit), on n'envoie pas de connexion.
    ...(utilisateur !== "" ? { auth: { user: utilisateur, pass: motDePasse } } : {}),
    // Un serveur de messagerie qui ne repond pas ne doit pas bloquer l'API.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporteur;
}

export type EmailAEnvoyer = {
  a: string;
  sujet: string;
  texte: string;
  html: string;
};

// Envoie un e-mail. Renvoie true si le serveur l'a accepte, false sinon.
// Ne leve jamais d'erreur : l'appelant decide quoi faire (ici, on ne revele rien a l'utilisateur).
// Le contenu du message et l'adresse ne sont jamais ecrits dans les journaux.
export async function envoyerEmail(email: EmailAEnvoyer): Promise<boolean> {
  const transport = lireTransporteur();
  if (!transport) {
    console.error("Envoi d'e-mail impossible : SMTP_HOTE n'est pas configure.");
    return false;
  }

  try {
    await transport.sendMail({
      from: process.env["EMAIL_EXPEDITEUR"] ?? "Avis clients <avis@exemple.tg>",
      to: email.a,
      subject: email.sujet,
      text: email.texte,
      html: email.html,
    });
    return true;
  } catch (erreur) {
    const raison = erreur instanceof Error ? erreur.message : "erreur inconnue";
    console.error("Envoi d'e-mail impossible :", raison);
    return false;
  }
}

// A utiliser pour tout texte venant d'un utilisateur ou d'un client dans le corps HTML d'un e-mail.
export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}