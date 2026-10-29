// Service worker de la page d'avis : il garde la page en memoire du telephone.
//
// Regles :
// - /api/... : jamais touche. Les scans, l'anti-doublon et les envois d'avis
//   passent toujours directement par le reseau, jamais par une copie.
// - La page (navigation) : le reseau d'abord, la copie gardee seulement si le reseau manque.
// - Les fichiers du site (/assets/..., icones) : la copie gardee d'abord, c'est plus rapide.
//
// Quand une icone ou le manifest change, change aussi NOM_CACHE (avis-v2, avis-v3...)
// pour que les telephones prennent la nouvelle version.

const NOM_CACHE = 'avis-v1'

// Gardes des l'installation. '/' est la page de l'application (la meme pour tous les QR codes).
const FICHIERS_DE_BASE = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(NOM_CACHE)
      .then((cache) => cache.addAll(FICHIERS_DE_BASE))
      .then(() => self.skipWaiting()),
  )
})

// A l'activation : on supprime les anciennes copies, puis on prend la main sur les pages ouvertes.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => nom !== NOM_CACHE).map((nom) => caches.delete(nom))),
      )
      .then(() => self.clients.claim()),
  )
})

// La page : le reseau d'abord, la copie gardee si le reseau ou le serveur est en panne.
async function pageReseauDAbord(requete) {
  const cache = await caches.open(NOM_CACHE)
  try {
    const reponse = await fetch(requete)
    if (reponse.ok) {
      await cache.put('/', reponse.clone())
      return reponse
    }
    if (reponse.status >= 500) {
      const copie = await cache.match('/')
      if (copie) {
        return copie
      }
    }
    return reponse
  } catch {
    const copie = await cache.match('/')
    return copie ?? Response.error()
  }
}

// Les fichiers du site : la copie gardee d'abord, sinon le reseau (et on la garde).
async function fichierCopieDAbord(requete) {
  const cache = await caches.open(NOM_CACHE)
  const copie = await cache.match(requete)
  if (copie) {
    return copie
  }
  const reponse = await fetch(requete)
  if (reponse.ok) {
    await cache.put(requete, reponse.clone())
  }
  return reponse
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  if (requete.method !== 'GET') {
    return
  }

  const url = new URL(requete.url)
  // Autres sites, API et le service worker lui-meme : on ne touche a rien.
  if (url.origin !== self.location.origin) {
    return
  }
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') {
    return
  }

  if (requete.mode === 'navigate') {
    evenement.respondWith(pageReseauDAbord(requete))
    return
  }

  // Seuls les fichiers du site sont gardes : le logo d'une organisation, par exemple,
  // passe toujours par le reseau (il peut changer sans changer de nom).
  if (url.pathname.startsWith('/assets/') || FICHIERS_DE_BASE.includes(url.pathname)) {
    evenement.respondWith(fichierCopieDAbord(requete))
  }
})