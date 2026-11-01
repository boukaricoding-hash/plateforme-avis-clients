import type { Request, Response } from "express";
import { prisma } from "../../../configuration/base-de-donnees";
import { echapperHtml, envoyerEmail } from "../../../utilitaires/envoi-email";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { hacherMotDePasse, validerMotDePasse } from "../services/mots-de-passe";
import {
  DUREE_VALIDITE_JETON_MINUTES,
  consommerJeton,
  creerJetonReinitialisation,
  trouverJetonValide,
} from "../services/jetons-reinitialisation";
import {
  schemaDemandeReinitialisation,
  schemaReinitialisation,
} from "../validations/reinitialisation";

const MESSAGE_DEMANDE =
  "Si cette adresse correspond a un compte, un e-mail de reinitialisation vient d'etre envoye.";
const MESSAGE_SUCCES = "Votre mot de passe a ete modifie. Vous pouvez vous connecter.";
const MESSAGE_LIEN_INVALIDE = "Ce lien est invalide ou a expire. Demandez un nouveau lien.";

// Temps minimum de reponse : meme duree que l'adresse existe ou non.
const DELAI_MINIMUM_MS = 300;

async function attendreJusqua(debut: number): Promise<void> {
  const reste = DELAI_MINIMUM_MS - (Date.now() - debut);
  if (reste > 0) {
    await new Promise<void>((resolu) => setTimeout(resolu, reste));
  }
}

function construireLien(jeton: string): string {
  const base = (process.env["TABLEAU_DE_BORD_URL"] ?? "http://localhost:5174").replace(/\/+$/, "");
  return base + "/reinitialiser-mot-de-passe?jeton=" + encodeURIComponent(jeton);
}

function construireEmail(nom: string, lien: string): { sujet: string; texte: string; html: string } {
  const sujet = "Réinitialisation de votre mot de passe";

  const texte = [
    "Bonjour " + nom + ",",
    "",
    "Vous avez demandé la réinitialisation de votre mot de passe.",
    "Cliquez sur ce lien pour en choisir un nouveau :",
    lien,
    "",
    "Ce lien est valable " + DUREE_VALIDITE_JETON_MINUTES + " minutes et ne peut être utilisé qu'une seule fois.",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.",
  ].join("\n");

  const html = [
    "<p>Bonjour " + echapperHtml(nom) + ",</p>",
    "<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>",
    '<p><a href="' + echapperHtml(lien) + '">Choisir un nouveau mot de passe</a></p>',
    "<p>Ce lien est valable " + DUREE_VALIDITE_JETON_MINUTES + " minutes et ne peut être utilisé qu'une seule fois.</p>",
    "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>",
  ].join("\n");

  return { sujet, texte, html };
}

export async function demanderReinitialisation(req: Request, res: Response): Promise<void> {
  const debut = Date.now();

  const lecture = schemaDemandeReinitialisation.safeParse(req.body);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return;
  }
  const { email } = lecture.data;

  const utilisateur = await prisma.utilisateur.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, actif: true, supprime_le: null },
  });

  await enregistrerAudit({
    action: "REINITIALISATION_DEMANDEE",
    utilisateurId: utilisateur?.id ?? null,
    organisationId: utilisateur?.organisation_id ?? null,
    ip: req.ip,
    details: { compte_trouve: utilisateur !== null },
  });

  if (utilisateur) {
    const jeton = await creerJetonReinitialisation(utilisateur.id);
    const message = construireEmail(utilisateur.nom, construireLien(jeton));

    // Envoi en arriere-plan : la reponse n'attend pas le serveur de messagerie.
    void envoyerEmail({ a: utilisateur.email, ...message })
      .then(async (envoye) => {
        if (!envoye) {
          await enregistrerAudit({
            action: "REINITIALISATION_EMAIL_ECHEC",
            utilisateurId: utilisateur.id,
            organisationId: utilisateur.organisation_id,
          });
        }
      })
      .catch(() => undefined);
  }

  await attendreJusqua(debut);
  res.status(200).json({ message: MESSAGE_DEMANDE });
}

export async function reinitialiser(req: Request, res: Response): Promise<void> {
  const lecture = schemaReinitialisation.safeParse(req.body);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return;
  }
  const { jeton, mot_de_passe } = lecture.data;

  const reponseLienInvalide = (): void => {
    res.status(400).json({ code: "LIEN_INVALIDE", message: MESSAGE_LIEN_INVALIDE, details: null });
  };

  // Le jeton est verifie en premier : un lien invalide ne revele rien d'autre.
  const jetonValide = await trouverJetonValide(jeton);
  if (!jetonValide) {
    reponseLienInvalide();
    return;
  }

  const validation = validerMotDePasse(mot_de_passe, jetonValide.email);
  if (!validation.valide) {
    res.status(400).json({ code: "MOT_DE_PASSE_INVALIDE", message: validation.message, details: null });
    return;
  }

  const motDePasseHache = await hacherMotDePasse(mot_de_passe);
  const consomme = await consommerJeton({
    jetonId: jetonValide.id,
    utilisateurId: jetonValide.utilisateurId,
    motDePasseHache,
  });
  if (!consomme) {
    reponseLienInvalide();
    return;
  }

  await enregistrerAudit({
    action: "MOT_DE_PASSE_REINITIALISE",
    utilisateurId: jetonValide.utilisateurId,
    organisationId: jetonValide.organisationId,
    ip: req.ip,
  });

  res.status(200).json({ message: MESSAGE_SUCCES });
}