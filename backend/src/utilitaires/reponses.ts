import type { Response } from "express";
import type { ZodError } from "zod";

export function repondreDonneesInvalides(res: Response, erreur: ZodError): void {
  res.status(400).json({
    code: "DONNEES_INVALIDES",
    message: "Les donnees envoyees sont invalides.",
    details: erreur.issues.map((probleme) => ({
      champ: probleme.path.join("."),
      message: probleme.message,
    })),
  });
}

export function repondreNonTrouve(res: Response, message: string): void {
  res.status(404).json({
    code: "NON_TROUVE",
    message,
    details: null,
  });
}