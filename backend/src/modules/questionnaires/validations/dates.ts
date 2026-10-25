import { z } from "zod";

const dateOuNull = z.iso
  .datetime({ offset: true, error: "Date invalide : utilisez le format 2026-12-01T08:00:00Z." })
  .nullable();

// PUT : on envoie toujours les deux dates ; null signifie "pas de date".
export const schemaDatesQuestionnaire = z
  .strictObject({
    date_debut: dateOuNull,
    date_fin: dateOuNull,
  })
  .refine(
    (dates) =>
      dates.date_debut === null ||
      dates.date_fin === null ||
      new Date(dates.date_debut).getTime() < new Date(dates.date_fin).getTime(),
    { message: "La date de fin doit etre apres la date de debut.", path: ["date_fin"] },
  );

export type DonneesDates = z.infer<typeof schemaDatesQuestionnaire>;