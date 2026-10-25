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
  if (point.supprime_le !== null || point.revoque_le !== null || !point.actif) {
    return { etat: "qr_desactive" };
  }

  const organisation = point.organisation;
  if (organisation.supprime_le !== null || organisation.statut === "SUSPENDU") {
    return { etat: "organisation_suspendue" };
  }

  const questionnaire = point.questionnaire;
  const version = questionnaire?.versions[0];
  if (
    !questionnaire ||
    !version ||
    questionnaire.supprime_le !== null ||
    questionnaire.statut !== "ACTIF" ||
    version.publie_le === null
  ) {
    return { etat: "questionnaire_inactif" };
  }

  const maintenant = new Date();
  if (questionnaire.date_debut !== null && questionnaire.date_debut > maintenant) {
    return { etat: "evenement_pas_commence" };
  }
  if (questionnaire.date_fin !== null && questionnaire.date_fin < maintenant) {
    return { etat: "evenement_termine" };
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