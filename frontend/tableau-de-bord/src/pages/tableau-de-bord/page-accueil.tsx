import { AvisRecents } from '../../composants-tableau/avis-recents'
import { BarreFiltres } from '../../composants-tableau/barre-filtres'
import { CarteIndicateur } from '../../composants-tableau/carte-indicateur'
import { DetailQuestions } from '../../composants-tableau/detail-questions'
import { GraphiqueCourbe } from '../../composants-tableau/graphique-courbe'
import { GraphiqueRepartition } from '../../composants-tableau/graphique-repartition'
import { GraphiqueThemes } from '../../composants-tableau/graphique-themes'
import { TableauClassement } from '../../composants-tableau/tableau-classement'
import { utiliserDonneesTableau } from '../../hooks/utiliser-donnees-tableau'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import { utiliserUtilisateur } from '../../hooks/utiliser-utilisateur'
import { construireLienAvis } from '../../services/tableau-de-bord'
import type { FiltresApi, ReponseKpis } from '../../types/tableau-de-bord'
import {
  classeFondClairNote,
  classeTexteNote,
  cleTexteNiveau,
  niveauDeLaNote,
} from '../../utilitaires/couleurs-notes'
import { formaterHeure, formaterJour, formaterNombre } from '../../utilitaires/periodes'

const CLASSES_BOUTON =
  'min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-medium text-texte hover:bg-fond-alt disabled:cursor-not-allowed disabled:opacity-60'

// A partir de cette anciennete (en heures), on ecrit la duree en jours
const SEUIL_JOURS_HEURES = 48

type ProprietesCartes = {
  kpis: ReponseKpis
  // Filtres qui ont produit les donnees affichees : base de tous les liens
  filtres: FiltresApi | null
}

// Les six cartes de chiffres cles
function CartesIndicateurs({ kpis, filtres }: ProprietesCartes) {
  const { t, langue } = utiliserLangue()
  const { indicateurs, evolution } = kpis
  const alertes = kpis.alertes_ouvertes
  const base = filtres ?? {}
  const points = t('tableau.cartes.evolution.points')

  const niveau = niveauDeLaNote(indicateurs.note_moyenne)

  function aideDesAlertes(): string | undefined {
    if (alertes.nombre === 0) {
      return t('tableau.cartes.alertesAucune')
    }
    if (alertes.anciennete_max_heures === null) {
      return undefined
    }
    const heures = alertes.anciennete_max_heures
    const duree =
      heures >= SEUIL_JOURS_HEURES
        ? t('tableau.cartes.dureeJours', { nombre: Math.floor(heures / 24) })
        : t('tableau.cartes.dureeHeures', { nombre: Math.max(1, Math.round(heures)) })
    return t('tableau.cartes.alertesPlusAncienne', { duree })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CarteIndicateur
        titre={t('tableau.cartes.noteMoyenne')}
        valeur={
          indicateurs.note_moyenne === null
            ? null
            : formaterNombre(indicateurs.note_moyenne, langue, { decimales: 2, fixe: true })
        }
        unite="/ 5"
        classeValeur={classeTexteNote(niveau)}
        badge={
          niveau === null
            ? undefined
            : {
                texte: t(cleTexteNiveau(niveau)),
                classes: `${classeFondClairNote(niveau)} ${classeTexteNote(niveau)}`,
              }
        }
        variation={{ valeur: evolution.note_moyenne.difference, unite: '', decimales: 2 }}
        aide={t('tableau.cartes.legendeNote')}
        lien={construireLienAvis(base)}
      />

      <CarteIndicateur
        titre={t('tableau.cartes.csat')}
        valeur={indicateurs.csat === null ? null : formaterNombre(indicateurs.csat, langue)}
        unite="%"
        variation={{ valeur: evolution.csat.difference, unite: points, decimales: 1 }}
        aide={t('tableau.cartes.csatAide')}
        lien={construireLienAvis(base, { note_min: 4 })}
      />

      <CarteIndicateur
        titre={t('tableau.cartes.nps')}
        valeur={indicateurs.nps === null ? null : formaterNombre(indicateurs.nps, langue)}
        variation={{ valeur: evolution.nps.difference, unite: points, decimales: 1 }}
        aide={t('tableau.cartes.npsAide', {
          promoteurs: indicateurs.nb_promoteurs,
          detracteurs: indicateurs.nb_detracteurs,
        })}
        lien={construireLienAvis(base)}
      />

      <CarteIndicateur
        titre={t('tableau.cartes.nbAvis')}
        valeur={formaterNombre(indicateurs.nb_avis, langue, { decimales: 0 })}
        variation={{ valeur: evolution.nb_avis.pourcentage, unite: '%', decimales: 1 }}
        aide={t('tableau.cartes.nbAvisAide', { scans: indicateurs.nb_scans })}
        lien={construireLienAvis(base)}
      />

      <CarteIndicateur
        titre={t('tableau.cartes.tauxReponse')}
        valeur={
          indicateurs.taux_reponse === null ? null : formaterNombre(indicateurs.taux_reponse, langue)
        }
        unite="%"
        variation={{ valeur: evolution.taux_reponse.difference, unite: points, decimales: 1 }}
        aide={t('tableau.cartes.tauxReponseAide')}
        lien={construireLienAvis(base)}
      />

      <CarteIndicateur
        titre={t('tableau.cartes.alertes')}
        valeur={formaterNombre(alertes.nombre, langue, { decimales: 0 })}
        classeValeur={alertes.nombre > 0 ? 'text-erreur' : 'text-texte'}
        aide={aideDesAlertes()}
        lien={construireLienAvis(base, { from: undefined, to: undefined, negatifs: true })}
      />
    </div>
  )
}

export function PageAccueil() {
  const { t, langue } = utiliserLangue()
  const { utilisateur } = utiliserUtilisateur()
  const {
    filtres,
    changerFiltres,
    reinitialiserFiltres,
    erreurPeriode,
    donnees,
    filtresAffiches,
    chargementInitial,
    actualisationEnCours,
    erreur,
    derniereMiseAJour,
    actualiser,
    sites,
    pointsContact,
    questionnaires,
    erreurListes,
  } = utiliserDonneesTableau()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('accueil.titre')}</h1>
        {utilisateur !== null && (
          <p className="mt-1 text-texte-secondaire">
            {t('accueil.bonjour', { nom: utilisateur.nom })}
          </p>
        )}
        {utilisateur !== null && utilisateur.role === 'GESTIONNAIRE' && (
          <p className="mt-1 text-sm text-texte-secondaire">
            {t('tableau.perimetreGestionnaire')}
          </p>
        )}
      </div>

      <BarreFiltres
        filtres={filtres}
        onChanger={changerFiltres}
        onReinitialiser={reinitialiserFiltres}
        erreurPeriode={erreurPeriode}
        sites={sites}
        pointsContact={pointsContact}
        questionnaires={questionnaires}
        erreurListes={erreurListes}
      />

      {chargementInitial && (
        <p role="status" className="text-sm text-texte-secondaire">
          {t('tableau.chargement')}
        </p>
      )}

      {erreur !== null && donnees === null && (
        <div role="alert" className="rounded-lg border border-erreur bg-surface p-4">
          <p className="text-sm text-erreur">
            {erreur.statut === 0 ? t('commun.erreurReseau') : t('tableau.erreur')}
          </p>
          <button type="button" onClick={actualiser} className={`mt-3 ${CLASSES_BOUTON}`}>
            {t('commun.reessayer')}
          </button>
        </div>
      )}

      {donnees !== null && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-texte-secondaire">
            <p>
              {t('tableau.periodeAffichee', {
                debut: formaterJour(donnees.kpis.periode.from, langue),
                fin: formaterJour(donnees.kpis.periode.to, langue),
              })}
            </p>
            {derniereMiseAJour !== null && (
              <p>{t('tableau.misAJour', { heure: formaterHeure(derniereMiseAJour, langue) })}</p>
            )}
            <p>{t('tableau.actualisationAuto')}</p>
            <button
              type="button"
              onClick={actualiser}
              disabled={actualisationEnCours}
              className={CLASSES_BOUTON}
            >
              {actualisationEnCours ? t('tableau.actualisationEnCours') : t('tableau.actualiser')}
            </button>
          </div>

          {erreur !== null && (
            <p
              role="alert"
              className="rounded-md border border-erreur bg-surface p-3 text-sm text-erreur"
            >
              {t('tableau.erreurActualisation')}
            </p>
          )}

          <CartesIndicateurs kpis={donnees.kpis} filtres={filtresAffiches} />

          {donnees.kpis.indicateurs.nb_avis === 0 && (
            <p className="rounded-lg border border-bordure bg-surface p-4 text-sm text-texte-secondaire">
              {t('tableau.aucunAvis')}
            </p>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 [&>section]:h-full">
              <GraphiqueRepartition
                repartition={donnees.kpis.indicateurs.repartition_notes}
                filtres={filtresAffiches}
              />
            </div>
            <div className="min-w-0 [&>section]:h-full">
              <GraphiqueThemes themes={donnees.themes.themes} />
            </div>
          </div>

          <GraphiqueCourbe points={donnees.serie.points} filtres={filtresAffiches} />

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 [&>section]:h-full">
              <TableauClassement
                lignes={donnees.classement.points_contact}
                filtres={filtresAffiches}
              />
            </div>
            <div className="min-w-0 [&>section]:h-full">
              <AvisRecents avis={donnees.derniersAvis.avis} filtres={filtresAffiches} />
            </div>
          </div>

          <DetailQuestions
            questions={donnees.questions.questions}
            questionnaires={questionnaires}
          />
        </>
      )}
    </div>
  )
}