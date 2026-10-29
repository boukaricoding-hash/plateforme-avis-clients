import type { QuestionPublique, ValeurReponse } from '../../types/avis-public'

// Proprietes communes aux 8 types de questions.
export type ProprietesQuestion = {
  question: QuestionPublique
  // Reponse deja donnee (undefined = pas encore de reponse).
  valeur: ValeurReponse | undefined
  // Appelee quand le client choisit ou modifie sa reponse.
  changer: (valeur: ValeurReponse) => void
}