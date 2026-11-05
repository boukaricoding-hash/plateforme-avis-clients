import type { CorpsErreurApi, Utilisateur } from '../types/utilisateur'

const BASE = '/api/v1'

// Erreur unique pour tous les appels : statut 0 = pas de reseau.
export class ErreurService extends Error {
  statut: number
  code: string
  details: CorpsErreurApi['details']

  constructor(
    statut: number,
    code: string,
    message: string,
    details: CorpsErreurApi['details'],
  ) {
    super(message)
    this.name = 'ErreurService'
    this.statut = statut
    this.code = code
    this.details = details
  }
}

// Appel generique : le cookie de session part avec chaque requete (meme adresse grace au proxy).
// Les ecrans des jours suivants reutilisent cette fonction.
export async function appeler<T>(chemin: string, options?: RequestInit): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      ...options,
      // Un fichier (FormData) part sans en-tete JSON : le navigateur ajoute lui-meme l'en-tete multipart.
      headers: options?.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options?.headers },
      credentials: 'same-origin',
    })
  } catch {
    throw new ErreurService(0, 'HORS_CONNEXION', 'Connexion impossible.', null)
  }

  let corps: unknown = null
  try {
    corps = await reponse.json()
  } catch {
    // Reponse sans corps JSON (par exemple 204) : on garde null.
  }

  if (!reponse.ok) {
    const erreur = corps as Partial<CorpsErreurApi> | null
    throw new ErreurService(
      reponse.status,
      erreur?.code ?? 'ERREUR_INCONNUE',
      erreur?.message ?? 'Une erreur est survenue.',
      erreur?.details ?? null,
    )
  }

  return corps as T
}

type ReponseUtilisateur = { utilisateur: Utilisateur }
type ReponseMessage = { message: string }

// POST /auth/login : pose le cookie de session.
export async function connecter(
  email: string,
  motDePasse: string,
  seSouvenir: boolean,
): Promise<Utilisateur> {
  const reponse = await appeler<ReponseUtilisateur>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, mot_de_passe: motDePasse, se_souvenir: seSouvenir }),
  })
  return reponse.utilisateur
}

// POST /auth/logout : supprime la session et le cookie.
export function deconnecter(): Promise<void> {
  return appeler<void>('/auth/logout', { method: 'POST' })
}

// GET /auth/me : l'utilisateur de la session en cours (401 si non connecte).
export async function lireMoi(): Promise<Utilisateur> {
  const reponse = await appeler<ReponseUtilisateur>('/auth/me')
  return reponse.utilisateur
}

// POST /auth/forgot-password : envoie un lien par e-mail.
// La reponse est la meme que l'adresse existe ou non.
export function demanderReinitialisation(email: string): Promise<ReponseMessage> {
  return appeler<ReponseMessage>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// POST /auth/reset-password : choisit un nouveau mot de passe avec le jeton du lien.
export function reinitialiserMotDePasse(
  jeton: string,
  motDePasse: string,
): Promise<ReponseMessage> {
  return appeler<ReponseMessage>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ jeton, mot_de_passe: motDePasse }),
  })
}