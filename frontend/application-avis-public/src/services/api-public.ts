import { CODES_ERREUR_QR } from '../types/avis-public'
import type {
  CodeErreurQr,
  CorpsAvis,
  ErreurApi,
  QuestionnairePublic,
  ReponseCreationAvis,
} from '../types/avis-public'

const BASE = '/api/v1/public/q'

// Erreur unique pour tous les appels : statut 0 = pas de reseau.
export class ErreurService extends Error {
  statut: number
  code: string
  details: ErreurApi['details']

  constructor(
    statut: number,
    code: string,
    message: string,
    details: ErreurApi['details'],
  ) {
    super(message)
    this.name = 'ErreurService'
    this.statut = statut
    this.code = code
    this.details = details
  }
}

// Vrai si le code d'erreur doit afficher une page d'erreur QR (E5).
export function estErreurQr(code: string): code is CodeErreurQr {
  return (CODES_ERREUR_QR as readonly string[]).includes(code)
}

async function appeler<T>(url: string, options?: RequestInit): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      credentials: 'same-origin',
    })
  } catch {
    throw new ErreurService(0, 'HORS_CONNEXION', 'Connexion impossible.', null)
  }

  let corps: unknown = null
  try {
    corps = await reponse.json()
  } catch {
    // Reponse sans corps JSON : on garde null.
  }

  if (!reponse.ok) {
    const erreur = corps as Partial<ErreurApi> | null
    throw new ErreurService(
      reponse.status,
      erreur?.code ?? 'ERREUR_INCONNUE',
      erreur?.message ?? 'Une erreur est survenue.',
      erreur?.details ?? null,
    )
  }

  return corps as T
}

// GET /api/v1/public/q/{code} : le questionnaire (enregistre aussi un scan).
export function lireQuestionnaire(code: string): Promise<QuestionnairePublic> {
  return appeler<QuestionnairePublic>(`${BASE}/${encodeURIComponent(code)}`)
}

// POST /api/v1/public/q/{code}/avis : l'envoi d'un avis.
export function envoyerAvis(
  code: string,
  corps: CorpsAvis,
): Promise<ReponseCreationAvis> {
  return appeler<ReponseCreationAvis>(`${BASE}/${encodeURIComponent(code)}/avis`, {
    method: 'POST',
    body: JSON.stringify(corps),
  })
}