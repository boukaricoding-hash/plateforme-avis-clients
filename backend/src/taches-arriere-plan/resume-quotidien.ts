import { envoyerResumesAlertes } from "../modules/alertes/services/resume-alertes";

// ------------------------------------------------------------
// Resume quotidien des alertes (jour 16)
// ------------------------------------------------------------
// Chaque matin a 08h00 UTC (= 08h00 a Lome, il n'y a pas de changement d'heure),
// un e-mail de resume part a chaque utilisateur qui a choisi les alertes groupees.
// Si le serveur etait eteint a 08h00, les avis negatifs restent en attente
// et partent le lendemain : rien n'est perdu.
//
// Cette tache est lancee par serveur.ts, jamais par app.ts : elle ne demarre
// donc pas pendant les tests.

const HEURE_UTC_RESUME = 8;
const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;

// Evite que deux executions se chevauchent.
let enCours = false;

// Envoie les resumes. Une panne est ecrite dans le terminal et n'arrete jamais le serveur.
export async function executerResumeQuotidien(): Promise<void> {
  if (enCours) {
    console.log("Resume quotidien : une execution est deja en cours, celle-ci est ignoree.");
    return;
  }
  enCours = true;

  try {
    const nombre = await envoyerResumesAlertes();
    console.log("Resume quotidien : " + nombre + " e-mail(s) envoye(s).");
  } catch (erreur) {
    console.error("Resume quotidien : envoi impossible :", erreur);
  } finally {
    enCours = false;
  }
}

// Prochain passage de 08h00 UTC (demain si on l'a deja depasse aujourd'hui).
function prochaineExecution(maintenant: Date): Date {
  const cible = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate(),
      HEURE_UTC_RESUME,
      0,
      0,
    ),
  );
  if (cible.getTime() <= maintenant.getTime()) {
    return new Date(cible.getTime() + UN_JOUR_EN_MS);
  }
  return cible;
}

// Planifie le resume, chaque jour. Renvoie une fonction pour l'arreter.
export function demarrerResumeQuotidien(): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let arrete = false;

  const planifier = (): void => {
    const maintenant = new Date();
    const prochaine = prochaineExecution(maintenant);

    minuteur = setTimeout(() => {
      void executerResumeQuotidien().finally(() => {
        if (!arrete) {
          planifier();
        }
      });
    }, prochaine.getTime() - maintenant.getTime());

    // Le minuteur ne doit jamais empecher le serveur de s'arreter.
    minuteur.unref();

    console.log("Resume quotidien planifie pour " + prochaine.toISOString() + ".");
  };

  planifier();

  return () => {
    arrete = true;
    if (minuteur !== undefined) {
      clearTimeout(minuteur);
    }
  };
}