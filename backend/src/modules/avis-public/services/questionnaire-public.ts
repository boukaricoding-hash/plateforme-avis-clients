import { prisma } from "../../../configuration/base-de-donnees";

type QuestionPublique = {
  id: string;
  ordre: number;
  type: string;
  libelle: unknown;
  aide: unknown;
  obligatoire: boolean;
  options: unknown;
  echelle_min: number | null;
  echelle_max: number | null;
  libelles_extremites: unknown;
};

export type DonneesQuestionnairePublic = {
  point_contact: { nom: string; type: string };
  organisation: {
    nom: string;
    logo_url: string | null;
    couleur_principale: string | null;
    langue_defaut: string;
  };
  questionnaire: {
    version_id: string;
    titre: unknown;
    message_accueil: unknown;
    message_remerciement: unknown;
    langue_defaut: string;
    questions: QuestionPublique[];
  };
};

export type EtatErreurPublic =
  | "qr_inconnu"
  | "qr_desactive"
  | "organisation_suspendue"
  | "questionnaire_inactif"
  | "evenement_pas_commence"
  | "evenement_termine";

export type ResultatQuestionnairePublic =
  | { etat: "ok"; donnees: DonneesQuestionnairePublic }
  | { etat: EtatErreurPublic };

// ------------------------------------------------------------
// Verification commune du QR code (GET du questionnaire et POST d'un avis)
// ------------------------------------------------------------

type PointAVerifier = {
  actif: boolean;
  revoque_le: Date | null;
  supprime_le: Date | null;
  organisation: { statut: string; supprime_le: Date | null };
  questionnaire: {
    statut: string;
    date_debut: Date | null;
    date_fin: Date | null;
    supprime_le: Date | null;
  } | null;
};

// Renvoie l'erreur a afficher, ou null si le QR code peut etre utilise.
// versionPubliee : vrai si le questionnaire a une version publiee utilisable.
function verifierEtatQr(point: PointAVerifier, versionPubliee: boolean): EtatErreurPublic | null {
  if (point.supprime_le !== null || point.revoque_le !== null || !point.actif) {
    return "qr_desactive";
  }

  if (point.organisation.supprime_le !== null || point.organisation.statut === "SUSPENDU") {
    return "organisation_suspendue";
  }

  const questionnaire = point.questionnaire;
  if (
    !questionnaire ||
    !versionPubliee ||
    questionnaire.supprime_le !== null ||
    questionnaire.statut !== "ACTIF"
  ) {
    return "questionnaire_inactif";
  }

  const maintenant = new Date();
  if (questionnaire.date_debut !== null && questionnaire.date_debut > maintenant) {
    return "evenement_pas_commence";
  }
  if (questionnaire.date_fin !== null && questionnaire.date_fin < maintenant) {
    return "evenement_termine";
  }

  return null;
}

// ------------------------------------------------------------
// GET : afficher le questionnaire (et compter le scan)
// ------------------------------------------------------------

// Un scan est compte seulement quand le questionnaire est vraiment affiche.
// Si l'enregistrement echoue, le client voit quand meme le questionnaire.
async function enregistrerScan(organisationId: string, pointContactId: string): Promise<void> {
  try {
    await prisma.scan.create({
      data: { organisation_id: organisationId, point_contact_id: pointContactId },
    });
  } catch (erreur) {
    console.error("Scan non enregistre :", erreur);
  }
}

// Cherche le questionnaire a afficher pour un code de QR code, sans connexion.
export async function lireQuestionnairePublic(code: string): Promise<ResultatQuestionnairePublic> {
  const point = await prisma.pointContact.findUnique({
    where: { code_public: code },
    select: {
      id: true,
      nom: true,
      type: true,
      actif: true,
      revoque_le: true,
      supprime_le: true,
      organisation_id: true,
      organisation: {
        select: {
          nom: true,
          logo_url: true,
          couleur_principale: true,
          langue_defaut: true,
          statut: true,
          supprime_le: true,
        },
      },
      questionnaire: {
        select: {
          titre: true,
          message_accueil: true,
          message_remerciement: true,
          langue_defaut: true,
          statut: true,
          date_debut: true,
          date_fin: true,
          supprime_le: true,
          versions: {
            orderBy: { numero: "desc" },
            take: 1,
            select: {
              id: true,
              publie_le: true,
              questions: {
                orderBy: { ordre: "asc" },
                select: {
                  id: true,
                  ordre: true,
                  type: true,
                  libelle: true,
                  aide: true,
                  obligatoire: true,
                  options: true,
                  echelle_min: true,
                  echelle_max: true,
                  libelles_extremites: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!point) {
    return { etat: "qr_inconnu" };
  }

  const organisation = point.organisation;
  const questionnaire = point.questionnaire;
  const version = questionnaire?.versions[0];

  const erreur = verifierEtatQr(point, version !== undefined && version.publie_le !== null);
  if (erreur !== null) {
    return { etat: erreur };
  }
  if (!questionnaire || !version) {
    return { etat: "questionnaire_inactif" };
  }

  await enregistrerScan(point.organisation_id, point.id);

  return {
    etat: "ok",
    donnees: {
      point_contact: { nom: point.nom, type: point.type },
      organisation: {
        nom: organisation.nom,
        logo_url: organisation.logo_url,
        couleur_principale: organisation.couleur_principale,
        langue_defaut: organisation.langue_defaut,
      },
      questionnaire: {
        version_id: version.id,
        titre: questionnaire.titre,
        message_accueil: questionnaire.message_accueil,
        message_remerciement: questionnaire.message_remerciement,
        langue_defaut: questionnaire.langue_defaut,
        questions: version.questions,
      },
    },
  };
}

// ------------------------------------------------------------
// POST : contexte necessaire pour enregistrer un avis (aucun scan compte)
// ------------------------------------------------------------

export type QuestionPourEnvoi = {
  id: string;
  type: string;
  obligatoire: boolean;
  options: unknown;
  echelle_min: number | null;
  echelle_max: number | null;
};

export type ContexteEnvoiAvis = {
  organisation_id: string;
  site_id: string;
  point_contact_id: string;
  version_id: string;
  questions: QuestionPourEnvoi[];
};

export type EtatErreurEnvoi = EtatErreurPublic | "version_invalide";

export type ResultatContexteEnvoi =
  | { etat: "ok"; contexte: ContexteEnvoiAvis }
  | { etat: EtatErreurEnvoi };

// Verifie le QR code (memes regles que le GET) puis retrouve la version
// du questionnaire que le client a vue. Cette version doit appartenir au
// questionnaire du point de contact et etre publiee : l'avis reste lie a
// la version vue, meme si une version plus recente existe.
export async function lireContexteEnvoi(
  code: string,
  versionId: string,
): Promise<ResultatContexteEnvoi> {
  const point = await prisma.pointContact.findUnique({
    where: { code_public: code },
    select: {
      id: true,
      site_id: true,
      organisation_id: true,
      actif: true,
      revoque_le: true,
      supprime_le: true,
      organisation: {
        select: { statut: true, supprime_le: true },
      },
      questionnaire: {
        select: {
          id: true,
          statut: true,
          date_debut: true,
          date_fin: true,
          supprime_le: true,
        },
      },
    },
  });

  if (!point) {
    return { etat: "qr_inconnu" };
  }

  // La version est cherchee plus bas : ici on ne controle que le reste.
  const erreur = verifierEtatQr(point, true);
  if (erreur !== null) {
    return { etat: erreur };
  }
  if (!point.questionnaire) {
    return { etat: "questionnaire_inactif" };
  }

  const version = await prisma.questionnaireVersion.findFirst({
    where: {
      id: versionId,
      questionnaire_id: point.questionnaire.id,
      publie_le: { not: null },
    },
    select: {
      id: true,
      questions: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          type: true,
          obligatoire: true,
          options: true,
          echelle_min: true,
          echelle_max: true,
        },
      },
    },
  });

  if (!version) {
    return { etat: "version_invalide" };
  }

  return {
    etat: "ok",
    contexte: {
      organisation_id: point.organisation_id,
      site_id: point.site_id,
      point_contact_id: point.id,
      version_id: version.id,
      questions: version.questions,
    },
  };
}