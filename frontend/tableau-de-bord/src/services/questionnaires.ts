import type { ReponseListeQuestionnaires, ResumeQuestionnaire } from '../types/questionnaires'
import { appeler } from './api'

// Appels des questionnaires cote tableau de bord (utilises par l'ecran E12 au jour 17,
// puis par les ecrans E10 des jours 19 et 20). Lecture : Responsable et Gestionnaire.
// Les composants n'appellent jamais fetch directement.

// GET /questionnaires : les questionnaires de MON organisation (les modeles sectoriels n'y sont pas).
export async function listerQuestionnaires(): Promise<ResumeQuestionnaire[]> {
  const reponse = await appeler<ReponseListeQuestionnaires>('/questionnaires')
  return reponse.questionnaires
}