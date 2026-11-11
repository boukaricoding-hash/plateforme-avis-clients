import type { CorpsErreurApi } from '../types/utilisateur'
import { ErreurService } from './api'

// Telechargement d'un fichier par fetch (ecran E11, QR codes et chevalets, puis exports du jour 21).
// Un simple lien <a download> ne dit jamais quand le fichier est arrive : ici la page sait
// quand le telechargement commence, finit ou echoue, et peut donc afficher un loader.
// Le cookie de session part avec la requete (meme adresse grace au proxy).
// Comme les autres services, un echec est une ErreurService (statut 0 = pas de reseau).
//
// Deux temps, qui peuvent se faire ensemble ou separement :
// - recupererFichier : le fichier arrive dans la page, rien n'est enregistre ;
// - enregistrerFichier : le fichier est enregistre sur l'appareil.
// telechargerFichier fait les deux d'un coup : les QR codes et les chevalets ne changent pas.
// Les exports les separent : le fichier est cree au clic sur l'indication 3, puis enregistre
// au clic sur l'indication 4 (un enregistrement lance par un clic est plus fiable qu'un
// enregistrement lance longtemps apres le clic, une fois la creation terminee).

// Duree minimale du chargement affiche : sans elle, un petit fichier arrive en quelques
// millisecondes et le loader clignote sans que l'utilisateur ne le voie.
const ATTENTE_MINIMALE_MS = 700

// Delai avant de liberer l'adresse temporaire du fichier : le navigateur a le temps de l'enregistrer.
const DELAI_LIBERATION_MS = 10_000

// Nom du fichier donne par le serveur (en-tete Content-Disposition), sinon null.
function nomDepuisEntete(entete: string | null): string | null {
  if (entete === null) {
    return null
  }
  const trouve = /filename="([^"]+)"/.exec(entete)
  return trouve === null ? null : trouve[1]
}

function attendre(duree: number): Promise<void> {
  return new Promise((resoudre) => {
    window.setTimeout(resoudre, duree)
  })
}

// Envoi POST facultatif (exports, jour 21) : l'adresse est alors appelee en POST avec ce corps JSON,
// au lieu d'un GET. Sans envoi, rien ne change pour les QR codes et les chevalets.
export type EnvoiPost = {
  corps: unknown
}

// Un fichier arrive dans la page, pas encore enregistre : son contenu et le nom a lui donner.
export type FichierRecupere = {
  contenu: Blob
  nom: string
}

// Recupere le fichier a cette adresse, sans l'enregistrer.
// nomParDefaut sert si le serveur ne donne pas de nom.
export async function recupererFichier(
  adresse: string,
  nomParDefaut: string,
  envoi?: EnvoiPost,
): Promise<FichierRecupere> {
  const debut = Date.now()

  let reponse: Response
  try {
    reponse = await fetch(
      adresse,
      envoi === undefined
        ? { credentials: 'same-origin' }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(envoi.corps),
            credentials: 'same-origin',
          },
    )
  } catch {
    throw new ErreurService(0, 'HORS_CONNEXION', 'Connexion impossible.', null)
  }

  if (!reponse.ok) {
    let corps: Partial<CorpsErreurApi> | null = null
    try {
      corps = (await reponse.json()) as Partial<CorpsErreurApi>
    } catch {
      // Reponse sans corps JSON : on garde null.
    }
    throw new ErreurService(
      reponse.status,
      corps?.code ?? 'ERREUR_INCONNUE',
      corps?.message ?? 'Une erreur est survenue.',
      corps?.details ?? null,
    )
  }

  let contenu: Blob
  try {
    contenu = await reponse.blob()
  } catch {
    // Connexion coupee en cours de route.
    throw new ErreurService(0, 'HORS_CONNEXION', 'Connexion impossible.', null)
  }

  const nom = nomDepuisEntete(reponse.headers.get('Content-Disposition')) ?? nomParDefaut

  const reste = ATTENTE_MINIMALE_MS - (Date.now() - debut)
  if (reste > 0) {
    await attendre(reste)
  }

  return { contenu, nom }
}

// Enregistre sur l'appareil un fichier deja recupere. Renvoie le nom du fichier enregistre.
export function enregistrerFichier(fichier: FichierRecupere): string {
  // Lien temporaire : cree, clique, retire.
  const adresseTemporaire = URL.createObjectURL(fichier.contenu)
  const lien = document.createElement('a')
  lien.href = adresseTemporaire
  lien.download = fichier.nom
  lien.style.display = 'none'
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(adresseTemporaire), DELAI_LIBERATION_MS)

  return fichier.nom
}

// Telecharge le fichier a cette adresse et l'enregistre sur l'appareil, en un seul temps.
// Renvoie le nom du fichier enregistre ; nomParDefaut sert si le serveur n'en donne pas.
export async function telechargerFichier(
  adresse: string,
  nomParDefaut: string,
  envoi?: EnvoiPost,
): Promise<string> {
  const fichier = await recupererFichier(adresse, nomParDefaut, envoi)
  return enregistrerFichier(fichier)
}