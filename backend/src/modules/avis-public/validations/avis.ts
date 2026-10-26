import { z } from 'zod';

// Valeur brute envoyee par le telephone pour une question.
// Le sens exact (etoiles, NPS, oui/non, choix...) est controle plus tard
// dans le service, a partir du type de la question lue en base.
const valeurReponse = z.union([
  z.number({ error: 'La valeur doit etre un nombre.' }),
  z.boolean({ error: 'La valeur doit etre vrai ou faux.' }),
  z.string({ error: 'La valeur doit etre un texte.' }).max(2000, {
    error: 'Le texte est trop long (2000 caracteres maximum).',
  }),
  z
    .array(z.string().max(200, { error: 'Une option est trop longue.' }))
    .max(50, { error: 'Trop d options choisies.' }),
]);

const reponseEnvoyee = z.object({
  question_id: z.uuid({ error: 'Identifiant de question invalide.' }),
  valeur: valeurReponse,
});

export const schemaCorpsAvis = z.object({
  version_id: z.uuid({ error: 'Identifiant de version invalide.' }),
  langue: z.enum(['fr', 'en'], { error: 'La langue doit etre fr ou en.' }),
  reponses: z
    .array(reponseEnvoyee, { error: 'La liste des reponses est invalide.' })
    .max(50, { error: 'Trop de reponses envoyees.' }),
  commentaire: z
    .string({ error: 'Le commentaire doit etre un texte.' })
    .trim()
    .max(2000, { error: 'Le commentaire est trop long (2000 caracteres maximum).' })
    .optional(),
});

export type CorpsAvis = z.infer<typeof schemaCorpsAvis>;