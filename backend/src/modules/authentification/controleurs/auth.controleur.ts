import type { CookieOptions, Request, Response } from "express";
import { prisma } from "../../../configuration/base-de-donnees";
import { schemaConnexion } from "../validations/connexion";
import { hacherMotDePasse, verifierMotDePasse } from "../services/mots-de-passe";
import { NOM_COOKIE_SESSION, creerSession, dureeSessionMs } from "../services/sessions";

const MESSAGE_IDENTIFIANTS_INVALIDES = "E-mail ou mot de passe incorrect.";

// Sert a faire le meme travail (et donc prendre le meme temps) quand l'adresse
// n'existe pas : on ne doit pas pouvoir deviner quelles adresses existent.
const hashFactice = hacherMotDePasse("mot-de-passe-factice-sans-valeur");

export async function connexion(req: Request, res: Response): Promise<void> {
  const lecture = schemaConnexion.safeParse(req.body);
  if (!lecture.success) {
    res.status(400).json({
      code: "DONNEES_INVALIDES",
      message: "Les donnees envoyees sont invalides.",
      details: lecture.error.issues.map((probleme) => ({
        champ: probleme.path.join("."),
        message: probleme.message,
      })),
    });
    return;
  }
  const { email, mot_de_passe, se_souvenir } = lecture.data;

  const utilisateur = await prisma.utilisateur.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, supprime_le: null },
  });

  const motDePasseValide = await verifierMotDePasse(
    mot_de_passe,
    utilisateur ? utilisateur.mot_de_passe_hash : await hashFactice,
  );

  if (!utilisateur || !utilisateur.actif || !motDePasseValide) {
    res.status(401).json({
      code: "IDENTIFIANTS_INVALIDES",
      message: MESSAGE_IDENTIFIANTS_INVALIDES,
      details: null,
    });
    return;
  }

  const session = await creerSession({
    utilisateurId: utilisateur.id,
    seSouvenir: se_souvenir,
    userAgent: req.get("user-agent"),
  });

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { derniere_connexion: new Date() },
  });

  const optionsCookie: CookieOptions = {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
  };
  // Sans "Se souvenir de moi" : cookie de session, supprime a la fermeture du navigateur.
  if (se_souvenir) {
    optionsCookie.maxAge = dureeSessionMs(true);
  }
  res.cookie(NOM_COOKIE_SESSION, session.jeton, optionsCookie);

  res.status(200).json({
    utilisateur: {
      id: utilisateur.id,
      email: utilisateur.email,
      nom: utilisateur.nom,
      role: utilisateur.role,
      organisation_id: utilisateur.organisation_id,
      langue: utilisateur.langue,
    },
  });
}