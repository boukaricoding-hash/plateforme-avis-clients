import { z } from "zod";

export const TYPES_QUESTION = [
  "ETOILES",
  "EMOJIS",
  "NPS",
  "CHOIX_UNIQUE",
  "CHOIX_MULTIPLE",
  "OUI_NON",
  "ECHELLE",
  "TEXTE_LIBRE",
] as const;

export type TypeQuestion = (typeof TYPES_QUESTION)[number];

export function estQuestionAChoix(type: TypeQuestion): boolean {
  return type === "CHOIX_UNIQUE" || type === "CHOIX_MULTIPLE";
}

export const schemaIdQuestionnaire = z.object({
  id: z.uuid("Identifiant de questionnaire invalide."),
});

// Un texte en francais (obligatoire) et en anglais (facultatif).
const texteMultilingue = z.strictObject({
  fr: z.string().trim().min(1, "Le texte en francais est obligatoire.").max(500),
  en: z.string().trim().max(500).optional(),
});

const schemaQuestion = z
  .strictObject({
    type: z.enum(TYPES_QUESTION),
    libelle: texteMultilingue,
    aide: texteMultilingue.optional(),
    obligatoire: z.boolean().default(true),
    theme_id: z.uuid("Identifiant de theme invalide.").nullable().optional(),
    options: z.array(texteMultilingue).max(20).optional(),
    echelle_min: z.number().int().optional(),
    echelle_max: z.number().int().optional(),
    libelles_extremites: z
      .strictObject({ min: texteMultilingue, max: texteMultilingue })
      .optional(),
  })
  .refine(
    (question) =>
      !estQuestionAChoix(question.type) ||
      (question.options !== undefined && question.options.length >= 2),
    { message: "Une question a choix doit avoir au moins 2 options.", path: ["options"] },
  )
  .refine((question) => question.options === undefined || estQuestionAChoix(question.type), {
    message: "Seules les questions a choix ont des options.",
    path: ["options"],
  })
  .refine(
    (question) =>
      question.type !== "ECHELLE" ||
      (question.echelle_min !== undefined &&
        question.echelle_max !== undefined &&
        question.echelle_min < question.echelle_max),
    {
      message: "Une echelle doit avoir un minimum inferieur au maximum.",
      path: ["echelle_max"],
    },
  );

// Utilise pour creer un questionnaire et pour le modifier (PUT : on renvoie tout le contenu).
export const schemaQuestionnaire = z.strictObject({
  titre: texteMultilingue,
  message_accueil: texteMultilingue.optional(),
  message_remerciement: texteMultilingue.optional(),
  langue_defaut: z.enum(["fr", "en"]).default("fr"),
  questions: z
    .array(schemaQuestion)
    .min(1, "Un questionnaire doit avoir au moins une question.")
    .max(50, "Un questionnaire ne peut pas depasser 50 questions."),
});

export type DonneesQuestion = z.infer<typeof schemaQuestion>;
export type DonneesQuestionnaire = z.infer<typeof schemaQuestionnaire>;