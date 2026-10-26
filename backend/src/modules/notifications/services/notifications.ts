import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../configuration/base-de-donnees";
import type { FiltresNotifications } from "../validations/notifications";

// Ce que l'API renvoie pour une notification (jamais organisation_id, utilisateur_id ni email_envoye_le).
const SELECTION_NOTIFICATION = {
  id: true,
  avis_id: true,
  type: true,
  titre: true,
  message: true,
  lue_le: true,
  cree_le: true,
} satisfies Prisma.NotificationSelect;

export type NotificationPubliee = Prisma.NotificationGetPayload<{ select: typeof SELECTION_NOTIFICATION }>;

// ------------------------------------------------------------
// Lister MES notifications
// ------------------------------------------------------------

// Une notification appartient a un seul utilisateur : on filtre toujours sur
// l'organisation ET sur l'utilisateur de la session.
export async function listerNotifications(
  organisationId: string,
  utilisateurId: string,
  filtres: FiltresNotifications,
) {
  const proprietaire = { organisation_id: organisationId, utilisateur_id: utilisateurId };

  const where: Prisma.NotificationWhereInput = {
    ...proprietaire,
    ...(filtres.non_lues === true ? { lue_le: null } : {}),
    ...(filtres.non_lues === false ? { lue_le: { not: null } } : {}),
  };

  const [lignes, total, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where,
      // L'identifiant departage les egalites : la pagination reste stable.
      orderBy: [{ cree_le: "desc" }, { id: "asc" }],
      skip: (filtres.page - 1) * filtres.limite,
      take: filtres.limite,
      select: SELECTION_NOTIFICATION,
    }),
    prisma.notification.count({ where }),
    // Le compteur de la cloche ne depend pas du filtre demande.
    prisma.notification.count({ where: { ...proprietaire, lue_le: null } }),
  ]);

  return {
    notifications: lignes,
    non_lues: nonLues,
    pagination: {
      page: filtres.page,
      limite: filtres.limite,
      total,
      pages: Math.ceil(total / filtres.limite),
    },
  };
}

// ------------------------------------------------------------
// Marquer UNE notification comme lue
// ------------------------------------------------------------

// Renvoie null si la notification n'existe pas ou n'appartient pas a l'utilisateur
// (autre utilisateur, autre organisation) : le controleur repond 404 dans tous les cas.
export async function marquerNotificationLue(
  organisationId: string,
  utilisateurId: string,
  notificationId: string,
): Promise<NotificationPubliee | null> {
  const existante = await prisma.notification.findFirst({
    where: { id: notificationId, organisation_id: organisationId, utilisateur_id: utilisateurId },
    select: SELECTION_NOTIFICATION,
  });
  if (existante === null) {
    return null;
  }

  // Deja lue : rien a faire, la date de premiere lecture est conservee.
  if (existante.lue_le !== null) {
    return existante;
  }

  // La condition "lue_le est vide" rend l'operation sure meme si deux appels arrivent ensemble.
  await prisma.notification.updateMany({
    where: { id: existante.id, lue_le: null },
    data: { lue_le: new Date() },
  });

  return prisma.notification.findUniqueOrThrow({
    where: { id: existante.id },
    select: SELECTION_NOTIFICATION,
  });
}