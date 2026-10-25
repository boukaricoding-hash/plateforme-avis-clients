import { prisma } from "../configuration/base-de-donnees";
import type { UtilisateurConnecte } from "../middleware/exiger-connexion";

// Renvoie null si l'utilisateur voit toute son organisation (Responsable),
// ou la liste des sites autorises s'il est limite a certains sites (Gestionnaire).
export async function sitesAutorises(utilisateur: UtilisateurConnecte): Promise<string[] | null> {
  if (utilisateur.role !== "GESTIONNAIRE") {
    return null;
  }
  if (!utilisateur.organisation_id) {
    return [];
  }

  const liens = await prisma.utilisateurSite.findMany({
    where: {
      utilisateur_id: utilisateur.id,
      site: { organisation_id: utilisateur.organisation_id, supprime_le: null },
    },
    select: { site_id: true },
  });
  return liens.map((lien) => lien.site_id);
}

// Vrai si le site est dans le perimetre (null = tout est autorise).
export function siteDansPerimetre(sites: string[] | null, siteId: string): boolean {
  return sites === null || sites.includes(siteId);
}