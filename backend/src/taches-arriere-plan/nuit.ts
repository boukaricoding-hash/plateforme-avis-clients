import {
  debutDuJourUtc,
  recalculerAgregatsDuJour,
} from "../modules/agregats/services/calcul-agregats";
import { purgerEmpreintesAnciennes } from "../modules/avis-public/services/anti-doublon";

// ------------------------------------------------------------
// Taches de nuit (jour 7)
// ------------------------------------------------------------
// Chaque nuit a 02h00 UTC (= heure de Lome) :
// 1. recalcul des agregats d'hier (prend en compte les scans, qui ne mettent
//    pas l'agregat a jour au moment du scan) ;
// 2. recalcul des agregats d'aujourd'hui (rattrape un eventuel retard) ;
// 3. effacement des empreintes anti-doublon de plus de 7 jours.
//
// Cette tache est lancee par serveur.ts, jamais par app.ts : elle ne demarre
// donc pas pendant les tests.

const HEURE_UTC_TACHES = 2;
const UN_JOUR_EN_MS = 24 * 60 * 60 * 1000;

// Evite que deux executions se chevauchent.
let enCours = false;

// Lance les trois travaux. Chacun est protege : une panne n'arrete pas les autres.
export async function executerTachesDeNuit(maintenant: Date = new Date()): Promise<void> {
  if (enCours) {
    console.log("Taches de nuit : une execution est deja en cours, celle-ci est ignoree.");
    return;
  }
  enCours = true;

  try {
    const aujourdhui = debutDuJourUtc(maintenant);
    const hier = new Date(aujourdhui.getTime() - UN_JOUR_EN_MS);

    try {
      const nombre = await recalculerAgregatsDuJour(hier);
      console.log("Taches de nuit : agregats d'hier recalcules (" + nombre + " points de contact).");
    } catch (erreur) {
      console.error("Taches de nuit : agregats d'hier non recalcules :", erreur);
    }

    try {
      const nombre = await recalculerAgregatsDuJour(aujourdhui);
      console.log(
        "Taches de nuit : agregats d'aujourd'hui recalcules (" + nombre + " points de contact).",
      );
    } catch (erreur) {
      console.error("Taches de nuit : agregats d'aujourd'hui non recalcules :", erreur);
    }

    try {
      const nombre = await purgerEmpreintesAnciennes();
      console.log("Taches de nuit : " + nombre + " empreintes anciennes effacees.");
    } catch (erreur) {
      console.error("Taches de nuit : purge des empreintes impossible :", erreur);
    }
  } finally {
    enCours = false;
  }
}

// Prochain passage de 02h00 UTC (demain si on l'a deja depasse aujourd'hui).
function prochaineExecution(maintenant: Date): Date {
  const cible = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate(),
      HEURE_UTC_TACHES,
      0,
      0,
    ),
  );
  if (cible.getTime() <= maintenant.getTime()) {
    return new Date(cible.getTime() + UN_JOUR_EN_MS);
  }
  return cible;
}

// Planifie les taches de nuit, chaque jour. Renvoie une fonction pour les arreter.
export function demarrerTachesDeNuit(): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let arrete = false;

  const planifier = (): void => {
    const maintenant = new Date();
    const prochaine = prochaineExecution(maintenant);

    minuteur = setTimeout(() => {
      void executerTachesDeNuit().finally(() => {
        if (!arrete) {
          planifier();
        }
      });
    }, prochaine.getTime() - maintenant.getTime());

    // Le minuteur ne doit jamais empecher le serveur de s'arreter.
    minuteur.unref();

    console.log("Taches de nuit planifiees pour " + prochaine.toISOString() + ".");
  };

  planifier();

  return () => {
    arrete = true;
    if (minuteur !== undefined) {
      clearTimeout(minuteur);
    }
  };
}