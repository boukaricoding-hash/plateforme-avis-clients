import { IconeCoche } from '../composants-avis/icones-avis'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { EtapeExport } from '../types/exports'

// Les indications 1, 2, 3, 4 de l'ecran E16 (jour 21, fichier 2 sur 9 du design) :
// 1 Format, 2 Periode et filtres, 3 Generer, 4 Telecharger.
// Chaque indication est un bouton : un clic fait l'etape.
// - 1 et 2 ouvrent (ou ferment) les choix rapides sous la barre de recherche ;
// - 3 cree le fichier (inactive tant qu'il n'y a pas de format, ou pendant la creation) ;
// - 4 telecharge le fichier (inactive tant qu'il n'est pas pret).
// Le composant ne calcule rien : l'etape vient du hook utiliserExport, et la page (fichier 5)
// decide ce que fait chaque clic. Les etapes passees ont une coche, l'etape en cours est
// remplie, les etapes a venir sont discretes. A l'etape 4, les quatre sont faites.
// Aucune bordure ni carte : tout le decor est dans styles/exports.css
// (classes exports-etapes, exports-etape, exports-etape-numero, exports-etape-titre,
// exports-etape-detail). Sur grand ecran les indications sont a droite de la barre, avec
// leur texte long ; sur telephone seuls les titres restent.
// Textes : cles exports.etapes.* (fichiers 6 et 7), dont les nouveaux textes longs
// formatDetail, periodeDetail, genererDetail et telechargerDetail.
// Les lecteurs d'ecran entendent aussi l'etat de chaque etape : la couleur ne suffit jamais seule.

type PropsEtapesExport = {
  etape: EtapeExport
  // Indication dont les choix rapides sont ouverts sous la barre (1 ou 2), sinon null.
  ouverte: 1 | 2 | null
  // Vrai quand le fichier peut etre cree : format choisi, periode valide, aucune creation en cours.
  peutGenerer: boolean
  onChoisir: (numero: EtapeExport) => void
}

type Indication = {
  numero: EtapeExport
  cleTitre: string
  cleDetail: string
}

const INDICATIONS: readonly Indication[] = [
  { numero: 1, cleTitre: 'exports.etapes.format', cleDetail: 'exports.etapes.formatDetail' },
  { numero: 2, cleTitre: 'exports.etapes.periode', cleDetail: 'exports.etapes.periodeDetail' },
  { numero: 3, cleTitre: 'exports.etapes.generer', cleDetail: 'exports.etapes.genererDetail' },
  { numero: 4, cleTitre: 'exports.etapes.telecharger', cleDetail: 'exports.etapes.telechargerDetail' },
]

export function EtapesExport({ etape, ouverte, peutGenerer, onChoisir }: PropsEtapesExport) {
  const { t } = utiliserLangue()

  // A l'etape 4, le fichier est enregistre : tout est fait, et le telechargement est possible.
  const fichierPret = etape === 4

  return (
    <ol aria-label={t('exports.etapes.titre')} className="exports-etapes">
      {INDICATIONS.map(({ numero, cleTitre, cleDetail }) => {
        const terminee = numero < etape || fichierPret
        const courante = numero === etape && !fichierPret
        const etat = terminee ? 'terminee' : courante ? 'courante' : 'avenir'
        const cleEtat = terminee
          ? 'exports.etapes.etatTerminee'
          : courante
            ? 'exports.etapes.etatEnCours'
            : 'exports.etapes.etatAVenir'

        // Les etapes 1 et 2 ouvrent un choix rapide ; 3 et 4 attendent que ce soit possible.
        const choixRapide = numero === 1 || numero === 2
        const inactive = (numero === 3 && !peutGenerer) || (numero === 4 && !fichierPret)

        return (
          <li key={numero}>
            <button
              type="button"
              className="exports-etape"
              data-etat={etat}
              disabled={inactive}
              aria-current={courante ? 'step' : undefined}
              aria-expanded={choixRapide ? ouverte === numero : undefined}
              onClick={() => onChoisir(numero)}
            >
              <span aria-hidden="true" className="exports-etape-numero">
                {terminee ? <IconeCoche width={16} height={16} /> : numero}
              </span>
              <span className="min-w-0">
                <span className="exports-etape-titre">
                  {t(cleTitre)}
                  <span className="sr-only">{` : ${t(cleEtat)}`}</span>
                </span>
                <span className="exports-etape-detail">{t(cleDetail)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}