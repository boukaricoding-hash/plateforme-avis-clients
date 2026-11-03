import { prisma } from "../../../configuration/base-de-donnees";
import { declencherAlerteSiNecessaire } from "../../alertes/services/alertes";
import { envoyerEmailsAlerteImmediate } from "../../alertes/services/email-alerte";
import { recalculerAgregat } from "../../agregats/services/calcul-agregats";

// Travaux a lancer juste apres l'enregistrement d'un avis.
// Chaque travail est protege : une panne ici ne doit JAMAIS faire perdre
// l'avis du client, qui est deja enregistre. L'erreur reste dans le terminal.
export async function apresCreationAvis(avisId: string): Promise<void> {
  // Jour 6 : alerte et notifications si l'avis est negatif.
  try {
    const alerte = await declencherAlerteSiNecessaire(avisId);

    // Jour 16 : e-mail d'alerte immediate. On n'attend pas le serveur de messagerie :
    // le client qui envoie son avis ne doit jamais attendre un e-mail.
    if (alerte.alerte_creee) {
      void envoyerEmailsAlerteImmediate(avisId).catch((erreur: unknown) => {
        console.error("E-mail d'alerte non envoye pour l'avis " + avisId + " :", erreur);
      });
    }
  } catch (erreur) {
    console.error("Alerte non creee pour l'avis " + avisId + " :", erreur);
  }

  // Jour 7 : mise a jour de l'agregat du jour de l'avis (point de contact + date).
  try {
    const avis = await prisma.avis.findUnique({
      where: { id: avisId },
      select: { point_contact_id: true, soumis_le: true },
    });
    if (avis) {
      await recalculerAgregat(avis.point_contact_id, avis.soumis_le);
    }
  } catch (erreur) {
    console.error("Agregat non mis a jour pour l'avis " + avisId + " :", erreur);
  }
}