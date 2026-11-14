import { prisma } from "../../../configuration/base-de-donnees";
import { enregistrerAudit } from "../../journal-audit/services/journal";
import { DUREES_ACCES_SUPPORT, type DureeAccesSupport } from "../validations/acces-support";

// ------------------------------------------------------------
// Accord de support (jour 24)
// ------------------------------------------------------------
// Le Responsable autorise l'equipe DTS a lire les donnees de son organisation, pour une duree limitee.
// Un accord est "actif" s'il n'est ni retire (revoque_le vide) ni expire (expire_le dans le futur).
// Un seul accord actif a la fois par organisation : un nouvel accord remplace le precedent.
// L'organisation vient toujours de la session, jamais de la requete.

// Ce que l'API renvoie pour un accord (jamais organisation_id).
export const CHAMPS_ACCORD = {
  id: true,
  expire_le: true,
  cree_le: true,
  accorde_par: { select: { id: true, nom: true } },
} as const;

// Renvoie null s'il n'y a aucun accord actif. Sert aussi a la consultation de support
// (verifiee a chaque requete) : "maintenant" peut etre fourni pour les tests.
export async function trouverAccordActif(organisationId: string, maintenant: Date = new Date()) {
  return prisma.accesSupport.findFirst({
    where: { organisation_id: organisationId, revoque_le: null, expire_le: { gt: maintenant } },
    select: CHAMPS_ACCORD,
    orderBy: { cree_le: "desc" },
  });
}

// Donne l'accord pour la duree choisie. Les accords encore actifs sont retires dans la meme
// transaction : il n'en reste jamais deux. Chaque accord donne est ecrit dans le journal.
export async function accorderAcces(params: {
  organisationId: string;
  utilisateurId: string;
  ip: string | undefined;
  duree: DureeAccesSupport;
}) {
  const maintenant = new Date();
  const expireLe = new Date(maintenant.getTime() + DUREES_ACCES_SUPPORT[params.duree]);

  const { accord, remplaces } = await prisma.$transaction(async (tx) => {
    const retires = await tx.accesSupport.updateMany({
      where: { organisation_id: params.organisationId, revoque_le: null, expire_le: { gt: maintenant } },
      data: { revoque_le: maintenant },
    });
    const cree = await tx.accesSupport.create({
      data: {
        organisation_id: params.organisationId,
        accorde_par_id: params.utilisateurId,
        expire_le: expireLe,
      },
      select: CHAMPS_ACCORD,
    });
    return { accord: cree, remplaces: retires.count };
  });

  await enregistrerAudit({
    action: "SUPPORT_ACCES_ACCORDE",
    utilisateurId: params.utilisateurId,
    organisationId: params.organisationId,
    ip: params.ip,
    entite: "acces_support",
    entiteId: accord.id,
    details: { duree: params.duree, expire_le: expireLe.toISOString(), remplace_un_accord: remplaces > 0 },
  });

  return accord;
}

// Retire l'accord actif. Renvoie false s'il n'y en avait aucun (rien n'est ecrit dans le journal).
export async function retirerAcces(params: {
  organisationId: string;
  utilisateurId: string;
  ip: string | undefined;
}): Promise<boolean> {
  const actif = await trouverAccordActif(params.organisationId);
  if (actif === null) {
    return false;
  }

  const maintenant = new Date();
  await prisma.accesSupport.updateMany({
    where: { organisation_id: params.organisationId, revoque_le: null, expire_le: { gt: maintenant } },
    data: { revoque_le: maintenant },
  });

  await enregistrerAudit({
    action: "SUPPORT_ACCES_RETIRE",
    utilisateurId: params.utilisateurId,
    organisationId: params.organisationId,
    ip: params.ip,
    entite: "acces_support",
    entiteId: actif.id,
  });

  return true;
}