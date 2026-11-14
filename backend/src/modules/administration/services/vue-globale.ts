import { prisma } from "../../../configuration/base-de-donnees";

// ------------------------------------------------------------
// Vue globale de la plateforme : GET /admin/vue-globale (jour 24, ecran E19)
// ------------------------------------------------------------
// Les chiffres de toute la plateforme, pour l'administrateur DTS :
//   - organisations par statut (essai, actif, suspendu)
//   - utilisateurs actifs par role
//   - avis par jour sur les 30 derniers jours (somme des agregats quotidiens)
//   - erreurs recentes : les actions d'echec du journal des 7 derniers jours
// Il n'existe pas de table d'erreurs du serveur (Sentry est prevu au jour 28).
// Les jours sont lus en UTC (le fuseau Africa/Lome est a UTC+0, sans heure d'ete).

const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;
const JOURS_COURBE = 30;
const JOURS_ERREURS = 7;
const NB_ERREURS_MAX = 20;

// Actions du journal qui comptent comme des erreurs recentes.
export const ACTIONS_ERREUR = [
  "CONNEXION_ECHEC",
  "COMPTE_VERROUILLE",
  "INVITATION_EMAIL_ECHEC",
  "REINITIALISATION_EMAIL_ECHEC",
] as const;

const STATUTS = ["ESSAI", "ACTIF", "SUSPENDU"] as const;
const ROLES = ["RESPONSABLE", "GESTIONNAIRE", "ADMINISTRATEUR"] as const;

function jourTexte(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Minuit UTC du jour de la date donnee.
function debutDeJour(date: Date): Date {
  return new Date(`${jourTexte(date)}T00:00:00.000Z`);
}

export async function lireVueGlobale(maintenant: Date = new Date()) {
  const aujourdhui = debutDeJour(maintenant);
  const debutCourbe = new Date(aujourdhui.getTime() - (JOURS_COURBE - 1) * UN_JOUR_EN_MS);
  const debutErreurs = new Date(maintenant.getTime() - JOURS_ERREURS * UN_JOUR_EN_MS);

  const [organisations, utilisateurs, agregats, erreurs] = await Promise.all([
    prisma.organisation.groupBy({
      by: ["statut"],
      where: { supprime_le: null },
      _count: { _all: true },
    }),
    prisma.utilisateur.groupBy({
      by: ["role"],
      where: { supprime_le: null, actif: true },
      _count: { _all: true },
    }),
    prisma.agregatQuotidien.groupBy({
      by: ["date"],
      where: { date: { gte: debutCourbe, lte: aujourdhui } },
      _sum: { nb_avis: true },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: [...ACTIONS_ERREUR] }, cree_le: { gte: debutErreurs } },
      select: {
        id: true,
        action: true,
        cree_le: true,
        utilisateur: { select: { email: true } },
        organisation: { select: { id: true, nom: true } },
      },
      orderBy: [{ cree_le: "desc" }, { id: "desc" }],
      take: NB_ERREURS_MAX,
    }),
  ]);

  // Tous les statuts et tous les roles sont presents, meme a 0.
  const parStatut = Object.fromEntries(STATUTS.map((statut) => [statut, 0])) as Record<(typeof STATUTS)[number], number>;
  for (const ligne of organisations) {
    parStatut[ligne.statut] = ligne._count._all;
  }

  const parRole = Object.fromEntries(ROLES.map((role) => [role, 0])) as Record<(typeof ROLES)[number], number>;
  for (const ligne of utilisateurs) {
    parRole[ligne.role] = ligne._count._all;
  }

  // Un point par jour, y compris les jours sans avis (0) : la courbe n'a pas de trou.
  const avisParJour = new Map<string, number>();
  for (const ligne of agregats) {
    avisParJour.set(jourTexte(ligne.date), ligne._sum.nb_avis ?? 0);
  }
  const courbe: { date: string; nb_avis: number }[] = [];
  for (let i = 0; i < JOURS_COURBE; i++) {
    const cle = jourTexte(new Date(debutCourbe.getTime() + i * UN_JOUR_EN_MS));
    courbe.push({ date: cle, nb_avis: avisParJour.get(cle) ?? 0 });
  }

  return {
    organisations: {
      total: STATUTS.reduce((somme, statut) => somme + parStatut[statut], 0),
      par_statut: parStatut,
    },
    utilisateurs: {
      total: ROLES.reduce((somme, role) => somme + parRole[role], 0),
      par_role: parRole,
    },
    avis_par_jour: {
      jours: JOURS_COURBE,
      total: courbe.reduce((somme, point) => somme + point.nb_avis, 0),
      points: courbe,
    },
    erreurs_recentes: {
      jours: JOURS_ERREURS,
      entrees: erreurs.map((ligne) => ({
        id: ligne.id,
        action: ligne.action,
        cree_le: ligne.cree_le,
        utilisateur_email: ligne.utilisateur?.email ?? null,
        organisation: ligne.organisation,
      })),
    },
  };
}