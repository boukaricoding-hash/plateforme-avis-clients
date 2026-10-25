import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../../configuration/base-de-donnees";

export const NOM_COOKIE_SESSION = "jeton_session";

const INACTIVITE_MINUTES = 30;
const DUREE_SE_SOUVENIR_JOURS = 7;

const MS_MINUTE = 60 * 1000;
const MS_JOUR = 24 * 60 * MS_MINUTE;

// On ne garde jamais le jeton lui-meme en base, seulement son empreinte.
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function dureeSessionMs(seSouvenir: boolean): number {
  return seSouvenir ? DUREE_SE_SOUVENIR_JOURS * MS_JOUR : INACTIVITE_MINUTES * MS_MINUTE;
}

export async function creerSession(params: {
  utilisateurId: string;
  seSouvenir: boolean;
  userAgent: string | undefined;
}): Promise<{ jeton: string; expireLe: Date }> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + dureeSessionMs(params.seSouvenir));

  await prisma.session.create({
    data: {
      utilisateur_id: params.utilisateurId,
      token_hash: empreinteJeton(jeton),
      se_souvenir: params.seSouvenir,
      expire_le: expireLe,
      user_agent: params.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { jeton, expireLe };
}
export async function trouverSessionActive(jeton: string) {
  return prisma.session.findFirst({
    where: { token_hash: empreinteJeton(jeton), expire_le: { gt: new Date() } },
  });
}

export async function supprimerSession(jeton: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token_hash: empreinteJeton(jeton) } });
}