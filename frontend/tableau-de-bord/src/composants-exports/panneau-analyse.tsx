import { useId } from 'react'
import type { ReactNode } from 'react'
import { IconeCoche, IconeFlecheDroite } from '../composants-avis/icones-avis'
import { IconeAlertes } from '../composants-tableau/icones-accueil'
import type { ComposantIcone } from '../composants-tableau/icones-accueil'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtatOperation, NegatifsParJour, PointAnalyse, ReponseAnalyse } from '../types/exports'
import { formaterJour, formaterNombre } from '../utilitaires/periodes'

// Panneau des conclusions du robot (jour 21, fichier 19), sous la barre de l'ecran E16.
// Il affiche l'analyse des avis filtres donnee par le hook utiliserExport (POST /exports/analyse) :
// le resume, quelques chiffres, les points forts, les points faibles, les pistes d'action et les
// jours ou les avis negatifs se concentrent. Les memes conclusions sont ecrites dans le rapport
// PDF et dans la feuille "Analyse" du fichier Excel.
// Le composant ne calcule rien : les textes des points sont deja dans la langue demandee
// (ils viennent du serveur), les autres textes viennent des traductions.
// Les erreurs affichent toujours le message des traductions, pas celui du serveur.
// Etats : en cours (squelette), repos (la periode est invalide, pas d'analyse), erreur,
// trop peu d'avis pour conclure, et analyse complete.
// Style : classes Tailwind seulement, aucune classe a ajouter dans exports.css.
// Textes : cles exports.analyse.* (fichiers 23 et 24).

type PropsPanneauAnalyse = {
  analyse: ReponseAnalyse | null
  etat: EtatOperation
}

// Lundi en premier ; 0 = dimanche dans les chiffres du serveur.
const ORDRE_JOURS: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

// Le 1er novembre 2026 est un dimanche : on s'en sert pour ecrire le nom des jours.
function nomDuJour(indexJour: number, langue: string): string {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(Date.UTC(2026, 10, 1 + indexJour)))
}

// ------------------------------------------------------------
// Petits composants
// ------------------------------------------------------------

type PropsListePoints = {
  titre: string
  points: PointAnalyse[]
  Icone: ComposantIcone
  // Classe de la couleur de l'icone : la couleur ne suffit pas, le titre de la colonne dit aussi de quoi il s'agit.
  classeIcone: string
}

function ListePoints({ titre, points, Icone, classeIcone }: PropsListePoints) {
  const idTitre = useId()
  if (points.length === 0) {
    return null
  }
  return (
    <section aria-labelledby={idTitre} className="min-w-0 rounded-xl border border-bordure bg-surface p-4">
      <h3 id={idTitre} className="m-0 mb-3 text-sm font-semibold tracking-wide text-texte-secondaire uppercase">
        {titre}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {points.map((point) => (
          <li key={`${point.code}-${point.titre}`} className="flex gap-3">
            <Icone width={18} height={18} className={`mt-0.5 shrink-0 ${classeIcone}`} />
            <div className="min-w-0">
              <p className="m-0 text-base font-semibold text-texte">{point.titre}</p>
              <p className="m-0 mt-1 text-sm leading-snug text-texte-secondaire">{point.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

type PropsChiffre = {
  etiquette: string
  valeur: string
}

function Chiffre({ etiquette, valeur }: PropsChiffre) {
  return (
    <div className="min-w-0 rounded-lg bg-fond-alt px-4 py-3">
      <dt className="text-xs text-texte-secondaire">{etiquette}</dt>
      <dd className="m-0 mt-1 text-xl font-semibold text-texte">{valeur}</dd>
    </div>
  )
}

type PropsNegatifsParJour = {
  negatifs: NegatifsParJour
}

// Sept barres, une par jour de la semaine. Le nombre est ecrit au-dessus de chaque barre :
// la hauteur ne suffit jamais seule.
function NegatifsParJourGraphique({ negatifs }: PropsNegatifsParJour) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const maximum = Math.max(1, ...negatifs.par_jour_semaine)

  return (
    <section aria-labelledby={idTitre} className="rounded-xl border border-bordure bg-surface p-4">
      <h3 id={idTitre} className="m-0 mb-1 text-sm font-semibold tracking-wide text-texte-secondaire uppercase">
        {t('exports.analyse.negatifsParJour')}
      </h3>
      {negatifs.pic !== null && (
        <p className="m-0 mb-3 text-sm text-texte-secondaire">
          {t('exports.analyse.pic', {
            date: formaterJour(negatifs.pic.date, langue),
            nombre: negatifs.pic.nombre,
          })}
        </p>
      )}
      <ul className="m-0 grid list-none grid-cols-7 gap-2 p-0">
        {ORDRE_JOURS.map((indexJour) => {
          const nombre = negatifs.par_jour_semaine[indexJour] ?? 0
          const hauteur = nombre === 0 ? 4 : Math.max(8, Math.round((nombre / maximum) * 64))
          return (
            <li key={indexJour} className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-texte">{nombre}</span>
              <span className="flex h-16 items-end">
                <span
                  aria-hidden="true"
                  className={`block w-6 rounded-t-md ${nombre === 0 ? 'bg-bordure-forte' : 'bg-erreur'}`}
                  style={{ height: `${hauteur}px` }}
                />
              </span>
              <span className="text-xs text-texte-secondaire">{nomDuJour(indexJour, langue)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Squelette pendant l'analyse (le mouvement est coupe si l'utilisateur demande moins d'animations).
function Squelette() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="h-5 w-3/4 animate-pulse rounded bg-surface-douce motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-surface-douce motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-douce motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-douce motion-reduce:animate-none" />
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Le composant
// ------------------------------------------------------------

export function PanneauAnalyse({ analyse, etat }: PropsPanneauAnalyse) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

  let contenu: ReactNode

  if (etat === 'erreur') {
    contenu = (
      <p role="alert" className="m-0 text-base text-erreur">
        {t('exports.analyse.erreur')}
      </p>
    )
  } else if (analyse === null) {
    // En cours : squelette. Au repos : la periode choisie n'est pas valide, donc pas d'analyse.
    contenu =
      etat === 'repos' ? (
        <p role="status" className="m-0 text-base text-texte-secondaire">
          {t('exports.analyse.enAttente')}
        </p>
      ) : (
        <>
          <p role="status" className="sr-only">
            {t('exports.analyse.enCours')}
          </p>
          <Squelette />
        </>
      )
  } else {
    const { kpis, negatifs } = analyse.donnees
    const { indicateurs, alertes_ouvertes: alertes } = kpis
    const note =
      indicateurs.note_moyenne === null
        ? t('exports.analyse.aucuneDonnee')
        : `${formaterNombre(indicateurs.note_moyenne, langue, { decimales: 2 })} / 5`
    const nps =
      indicateurs.nps === null
        ? t('exports.analyse.aucuneDonnee')
        : formaterNombre(indicateurs.nps, langue, { decimales: 0 })

    contenu = (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-texte-secondaire">
          {t('tableau.periodeAffichee', {
            debut: formaterJour(analyse.periode.from, langue),
            fin: formaterJour(analyse.periode.to, langue),
          })}
        </p>

        <p className="m-0 text-base leading-relaxed text-texte">{analyse.resume}</p>

        {!analyse.suffisant && (
          <p role="status" className="m-0 text-sm text-alerte">
            {t('exports.analyse.insuffisant', { nombre: analyse.nb_avis })}
          </p>
        )}

        <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre
            etiquette={t('exports.analyse.chiffres.avis')}
            valeur={formaterNombre(analyse.nb_avis, langue, { decimales: 0 })}
          />
          <Chiffre etiquette={t('exports.analyse.chiffres.note')} valeur={note} />
          <Chiffre etiquette={t('exports.analyse.chiffres.nps')} valeur={nps} />
          <Chiffre
            etiquette={t('exports.analyse.chiffres.alertes')}
            valeur={formaterNombre(alertes.nombre, langue, { decimales: 0 })}
          />
        </dl>

        {analyse.suffisant && (
          <div className="grid gap-3 lg:grid-cols-3">
            <ListePoints
              titre={t('exports.analyse.pointsForts')}
              points={analyse.points_forts}
              Icone={IconeCoche}
              classeIcone="text-succes"
            />
            <ListePoints
              titre={t('exports.analyse.pointsFaibles')}
              points={analyse.points_faibles}
              Icone={IconeAlertes}
              classeIcone="text-alerte"
            />
            <ListePoints
              titre={t('exports.analyse.pistes')}
              points={analyse.pistes}
              Icone={IconeFlecheDroite}
              classeIcone="text-info"
            />
          </div>
        )}

        {negatifs.total > 0 && <NegatifsParJourGraphique negatifs={negatifs} />}
      </div>
    )
  }

  return (
    <section
      aria-labelledby={idTitre}
      aria-busy={etat === 'en_cours'}
      className="rounded-2xl border border-bordure bg-surface-douce/40 p-5 sm:p-6"
    >
      <h2 id={idTitre} className="m-0 mb-4 text-lg font-semibold text-texte">
        {t('exports.analyse.titre')}
      </h2>
      {contenu}
    </section>
  )
}