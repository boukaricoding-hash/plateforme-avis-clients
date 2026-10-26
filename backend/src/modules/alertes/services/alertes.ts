import { prisma } from "../../../configuration/base-de-donnees";

// ------------------------------------------------------------
// Alertes : avis negatifs (etape 1 du jour 6)
// ------------------------------------------------------------
// Un avis est negatif si sa note globale est inferieure ou egale au seuil
// de l'organisation (2 sur 5 par defaut), ou si son NPS est inferieur ou
// egal au seuil NPS (6 par defaut). Chaque avis negatif cree UNE alerte et
// une notification pour chaque responsable concerne.

type Motif = "NOTE_BASSE" | "NPS_BAS";

export type ResultatAlerte = {
  alerte_creee: boolean;
  notifications: number;
};

const LONGUEUR_EXTRAIT = 120;

// Vrai si l'erreur vient d'une contrainte "unique" de la base (code Prisma P2002).
function estErreurDoublon(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code: unknown }).code === "P2002"
  );
}

// Debut du commentaire, sur une seule ligne, pour le message de la notification.
function extrait(commentaire: string | null): string {
  if (commentaire === null) {
    return "";
  }
  const propre = commentaire.trim().replace(/\s+/g, " ");
  if (propre === "") {
    return "";
  }
  return propre.length > LONGUEUR_EXTRAIT ? propre.slice(0, LONGUEUR_EXTRAIT - 3) + "..." : propre;
}

// Cree l'alerte et les notifications si l'avis est negatif.
// Ne fait rien pour un avis positif, un avis inconnu ou un avis deja alerte.
export async function declencherAlerteSiNecessaire(avisId: string): Promise<ResultatAlerte> {
  const avis = await prisma.avis.findUnique({
    where: { id: avisId },
    select: {
      id: true,
      organisation_id: true,
      site_id: true,
      note_globale: true,
      nps: true,
      commentaire: true,
      organisation: { select: { seuil_alerte_note: true, seuil_alerte_nps: true } },
      site: { select: { nom: true } },
      point_contact: { select: { nom: true } },
    },
  });

  if (!avis) {
    return { alerte_creee: false, notifications: 0 };
  }

  // 1. Motifs de l'alerte.
  const motifs: Motif[] = [];
  if (avis.note_globale !== null && avis.note_globale <= avis.organisation.seuil_alerte_note) {
    motifs.push("NOTE_BASSE");
  }
  if (avis.nps !== null && avis.nps <= avis.organisation.seuil_alerte_nps) {
    motifs.push("NPS_BAS");
  }
  if (motifs.length === 0) {
    return { alerte_creee: false, notifications: 0 };
  }

  // 2. Destinataires : les responsables de l'organisation,
  // et les gestionnaires rattaches au site de l'avis.
  const destinataires = await prisma.utilisateur.findMany({
    where: {
      organisation_id: avis.organisation_id,
      actif: true,
      supprime_le: null,
      OR: [
        { role: "RESPONSABLE" },
        { role: "GESTIONNAIRE", utilisateurs_sites: { some: { site_id: avis.site_id } } },
      ],
    },
    select: { id: true },
  });

  // 3. Texte de la notification.
  const details: string[] = [];
  if (avis.note_globale !== null) {
    details.push("note " + Math.round(avis.note_globale * 10) / 10 + "/5");
  }
  if (avis.nps !== null) {
    details.push("NPS " + avis.nps);
  }
  const commentaire = extrait(avis.commentaire);
  const titre = "Avis négatif : " + avis.point_contact.nom;
  const message =
    avis.site.nom +
    " - " +
    details.join(", ") +
    (commentaire !== "" ? ' - "' + commentaire + '"' : "");

  // 4. Enregistrement : l'alerte et les notifications ensemble, ou rien.
  try {
    await prisma.$transaction([
      prisma.alerte.create({
        data: { organisation_id: avis.organisation_id, avis_id: avis.id, motifs },
      }),
      prisma.notification.createMany({
        data: destinataires.map((utilisateur) => ({
          organisation_id: avis.organisation_id,
          utilisateur_id: utilisateur.id,
          avis_id: avis.id,
          titre,
          message,
        })),
      }),
    ]);
  } catch (erreur) {
    // Une alerte existe deja pour cet avis : rien a refaire.
    if (estErreurDoublon(erreur)) {
      return { alerte_creee: false, notifications: 0 };
    }
    throw erreur;
  }

  return { alerte_creee: true, notifications: destinataires.length };
}