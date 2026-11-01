import { randomBytes } from "node:crypto";
import { prisma } from "../../../configuration/base-de-donnees";
import { empreinteJeton } from "./sessions";

export const DUREE_VALIDITE_JETON_MINUTES = 30;

const MS_MINUTE = 60 * 1000;

// Cree un jeton a usage unique. Le jeton en clair est renvoye (pour l'e-mail),
// mais seule son empreinte sha256 est gardee en base.
export async function creerJetonReinitialisation(utilisateurId: string): Promise<string> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_VALIDITE_JETON_MINUTES * MS_MINUTE);

  await prisma.jetonReinitialisationMdp.create({
    data: {
      utilisateur_id: utilisateurId,
      token_hash: empreinteJeton(jeton),
      expire_le: expireLe,
    },
  });

  return jeton;
}

export type JetonValide = {
  id: string;
  utilisateurId: string;
  email: string;
  organisationId: string | null;
};

// Renvoie null si le jeton est absent, inconnu, expire, deja utilise,
// ou si l'utilisateur est inactif ou supprime.
export async function trouverJetonValide(jeton: string): Promise<JetonValide | null> {
  if (jeton === "") {
    return null;
  }

  const ligne = await prisma.jetonReinitialisationMdp.findFirst({
    where: {
      token_hash: empreinteJeton(jeton),
      utilise_le: null,
      expire_le: { gt: new Date() },
    },
    include: {
      utilisateur: {
        select: { id: true, email: true, organisation_id: true, actif: true, supprime_le: true },
      },
    },
  });

  if (!ligne || !ligne.utilisateur.actif || ligne.utilisateur.supprime_le !== null) {
    return null;
  }

  return {
    id: ligne.id,
    utilisateurId: ligne.utilisateur.id,
    email: ligne.utilisateur.email,
    organisationId: ligne.utilisateur.organisation_id,
  };
}

// Consomme le jeton et change le mot de passe en une seule transaction.
// Renvoie false si le jeton a deja ete utilise entre-temps (usage unique).
export async function consommerJeton(params: {
  jetonId: string;
  utilisateurId: string;
  motDePasseHache: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const maintenant = new Date();

    // Une seule requete peut gagner : la condition utilise_le = null est verifiee en base.
    const marque = await tx.jetonReinitialisationMdp.updateMany({
      where: { id: params.jetonId, utilise_le: null },
      data: { utilise_le: maintenant },
    });
    if (marque.count === 0) {
      return false;
    }

    // Les autres jetons de cet utilisateur ne servent plus.
    await tx.jetonReinitialisationMdp.updateMany({
      where: { utilisateur_id: params.utilisateurId, utilise_le: null },
      data: { utilise_le: maintenant },
    });

    await tx.utilisateur.update({
      where: { id: params.utilisateurId },
      data: {
        mot_de_passe_hash: params.motDePasseHache,
        tentatives_echec: 0,
        verrouille_jusqua: null,
      },
    });

    // Toutes les sessions ouvertes sont fermees.
    await tx.session.deleteMany({ where: { utilisateur_id: params.utilisateurId } });

    return true;
  });
}