import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import type { DonneesModificationParametres } from "../validations/parametres";

// Les champs renvoyes au navigateur (pas d'organisation_id, pas de statut ni de dates).
export const CHAMPS_PARAMETRES = {
  nom: true,
  logo_url: true,
  couleur_principale: true,
  seuil_alerte_note: true,
  seuil_alerte_nps: true,
} as const;

// Renvoie null si l'organisation n'existe pas ou a ete supprimee.
// L'organisation vient toujours de la session, jamais de la requete.
export async function lireParametres(organisationId: string) {
  return prisma.organisation.findFirst({
    where: { id: organisationId, supprime_le: null },
    select: CHAMPS_PARAMETRES,
  });
}

// Modifie seulement les champs envoyes. Renvoie null si l'organisation n'existe pas.
// Chaque modification est ecrite dans le journal d'audit (qui, quoi, quand).
export async function modifierParametres(params: {
  organisationId: string;
  utilisateurId: string;
  ip: string | undefined;
  donnees: DonneesModificationParametres;
}) {
  const existante = await lireParametres(params.organisationId);
  if (!existante) {
    return null;
  }

  const donnees = params.donnees;
  const modifications = {
    ...(donnees.couleur_principale !== undefined ? { couleur_principale: donnees.couleur_principale } : {}),
    ...(donnees.seuil_alerte_note !== undefined ? { seuil_alerte_note: donnees.seuil_alerte_note } : {}),
    ...(donnees.seuil_alerte_nps !== undefined ? { seuil_alerte_nps: donnees.seuil_alerte_nps } : {}),
  };

  const parametres = await prisma.organisation.update({
    where: { id: params.organisationId },
    data: modifications,
    select: CHAMPS_PARAMETRES,
  });

  await enregistrerAudit({
    action: "PARAMETRES_ORGANISATION_MODIFIES",
    utilisateurId: params.utilisateurId,
    organisationId: params.organisationId,
    ip: params.ip,
    details: modifications,
  });

  return parametres;
}