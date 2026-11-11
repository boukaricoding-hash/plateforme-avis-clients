import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { creerInvitation } from "../../utilisateurs/services/invitations";
import type { ResultatInvitation } from "../../utilisateurs/services/invitations";
import type { DonneesInvitationPremierResponsable } from "../validations/organisations";

// Qui fait l'action (un administrateur DTS) et depuis quelle adresse IP.
type Acteur = { utilisateurId: string; ip: string | undefined };

export type ResultatPremierResponsable =
  | ResultatInvitation
  | { etat: "organisation_introuvable" }
  // L'organisation a deja un Responsable actif : il invite lui-meme ses collegues.
  | { etat: "responsable_existant" };

// Invite le premier Responsable d'une organisation : role Responsable, sans site.
// On reutilise creerInvitation du jour 18 (e-mail, lien de 7 jours, usage unique).
// Si l'e-mail ne part pas, l'invitation existe quand meme (email_envoye = false) :
// on peut rappeler cette route pour renvoyer, l'ancien lien est alors remplace.
export async function inviterPremierResponsable(
  acteur: Acteur,
  organisationId: string,
  donnees: DonneesInvitationPremierResponsable,
): Promise<ResultatPremierResponsable> {
  const organisation = await prisma.organisation.findFirst({
    where: { id: organisationId, supprime_le: null },
    select: { id: true },
  });
  if (!organisation) {
    return { etat: "organisation_introuvable" };
  }

  const responsablesActifs = await prisma.utilisateur.count({
    where: {
      organisation_id: organisationId,
      role: "RESPONSABLE",
      actif: true,
      supprime_le: null,
    },
  });
  if (responsablesActifs > 0) {
    return { etat: "responsable_existant" };
  }

  const resultat = await creerInvitation(organisationId, acteur.utilisateurId, {
    email: donnees.email,
    role: "RESPONSABLE",
    site_ids: [],
  });

  if (resultat.etat === "ok") {
    await enregistrerAudit({
      action: "PREMIER_RESPONSABLE_INVITE",
      utilisateurId: acteur.utilisateurId,
      organisationId,
      ip: acteur.ip,
      details: { email: donnees.email, email_envoye: resultat.email_envoye },
    });
  }

  return resultat;
}