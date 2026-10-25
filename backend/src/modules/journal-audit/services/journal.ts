import { prisma } from "../../../configuration/base-de-donnees";

type DetailsAudit = Record<string, string | number | boolean | null>;

// Ecrit une ligne dans le journal. Si l'ecriture echoue, on garde l'erreur
// dans le terminal du serveur mais on ne bloque jamais l'action de l'utilisateur.
export async function enregistrerAudit(params: {
  action: string;
  utilisateurId?: string | null;
  organisationId?: string | null;
  ip?: string | undefined;
  details?: DetailsAudit;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        utilisateur_id: params.utilisateurId ?? null,
        organisation_id: params.organisationId ?? null,
        ip: params.ip ?? null,
        ...(params.details ? { details: params.details } : {}),
      },
    });
  } catch (erreur) {
    console.error("Journal d'audit : ecriture impossible", erreur);
  }
}