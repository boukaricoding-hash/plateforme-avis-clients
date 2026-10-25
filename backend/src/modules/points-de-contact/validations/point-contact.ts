import { z } from "zod";

export const schemaIdPointContact = z.object({
  id: z.uuid("Identifiant de point de contact invalide."),
});

// Filtre facultatif de la liste : ?site_id=...
export const schemaFiltrePointsContact = z.object({
  site_id: z.uuid("Identifiant de site invalide.").optional(),
});

const nom = z.string().trim().min(1, "Le nom est obligatoire.").max(120);
const type = z.string().trim().min(1).max(30);

export const schemaCreationPointContact = z.strictObject({
  site_id: z.uuid("Identifiant de site invalide."),
  nom,
  type: type.default("table"),
  zone: z.string().trim().max(60).optional(),
});

// Cree "Table 1", "Table 2", ... jusqu'a "Table 40" en une seule fois.
export const schemaCreationMasse = z
  .strictObject({
    site_id: z.uuid("Identifiant de site invalide."),
    prefixe: z.string().trim().min(1).max(60).default("Table"),
    type: type.default("table"),
    debut: z.number().int().min(1).default(1),
    fin: z.number().int().min(1),
  })
  .refine((donnees) => donnees.fin >= donnees.debut, {
    message: "Le numero de fin doit etre superieur ou egal au numero de debut.",
    path: ["fin"],
  })
  .refine((donnees) => donnees.fin - donnees.debut + 1 <= 500, {
    message: "Vous pouvez creer au maximum 500 points de contact a la fois.",
    path: ["fin"],
  });

export const schemaModificationPointContact = z
  .strictObject({
    nom: nom.optional(),
    type: type.optional(),
    zone: z.string().trim().max(60).nullable().optional(),
  })
  .refine((donnees) => Object.keys(donnees).length > 0, {
    message: "Aucune modification envoyee.",
  });

export type DonneesCreationPointContact = z.infer<typeof schemaCreationPointContact>;
export type DonneesCreationMasse = z.infer<typeof schemaCreationMasse>;
export type DonneesModificationPointContact = z.infer<typeof schemaModificationPointContact>;