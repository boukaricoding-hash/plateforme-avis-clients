import type { Request, Response } from "express";
import { repondreDonneesInvalides } from "../../../utilitaires/reponses";
import { hacherMotDePasse, validerMotDePasse } from "../../authentification/services/mots-de-passe";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { accepterInvitation, verifierInvitation } from "../services/invitations";
import {
  schemaAcceptationInvitation,
  schemaVerificationInvitation,
} from "../validations/utilisateurs";

const MESSAGE_LIEN_INVALIDE =
  "Ce lien est invalide ou a expire. Demandez une nouvelle invitation.";
const MESSAGE_SITES_INDISPONIBLES =
  "Les sites de votre invitation n'existent plus. Demandez une nouvelle invitation.";
const MESSAGE_SUCCES = "Votre compte est active. Vous pouvez vous connecter.";

function repondreLienInvalide(res: Response): void {
  res.status(400).json({ code: "LIEN_INVALIDE", message: MESSAGE_LIEN_INVALIDE, details: null });
}

function repondreSitesIndisponibles(res: Response): void {
  res
    .status(400)
    .json({ code: "SITES_INDISPONIBLES", message: MESSAGE_SITES_INDISPONIBLES, details: null });
}

// GET /invitations/verifier?jeton=... (public)
// La page d'acceptation l'appelle a l'ouverture pour afficher l'e-mail et l'organisation.
export async function verifierLeLien(req: Request, res: Response): Promise<void> {
  const lecture = schemaVerificationInvitation.safeParse(req.query);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return;
  }

  const resultat = await verifierInvitation(lecture.data.jeton);
  if (resultat.etat === "lien_invalide") {
    repondreLienInvalide(res);
    return;
  }
  if (resultat.etat === "sites_indisponibles") {
    repondreSitesIndisponibles(res);
    return;
  }

  res.status(200).json({
    email: resultat.invitation.email,
    organisation: resultat.invitation.organisationNom,
    role: resultat.invitation.role,
  });
}

// POST /invitations/accepter (public)
// Le jeton est verifie en premier : un lien invalide ne revele rien d'autre.
export async function accepterLInvitation(req: Request, res: Response): Promise<void> {
  const lecture = schemaAcceptationInvitation.safeParse(req.body);
  if (!lecture.success) {
    repondreDonneesInvalides(res, lecture.error);
    return;
  }
  const { jeton, nom, mot_de_passe } = lecture.data;

  const verification = await verifierInvitation(jeton);
  if (verification.etat === "lien_invalide") {
    repondreLienInvalide(res);
    return;
  }
  if (verification.etat === "sites_indisponibles") {
    repondreSitesIndisponibles(res);
    return;
  }
  const { invitation } = verification;

  const validation = validerMotDePasse(mot_de_passe, invitation.email);
  if (!validation.valide) {
    res
      .status(400)
      .json({ code: "MOT_DE_PASSE_INVALIDE", message: validation.message, details: null });
    return;
  }

  // Le hachage est lent : on ne le fait qu'apres avoir verifie le lien et le mot de passe.
  const motDePasseHache = await hacherMotDePasse(mot_de_passe);
  const resultat = await accepterInvitation({ invitation, nom, motDePasseHache });

  // Lien deja utilise ou adresse prise entre-temps : meme reponse, on ne revele rien.
  if (resultat.etat !== "ok") {
    repondreLienInvalide(res);
    return;
  }

  await enregistrerAudit({
    action: "INVITATION_ACCEPTEE",
    utilisateurId: resultat.utilisateurId,
    organisationId: invitation.organisationId,
    ip: req.ip,
    details: { role: invitation.role, nombre_sites: invitation.siteIds.length },
  });

  res.status(201).json({ message: MESSAGE_SUCCES });
}