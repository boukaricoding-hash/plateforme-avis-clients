import { useId } from 'react'
import { Navigate } from 'react-router'
import { BarreRechercheExport } from '../../composants-exports/barre-recherche-export'
import { ChoixFormat } from '../../composants-exports/choix-format'
import { EtapesExport } from '../../composants-exports/etapes-export'
import { PanneauAnalyse } from '../../composants-exports/panneau-analyse'
import { Robot } from '../../composants-exports/robot'
import { utiliserExport } from '../../hooks/utiliser-export'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ErreurService } from '../../services/api'
import type { EtatOperation } from '../../types/exports'

// Ecran E16 : exports et rapports (jour 21, fichier 20).
// La page assemble les composants et ne calcule rien : tout vient du hook utiliserExport.
// - En haut : le robot, la barre de recherche (centree, avec des marges) et les indications 1 a 4
//   a droite de la barre (sous la barre sur telephone et tablette).
// - Puis le choix du format et des filtres, le bouton qui cree le fichier, et les conclusions du robot.
// - Le Responsable et le Gestionnaire utilisent l'ecran (le Gestionnaire n'exporte que son perimetre,
//   le serveur le decide). L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// Style : classes Tailwind seulement. La page garde les memes marges que les autres ecrans.
// Textes : cles exports.titre, exports.sousTitre, exports.robot.humeur.*, exports.generer.* (fichiers 23 et 24).

type PropsBlocGeneration = {
  etat: EtatOperation
  peutGenerer: boolean
  aUnFormat: boolean
  nomFichier: string | null
  erreur: ErreurService | null
  onGenerer: () => void
}

// Le bouton qui cree le fichier, et ce qui se passe ensuite : en cours, enregistre, ou erreur.
function BlocGeneration({
  etat,
  peutGenerer,
  aUnFormat,
  nomFichier,
  erreur,
  onGenerer,
}: PropsBlocGeneration) {
  const { t } = utiliserLangue()
  const idTitre = useId()

  let libelle = t('exports.generer.bouton')
  if (etat === 'en_cours') {
    libelle = t('exports.generer.enCours')
  } else if (etat === 'termine') {
    libelle = t('exports.generer.encore')
  }

  let messageErreur: string | null = null
  if (erreur !== null) {
    if (erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (erreur.code === 'EXPORT_TROP_VOLUMINEUX') {
      messageErreur = t('exports.generer.tropVolumineux')
    } else {
      messageErreur = t('exports.generer.erreur')
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      aria-busy={etat === 'en_cours'}
      className="rounded-2xl border border-bordure bg-surface p-5 sm:p-6"
    >
      <h2 id={idTitre} className="m-0 mb-4 text-lg font-semibold text-texte">
        {t('exports.generer.titre')}
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <button
          type="button"
          disabled={!peutGenerer}
          onClick={onGenerer}
          className="min-h-12 cursor-pointer rounded-full border-0 bg-principale px-6 text-base font-semibold text-texte-sur-principale transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {libelle}
        </button>

        {!aUnFormat && etat !== 'en_cours' && (
          <p className="m-0 text-sm text-texte-secondaire">{t('exports.generer.choisirFormat')}</p>
        )}
      </div>

      {etat === 'termine' && nomFichier !== null && (
        <p role="status" className="m-0 mt-4 text-sm text-succes">
          {t('exports.generer.pret', { nom: nomFichier })}
        </p>
      )}

      {messageErreur !== null && (
        <p role="alert" className="m-0 mt-4 text-sm text-erreur">
          {messageErreur}
        </p>
      )}
    </section>
  )
}

export function PageExports() {
  const { t } = utiliserLangue()
  const ecran = utiliserExport()

  // L'administrateur DTS n'a pas d'organisation : rien a exporter ici.
  if (ecran.acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  const phraseRobot = t(`exports.robot.humeur.${ecran.humeur}`)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-titre text-2xl font-bold text-texte">{t('exports.titre')}</h1>
        <p className="mt-1 text-texte-secondaire">{t('exports.sousTitre')}</p>
      </header>

      {/* Le robot, la barre de recherche et les indications 1 a 4 */}
      <section className="rounded-2xl border border-bordure bg-surface-douce/40 p-5 sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[10rem_minmax(0,1fr)_12rem] lg:gap-8">
          <div className="flex flex-col items-center gap-2">
            <Robot humeur={ecran.humeur} etiquette={phraseRobot} taille={150} />
            <p aria-hidden="true" className="m-0 max-w-40 text-center text-sm text-texte-secondaire">
              {phraseRobot}
            </p>
          </div>

          <div className="mx-auto w-full max-w-2xl sm:px-4">
            <BarreRechercheExport
              texte={ecran.texte}
              onChangerTexte={ecran.changerTexte}
              mots={ecran.mots}
              problemes={ecran.problemes}
              erreurPeriode={ecran.erreurPeriode}
              humeur={ecran.humeur}
            />
          </div>

          <EtapesExport etape={ecran.etape} />
        </div>
      </section>

      {/* Format et filtres */}
      <section className="rounded-2xl border border-bordure bg-surface p-5 sm:p-6">
        <ChoixFormat
          format={ecran.format}
          onChoisirFormat={ecran.choisirFormat}
          filtres={ecran.filtres}
          onChangerFiltres={ecran.changerFiltres}
          erreurPeriode={ecran.erreurPeriode}
          rapportSurTrenteJours={ecran.rapportSurTrenteJours}
          sites={ecran.sites}
          points={ecran.points}
          questionnaires={ecran.questionnaires}
          erreurListes={ecran.erreurListes}
        />
      </section>

      <BlocGeneration
        etat={ecran.etatGeneration}
        peutGenerer={ecran.peutGenerer}
        aUnFormat={ecran.format !== null}
        nomFichier={ecran.nomFichier}
        erreur={ecran.erreurGeneration}
        onGenerer={() => void ecran.generer()}
      />

      {/* Ce que dit le robot (aussi ecrit dans le rapport PDF et dans la feuille Analyse d'Excel) */}
      <PanneauAnalyse analyse={ecran.analyse} etat={ecran.etatAnalyse} />
    </div>
  )
}