import type { NextFunction, Request, Response } from "express";
import { prisma } from "../configuration/base-de-donnees";
import { schemaIdOrganisation } from "../modules/administration/validations/organisations";
import { enregistrerAudit } from "../modules/journal-audit/services/journal";
import { trouverAccordActif } from "../modules/organisations/services/acces-support";
import { repondreDonneesInvalides, repondreNonTrouve } from "../utilitaires/reponses";

// Ajoute req.accesSupport a Express : l'organisation consultee et l'accord qui l'autorise.
// L'organisation vient de l'adresse (/admin/support/organisations/:id/...) mais n'est lue
// qu'apres la verification de l'accord, a CHAQUE requete.
declare global {
  namespace Express {
    interface Request {
      accesSupport?: { organisationId: string; accordId: string };
    }
  }
}

// Consultation de support (jour 24) : a placer apres exigerConnexion et exigerRole("ADMINISTRATEUR").
// Verifie a chaque requete que l'organisation existe et qu'elle a donne un accord non expire et non retire.
// Sans accord : 403, rien n'est lu. Avec accord : la consultation est ecrite dans le journal
// (auteur DTS, organisation, partie consultee), puis la requete continue.
// "partie" dit ce qui est consulte (par exemple "indicateurs", "avis", "sites") : elle va dans le journal.
export function exigerAccesSupport(partie: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const utilisateur = req.utilisateur;
    if (!utilisateur) {
      res.status(401).json({ code: "NON_CONNECTE", message: "Vous n'êtes pas connecté.", details: null });
      return;
    }

    const identifiant = schemaIdOrganisation.safeParse(req.params);
    if (!identifiant.success) {
      repondreDonneesInvalides(res, identifiant.error);
      return;
    }
    const organisationId = identifiant.data.id;

    const organisation = await prisma.organisation.findFirst({
      where: { id: organisationId, supprime_le: null },
      select: { id: true },
    });
    if (organisation === null) {
      repondreNonTrouve(res, "Organisation introuvable.");
      return;
    }

    const accord = await trouverAccordActif(organisationId);
    if (accord === null) {
      res.status(403).json({
        code: "ACCES_SUPPORT_NON_ACCORDE",
        message: "Cette organisation n'a pas donné son accord.",
        details: null,
      });
      return;
    }

    await enregistrerAudit({
      action: "SUPPORT_CONSULTATION",
      utilisateurId: utilisateur.id,
      organisationId,
      ip: req.ip,
      entite: "organisation",
      entiteId: organisationId,
      details: { partie, accord_id: accord.id },
    });

    req.accesSupport = { organisationId, accordId: accord.id };
    next();
  };
}