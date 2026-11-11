import { useState } from 'react'
import { Navigate } from 'react-router'
import { BarreRechercheExport } from '../../composants-exports/barre-recherche-export'
import { EtapesExport } from '../../composants-exports/etapes-export'
import { ParoleRobot } from '../../composants-exports/parole-robot'
import { Robot } from '../../composants-exports/robot'
import { utiliserExport } from '../../hooks/utiliser-export'
import { utiliserLangue } from '../../hooks/utiliser-langue'
import type { ErreurService } from '../../services/api'
import type { EtapeExport, FormatExport } from '../../types/exports'

// Ecran E16 : exports et rapports (jour 21, fichier 5 sur 9 du design).
// Un seul ecran, tres leger, sans titre, sans carte et sans bordure :
// - le robot au centre, et ce qu'il dit juste en dessous ;
// - la barre de recherche, avec ses pastilles et ses choix rapides ;
// - les indications 1, 2, 3, 4 a droite de la barre (sous la barre sur tablette et telephone).
// La page assemble les composants et ne calcule rien : tout vient du hook utiliserExport.
// Le decor (90vh, centrage, transparence) est dans styles/exports.css, charge par la barre.
// Un clic sur une indication fait l'etape :
// 1 et 2 ouvrent les choix rapides (format, periode et filtres) sous la barre,
// 3 cree le fichier (il n'est pas enregistre), 4 l'enregistre sur l'appareil quand il est pret.
// Choisir un format ouvre tout de suite l'etape 2, comme les indications le guident.
// Le Responsable et le Gestionnaire utilisent l'ecran (le Gestionnaire n'exporte que son perimetre,
// le serveur le decide). L'administrateur DTS n'a pas d'organisation : il est renvoye a l'accueil.
// Si la creation du fichier echoue, le message s'affiche sous le bloc de saisie.
// Textes : cles exports.robot.humeur.*, exports.generer.tropVolumineux et exports.generer.erreur
// (fichiers 6 et 7), plus commun.erreurReseau qui existe deja.

type FonctionTexte = (cle: string, valeurs?: Record<string, string | number>) => string

// Le message de l'echec de creation du fichier, sinon null.
function messageErreurGeneration(erreur: ErreurService | null, t: FonctionTexte): string | null {
  if (erreur === null) {
    return null
  }
  if (erreur.statut === 0) {
    return t('commun.erreurReseau')
  }
  if (erreur.code === 'EXPORT_TROP_VOLUMINEUX') {
    return t('exports.generer.tropVolumineux')
  }
  return t('exports.generer.erreur')
}

export function PageExports() {
  const { t } = utiliserLangue()
  const ecran = utiliserExport()

  // Indication dont les choix rapides sont ouverts sous la barre (1 ou 2), sinon aucune.
  const [ouverte, setOuverte] = useState<1 | 2 | null>(null)

  // L'administrateur DTS n'a pas d'organisation : rien a exporter ici.
  if (ecran.acces === 'aucun') {
    return <Navigate to="/" replace />
  }

  const phraseRobot = t(`exports.robot.humeur.${ecran.humeur}`)
  const messageErreur = messageErreurGeneration(ecran.erreurGeneration, t)

  // Le clic sur une indication : 1 et 2 ouvrent ou ferment leur choix ; 3 cree le fichier ;
  // 4 l'enregistre sur l'appareil (l'indication 4 est inactive tant que le fichier n'est pas pret).
  function choisirIndication(numero: EtapeExport): void {
    if (numero === 1 || numero === 2) {
      setOuverte((courante) => (courante === numero ? null : numero))
      return
    }
    setOuverte(null)
    if (numero === 3) {
      void ecran.generer()
      return
    }
    ecran.telecharger()
  }

  // Un format choisi : on passe a l'etape 2 (periode et filtres).
  function choisirFormat(format: FormatExport): void {
    ecran.choisirFormat(format)
    setOuverte(2)
  }

  return (
    <div className="exports-page">
      <div className="exports-scene">
        <Robot humeur={ecran.humeur} etiquette={phraseRobot} className="exports-robot" />

        <ParoleRobot humeur={ecran.humeur} analyse={ecran.analyse} etatAnalyse={ecran.etatAnalyse} />

        <div className="exports-saisie">
          <BarreRechercheExport
            texte={ecran.texte}
            onChangerTexte={ecran.changerTexte}
            mots={ecran.mots}
            problemes={ecran.problemes}
            erreurPeriode={ecran.erreurPeriode}
            humeur={ecran.humeur}
            ouverte={ouverte}
            format={ecran.format}
            onChoisirFormat={choisirFormat}
            filtres={ecran.filtres}
            onChangerFiltres={ecran.changerFiltres}
          />

          <EtapesExport
            etape={ecran.etape}
            ouverte={ouverte}
            peutGenerer={ecran.peutGenerer}
            fichierEnregistre={ecran.fichierEnregistre}
            onChoisir={choisirIndication}
          />
        </div>

        {messageErreur !== null && (
          <p role="alert" className="exports-messages px-4">
            {messageErreur}
          </p>
        )}
      </div>
    </div>
  )
}