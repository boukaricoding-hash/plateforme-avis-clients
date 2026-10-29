import type { Langue, OptionQuestion } from '../types/avis-public'

// Valeur envoyee au backend pour une option.
// Meme regle que le backend : valeur, sinon code, sinon id, sinon fr.
// Une option qui est un simple texte est sa propre valeur.
export function valeurOption(option: OptionQuestion): string {
  if (typeof option === 'string') {
    return option
  }
  for (const valeur of [option.valeur, option.code, option.id, option.fr]) {
    if (typeof valeur === 'string') {
      return valeur
    }
  }
  return ''
}

// Texte affiche au client pour une option, selon la langue.
// Anglais demande mais absent ou vide : francais, puis la valeur envoyee.
export function libelleOption(option: OptionQuestion, langue: Langue): string {
  if (typeof option === 'string') {
    return option
  }
  if (langue === 'en' && option.en !== undefined && option.en.trim() !== '') {
    return option.en
  }
  if (option.fr !== undefined && option.fr.trim() !== '') {
    return option.fr
  }
  return valeurOption(option)
}