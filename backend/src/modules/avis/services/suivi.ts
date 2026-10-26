import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { DonneesChangementStatut } from "../validations/suivi";

// Ce que l'API renvoie pour une ligne d'historique (jamais organisation_id).
const SELECTION_SUIVI = {
  id: true,
  type: true,
  ancien_statut: true,
  nouveau_statut: true,
  commentaire: true,
  cree_le: true,
  utilisateur: { select: { id: true, nom: true } },
} satisfies Prisma.AvisSuiviSelect;

export type SuiviCree = Prisma.AvisSuiviGetPayload<{ select: typeof SELECTION_SUIVI }>;

export type ResultatChangementStatut =
  | { etat: "introuvable" }
  | { etat: "inchange" }
  | { etat: "conflit" }
  | { etat: "ok"; statut_traitement: string; suivi: SuiviCree };

// Un commentaire vide devient "pas de commentaire".
function commentaireOuNull(commentaire: string | undefined): string | null {
  return commentaire !== undefined && commentaire !== "" ? commentaire : null;
}

// Retrouve l'avis seulement s'il est dans l'organisation, non supprime et dans le perimetre.
async function trouverAvisAccessible(organisationId: string, perimetre: string[] | null, avisId: string) {
  return prisma.avis.findFirst({
    where: {
      id: avisId,
      organisation_id: organisationId,
      supprime_le: null,
      ...(perimetre !== null ? { site_id: { in: perimetre } } : {}),
    },
    select: { id: true, statut_traitement: true },
  });
}

// ------------------------------------------------------------
// Changer le statut d'un avis
// ------------------------------------------------------------

export async function changerStatutAvis(
  organisationId: string,
  perimetre: string[] | null,
  avisId: string,
  utilisateurId: string,
  donnees: DonneesChangementStatut,
): Promise<ResultatChangementStatut> {
  const avis = await trouverAvisAccessible(organisationId, perimetre, avisId);
  if (avis === null) {
    return { etat: "introuvable" };
  }
  if (avis.statut_traitement === donnees.statut) {
    return { etat: "inchange" };
  }

  // Le changement et la ligne d'historique sont enregistres ensemble, ou pas du tout.
  return prisma.$transaction(async (tx): Promise<ResultatChangementStatut> => {
    // On exige que le statut soit encore celui qu'on a lu : si quelqu'un l'a change
    // entre-temps, rien n'est ecrit (conflit).
    const modifie = await tx.avis.updateMany({
      where: {
        id: avis.id,
        organisation_id: organisationId,
        statut_traitement: avis.statut_traitement,
      },
      data: { statut_traitement: donnees.statut },
    });
    if (modifie.count === 0) {
      return { etat: "conflit" };
    }

    const suivi = await tx.avisSuivi.create({
      data: {
        organisation_id: organisationId,
        avis_id: avis.id,
        utilisateur_id: utilisateurId,
        type: "CHANGEMENT_STATUT",
        ancien_statut: avis.statut_traitement,
        nouveau_statut: donnees.statut,
        commentaire: commentaireOuNull(donnees.commentaire),
      },
      select: SELECTION_SUIVI,
    });

    return { etat: "ok", statut_traitement: donnees.statut, suivi };
  });
}

// ------------------------------------------------------------
// Ajouter une note interne
// ------------------------------------------------------------

// Renvoie null si l'avis est introuvable (autre organisation, hors perimetre, supprime).
export async function ajouterNoteInterne(
  organisationId: string,
  perimetre: string[] | null,
  avisId: string,
  utilisateurId: string,
  commentaire: string,
): Promise<SuiviCree | null> {
  const avis = await trouverAvisAccessible(organisationId, perimetre, avisId);
  if (avis === null) {
    return null;
  }

  return prisma.avisSuivi.create({
    data: {
      organisation_id: organisationId,
      avis_id: avis.id,
      utilisateur_id: utilisateurId,
      type: "NOTE",
      commentaire,
    },
    select: SELECTION_SUIVI,
  });
}