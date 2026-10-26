import { declencherAlerteSiNecessaire } from "../../alertes/services/alertes";

// Travaux a lancer juste apres l'enregistrement d'un avis.
// Chaque travail est protege : une panne ici ne doit JAMAIS faire perdre
// l'avis du client, qui est deja enregistre. L'erreur reste dans le terminal.
export async function apresCreationAvis(avisId: string): Promise<void> {
  // Jour 6 : alerte et notifications si l'avis est negatif.
  try {
    await declencherAlerteSiNecessaire(avisId);
  } catch (erreur) {
    console.error("Alerte non creee pour l'avis " + avisId + " :", erreur);
  }

  // Jour 7 : mise a jour des agregats quotidiens (un bloc try/catch a ajouter ici).
}