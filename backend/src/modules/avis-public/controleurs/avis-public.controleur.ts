import type { Request, Response } from "express";
import { schemaCodePublic } from "../validations/code-public";
import { schemaCorpsAvis } from "../validations/avis";
import {
  lireQuestionnairePublic,
  lireContexteEnvoi,
  type EtatErreurPublic,
  type ResultatQuestionnairePublic,
} from "../services/questionnaire-public";
import { creerAvis, trouverAvisParCle } from "../services/creer-avis";
import {
  verifierAntiDoublon,
  NOM_COOKIE_APPAREIL,
  OPTIONS_COOKIE_APPAREIL,
} from "../services/anti-doublon";
import { apresCreationAvis } from "../services/apres-creation-avis";

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

// Type d'appareil deduit du navigateur, cote serveur (jamais envoye par le client).
function deduireAppareil(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  if (/iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) {
    return "tablette";
  }
  if (/Mobi|iPhone|Android/i.test(userAgent)) {
    return "mobile";
  }
  return "ordinateur";
}

export async function creerUnAvisPublic(req: Request, res: Response): Promise<void> {
  res.set("Cache-Control", "no-store");

  // 1. Code du QR : un code mal forme recoit la meme reponse qu'un code inconnu.
  const lectureCode = schemaCodePublic.safeParse(req.params);
  if (!lectureCode.success) {
    const erreur = ERREURS.qr_inconnu;
    res.status(erreur.statut).json({ code: erreur.code, message: erreur.message, details: null });
    return;
  }

  // 2. Forme du corps envoye par le telephone.
  const lectureCorps = schemaCorpsAvis.safeParse(req.body ?? {});
  if (!lectureCorps.success) {
    res.status(400).json({
      code: "AVIS_INVALIDE",
      message: "Les informations envoyees sont invalides.",
      details: lectureCorps.error.issues.map((probleme) => ({
        champ: probleme.path.join("."),
        message: probleme.message,
      })),
    });
    return;
  }
  const corps = lectureCorps.data;

  // 3. Champ piege : cache pour les humains, rempli par les robots.
  // Refus sans explication, et rien n'est enregistre.
  if (corps.site_web !== undefined && corps.site_web.trim() !== "") {
    res.status(400).json({
      code: "AVIS_INVALIDE",
      message: "Les informations envoyees sont invalides.",
      details: null,
    });
    return;
  }

  // 4. QR code valide, organisation active, questionnaire ouvert, version vue par le client.
  const contexte = await lireContexteEnvoi(lectureCode.data.code, corps.version_id);
  if (contexte.etat === "version_invalide") {
    res.status(400).json({
      code: "VERSION_INVALIDE",
      message: "Cette version du questionnaire n'est pas valide.",
      details: [{ champ: "version_id", message: "Version inconnue pour ce QR code." }],
    });
    return;
  }
  if (contexte.etat !== "ok") {
    const erreur = ERREURS[contexte.etat];
    res.status(erreur.statut).json({ code: erreur.code, message: erreur.message, details: null });
    return;
  }

  // 5. Cle unique : un renvoi apres coupure du reseau ne cree pas de deuxieme avis.
  // Ce controle passe AVANT l'anti-doublon, sinon le renvoi serait refuse.
  if (corps.cle_unique !== undefined) {
    const existant = await trouverAvisParCle(contexte.contexte.point_contact_id, corps.cle_unique);
    if (existant !== null) {
      res.status(200).json({ id: existant });
      return;
    }
  }

  // 6. Anti-doublon : un avis par appareil et par point de contact sur la periode.
  const cookieRecu: unknown = req.cookies?.[NOM_COOKIE_APPAREIL];
  const verification = await verifierAntiDoublon({
    organisationId: contexte.contexte.organisation_id,
    pointContactId: contexte.contexte.point_contact_id,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    appareilId: typeof cookieRecu === "string" ? cookieRecu : undefined,
  });

  // Le cookie de l'appareil est pose dans tous les cas (nouveau ou deja connu).
  res.cookie(NOM_COOKIE_APPAREIL, verification.appareil_id, OPTIONS_COOKIE_APPAREIL);

  if (verification.refuse) {
    res.status(409).json({
      code: "AVIS_DEJA_DONNE",
      message: "Vous avez deja donne votre avis. Merci pour votre participation !",
      details: null,
    });
    return;
  }

  // 7. Verification des reponses et enregistrement.
  const appareil = deduireAppareil(req.get("user-agent"));
  const creation = await creerAvis(contexte.contexte, corps, appareil, verification.empreinte);

  if (creation.etat === "invalide") {
    res.status(400).json({
      code: "AVIS_INVALIDE",
      message: "Certaines reponses sont invalides.",
      details: creation.erreurs,
    });
    return;
  }

  // 8. Travaux apres l'enregistrement (alerte, plus tard agregats), seulement pour un nouvel avis.
  // Ils sont proteges : une panne ici ne fait jamais perdre l'avis.
  if (!creation.deja_existant) {
    await apresCreationAvis(creation.avis_id);
  }

  // 200 si deux envois identiques sont arrives au meme instant, 201 pour un nouvel avis.
  res.status(creation.deja_existant ? 200 : 201).json({ id: creation.avis_id });
}