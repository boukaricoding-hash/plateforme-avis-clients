import { compare, hash } from "bcryptjs";

const COUT_HACHAGE = 12;
const LONGUEUR_MIN = 8;
// bcrypt ne lit que les 72 premiers caracteres : au-dela, on refuse
const LONGUEUR_MAX = 72;

// Mots de passe trop courants, refuses meme s'ils font 8 caracteres ou plus.
const MOTS_DE_PASSE_COURANTS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "password",
  "password1",
  "password123",
  "motdepasse",
  "motdepasse1",
  "azerty123",
  "azertyuiop",
  "azerty1234",
  "qwerty123",
  "qwertyuiop",
  "admin123",
  "administrateur",
  "bienvenue",
  "bonjour123",
  "azertyazerty",
  "iloveyou",
  "abcd1234",
  "abc12345",
]);

export type ResultatValidation = { valide: true } | { valide: false; message: string };

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return hash(motDePasse, COUT_HACHAGE);
}

export async function verifierMotDePasse(
  motDePasse: string,
  motDePasseHache: string,
): Promise<boolean> {
  return compare(motDePasse, motDePasseHache);
}

export function validerMotDePasse(motDePasse: string, email?: string): ResultatValidation {
  if (motDePasse.length < LONGUEUR_MIN) {
    return {
      valide: false,
      message: "Le mot de passe doit contenir au moins " + LONGUEUR_MIN + " caracteres.",
    };
  }
  if (motDePasse.length > LONGUEUR_MAX) {
    return {
      valide: false,
      message: "Le mot de passe ne doit pas depasser " + LONGUEUR_MAX + " caracteres.",
    };
  }
  if (MOTS_DE_PASSE_COURANTS.has(motDePasse.toLowerCase())) {
    return { valide: false, message: "Ce mot de passe est trop courant. Choisissez-en un autre." };
  }
  if (email !== undefined && motDePasse.toLowerCase() === email.trim().toLowerCase()) {
    return {
      valide: false,
      message: "Le mot de passe ne doit pas etre identique a l'adresse e-mail.",
    };
  }
  return { valide: true };
}