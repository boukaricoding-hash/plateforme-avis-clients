import type { Request, Response } from "express";
import { schemaCodePublic } from "../validations/code-public";
import {
  lireQuestionnairePublic,
  type EtatErreurPublic,
  type ResultatQuestionnairePublic,
} from "../services/questionnaire-public";

// Une erreur claire par situation : l'application du client choisit la page a afficher avec "code".
const ERREURS: Record<EtatErreurPublic, { statut: number; code: string; message: string }> = {
  qr_inconnu: { statut: 404, code: "QR_INCONNU", message: "Ce QR code n'existe pas." },
  qr_desactive: { statut: 410, code: "QR_DESACTIVE", message: "Ce QR code est desactive." },
  organisation_suspendue: {
    statut: 403,
    code: "ORGANISATION_SUSPENDUE",
    message: "Ce service est momentanement indisponible.",
  },
  questionnaire_inactif: {
    statut: 409,
    code: "QUESTIONNAIRE_INACTIF",
    message: "Ce questionnaire n'est pas disponible pour le moment.",
  },
  evenement_pas_commence: {
    statut: 409,
    code: "EVENEMENT_PAS_COMMENCE",
    message: "Ce questionnaire n'est pas encore ouvert.",
  },
  evenement_termine: {
    statut: 410,
    code: "EVENEMENT_TERMINE",
    message: "Ce questionnaire est termine.",
  },
};

export async function lireLeQuestionnairePublic(req: Request, res: Response): Promise<void> {
  // La reponse change a chaque scan : on interdit la mise en cache.
  res.set("Cache-Control", "no-store");

  // Un code mal forme recoit la meme reponse qu'un code inconnu.
  const lecture = schemaCodePublic.safeParse(req.params);
  const resultat: ResultatQuestionnairePublic = lecture.success
    ? await lireQuestionnairePublic(lecture.data.code)
    : { etat: "qr_inconnu" };

  if (resultat.etat !== "ok") {
    const erreur = ERREURS[resultat.etat];
    res.status(erreur.statut).json({ code: erreur.code, message: erreur.message, details: null });
    return;
  }

  res.status(200).json(resultat.donnees);
}