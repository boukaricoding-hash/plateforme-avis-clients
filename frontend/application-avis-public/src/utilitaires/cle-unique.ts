// Cle unique d'un envoi d'avis : un UUID genere par le telephone.
// Le backend l'utilise pour ne pas creer de doublon si l'envoi est repete
// (coupure du reseau, double clic, renvoi automatique).

// crypto.randomUUID() n'existe que sur une page en HTTPS (ou localhost).
// Pendant les tests, la page est en http://IP_DU_PC:5173 : on garde donc
// crypto.getRandomValues(), qui marche partout, pour fabriquer un UUID version 4.
export function creerCleUnique(): string {
  const octets = new Uint8Array(16)
  crypto.getRandomValues(octets)

  // Bits imposes par le format UUID version 4.
  octets[6] = (octets[6] & 0x0f) | 0x40
  octets[8] = (octets[8] & 0x3f) | 0x80

  const hex = Array.from(octets, (octet) => octet.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}