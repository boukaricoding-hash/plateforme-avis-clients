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

// Coordonnees facultatives : un champ laisse vide ("") est accepte.
const contactNom = z
  .string({ error: 'Le nom doit etre un texte.' })
  .trim()
  .max(100, { error: 'Le nom est trop long (100 caracteres maximum).' });

const contactTel = z.union(
  [
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^[+0-9 ()-]{6,30}$/, { error: 'Le numero de telephone est invalide.' }),
  ],
  { error: 'Le numero de telephone est invalide.' },
);

const contactEmail = z.union(
  [
    z.literal(''),
    z
      .string()
      .trim()
      .max(200, { error: "L'adresse e-mail est trop longue." })
      .pipe(z.email({ error: "L'adresse e-mail est invalide." })),
  ],
  { error: "L'adresse e-mail est invalide." },
);

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

  // Etape 3 : cle unique generee par le telephone.
  // Un renvoi avec la meme cle ne cree pas de doublon.
  cle_unique: z.uuid({ error: 'La cle unique est invalide.' }).optional(),

  // Etape 6 : coordonnees facultatives, enregistrees seulement si consentement = true.
  contact_nom: contactNom.optional(),
  contact_tel: contactTel.optional(),
  contact_email: contactEmail.optional(),
  consentement: z.boolean({ error: 'Le consentement doit etre vrai ou faux.' }).optional(),

  // Etape 5 : champ piege (honeypot). Cache pour les humains, rempli par les robots.
  site_web: z.string().max(500).optional(),
});

export type CorpsAvis = z.infer<typeof schemaCorpsAvis>;