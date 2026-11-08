import { useEffect, useMemo } from 'react'
import ReactFlow, { Controls, Handle, Position, ReactFlowProvider, useReactFlow } from 'reactflow'
import type { Edge, Node, NodeMouseHandler, NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { IconeQuestionnaires } from '../mise-en-page/icones-menu'
import type { ValeurContexteLangue } from '../traductions/contexte-langue'
import type { TexteMultilingue } from '../types/avis'
import type { ResumeQuestionnaire, StatutQuestionnaire } from '../types/questionnaires'
import {
  IconeAttention,
  IconeDupliquer,
  IconeModele,
  IconeNouveauQuestionnaire,
} from './icones-questionnaires'

// Graphe de la page Questionnaires (ecran E10, jour 19), meme principe que le graphe des classes :
// une racine (l'organisation), les 3 statuts (Actifs, Brouillons, Inactifs), puis les
// questionnaires du statut ouvert.
// Ce composant n'appelle pas l'API : la page lui donne la liste et recoit les clics.
// La selection vient de la page (selectionId) : le graphe ne la garde pas lui-meme.
// Une colonne d'actions (questionnaire vide, modele, dupliquer) est affichee pour le Responsable seulement.

const PREFIXE_STATUT = 'statut-'
const PREFIXE_QUESTIONNAIRE = 'questionnaire-'

// Taille reservee a chaque nœud pour le calcul de la disposition (comme la page Classes)
const LARGEUR_NOEUD = 150
const HAUTEUR_NOEUD = 64

// Nombre de caracteres affiches dans un nœud rond (le titre complet reste dans l'info-bulle)
const LONGUEUR_MAX_TITRE = 22

// Ordre d'affichage des statuts
const STATUTS: StatutQuestionnaire[] = ['ACTIF', 'BROUILLON', 'INACTIF']

type DonneesRacine = {
  label: string
}

type DonneesStatut = {
  statut: StatutQuestionnaire
  label: string
  souslabel: string
  ouvert: boolean
}

type DonneesQuestionnaire = {
  label: string
  titreComplet: string
  statut: StatutQuestionnaire
  alerte: boolean
  titreAlerte: string
  selectionne: boolean
}

type Traducteur = ValeurContexteLangue['t']

// Texte d'un titre selon la langue : anglais si demande et rempli, sinon francais
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

function abreger(texte: string): string {
  if (texte.length <= LONGUEUR_MAX_TITRE) {
    return texte
  }
  return `${texte.slice(0, LONGUEUR_MAX_TITRE - 1).trimEnd()}…`
}

// ------------------------------------------------------------
// Nœuds
// ------------------------------------------------------------

function NoeudRacine({ data }: NodeProps<DonneesRacine>) {
  return (
    <div className="questionnaires-noeud questionnaires-noeud--racine">
      <IconeQuestionnaires className="questionnaires-noeud-icone-svg" />
      <span className="questionnaires-noeud-label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="questionnaires-noeud-poignee" />
    </div>
  )
}

function NoeudStatut({ data }: NodeProps<DonneesStatut>) {
  const classes = [
    'questionnaires-noeud',
    'questionnaires-noeud--statut',
    `questionnaires-noeud--statut-${data.statut.toLowerCase()}`,
    data.ouvert ? 'questionnaires-noeud--statut-ouvert' : '',
  ]
    .filter((classe) => classe !== '')
    .join(' ')

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Top} className="questionnaires-noeud-poignee" />
      <span className="questionnaires-noeud-label">{data.label}</span>
      <span className="questionnaires-noeud-souslabel">{data.souslabel}</span>
      <Handle type="source" position={Position.Bottom} className="questionnaires-noeud-poignee" />
    </div>
  )
}

function NoeudQuestionnaire({ data }: NodeProps<DonneesQuestionnaire>) {
  const classes = [
    'questionnaires-noeud',
    'questionnaires-noeud--questionnaire',
    `questionnaires-noeud--questionnaire-${data.statut.toLowerCase()}`,
    data.selectionne ? 'questionnaires-noeud--questionnaire-selectionne' : '',
  ]
    .filter((classe) => classe !== '')
    .join(' ')

  return (
    <div className={classes} title={data.titreComplet}>
      <Handle type="target" position={Position.Top} className="questionnaires-noeud-poignee" />
      {data.alerte && (
        <span className="questionnaires-noeud-badge questionnaires-noeud-badge--attention" title={data.titreAlerte}>
          <IconeAttention className="questionnaires-alerte-icone-svg" />
        </span>
      )}
      <span className="questionnaires-noeud-label">{data.label}</span>
    </div>
  )
}

const TYPES_NOEUDS = {
  racine: NoeudRacine,
  statut: NoeudStatut,
  questionnaire: NoeudQuestionnaire,
}

// ------------------------------------------------------------
// Construction et disposition du graphe
// ------------------------------------------------------------

// Place les nœuds de haut en bas avec dagre
function appliquerDisposition(noeuds: Node[], liens: Edge[]): Node[] {
  const graphe = new dagre.graphlib.Graph()
  graphe.setDefaultEdgeLabel(() => ({}))
  graphe.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 60 })

  noeuds.forEach((noeud) => graphe.setNode(noeud.id, { width: LARGEUR_NOEUD, height: HAUTEUR_NOEUD }))
  liens.forEach((lien) => graphe.setEdge(lien.source, lien.target))

  dagre.layout(graphe)

  return noeuds.map((noeud) => {
    const position = graphe.node(noeud.id)
    return {
      ...noeud,
      position: { x: position.x - LARGEUR_NOEUD / 2, y: position.y - HAUTEUR_NOEUD / 2 },
    }
  })
}

function construireGraphe(
  questionnaires: ResumeQuestionnaire[],
  nomOrganisation: string | null,
  statutOuvert: StatutQuestionnaire | null,
  t: Traducteur,
  langue: string,
): { noeuds: Node[]; liens: Edge[] } {
  const noeuds: Node[] = []
  const liens: Edge[] = []

  const idRacine = 'racine'
  const donneesRacine: DonneesRacine = {
    label: nomOrganisation !== null && nomOrganisation.trim() !== '' ? nomOrganisation : t('questionnaires.page.organisation'),
  }
  noeuds.push({ id: idRacine, type: 'racine', data: donneesRacine, position: { x: 0, y: 0 } })

  STATUTS.forEach((statut) => {
    const idStatut = `${PREFIXE_STATUT}${statut}`
    const duStatut = questionnaires.filter((questionnaire) => questionnaire.statut === statut)
    const ouvert = statutOuvert === statut

    const donneesStatut: DonneesStatut = {
      statut,
      label: t(`questionnaires.page.statutsPluriel.${statut}`),
      souslabel:
        duStatut.length === 1
          ? t('questionnaires.page.compteUn')
          : t('questionnaires.page.compteMultiple', { nombre: duStatut.length }),
      ouvert,
    }
    noeuds.push({ id: idStatut, type: 'statut', data: donneesStatut, position: { x: 0, y: 0 } })
    liens.push({ id: `lien-${idRacine}-${idStatut}`, source: idRacine, target: idStatut, type: 'straight' })

    if (!ouvert) {
      return
    }

    // Les questionnaires modifies le plus recemment apparaissent en premier
    const tries = [...duStatut].sort((a, b) => Date.parse(b.modifie_le) - Date.parse(a.modifie_le))

    tries.forEach((questionnaire) => {
      const idQuestionnaire = `${PREFIXE_QUESTIONNAIRE}${questionnaire.id}`
      const titre = texteLangue(questionnaire.titre, langue).trim()
      const titreComplet = titre !== '' ? titre : t('questionnaires.liste.sansTitre')

      const donneesQuestionnaire: DonneesQuestionnaire = {
        label: abreger(titreComplet),
        titreComplet,
        statut: questionnaire.statut,
        // Un questionnaire actif sans point de contact ne peut recevoir aucune reponse
        alerte: questionnaire.statut === 'ACTIF' && questionnaire.nombre_points_contact === 0,
        titreAlerte: t('questionnaires.page.alerteSansPoint'),
        selectionne: false,
      }
      noeuds.push({ id: idQuestionnaire, type: 'questionnaire', data: donneesQuestionnaire, position: { x: 0, y: 0 } })
      liens.push({
        id: `lien-${idStatut}-${idQuestionnaire}`,
        source: idStatut,
        target: idQuestionnaire,
        type: 'smoothstep',
      })
    })
  })

  return { noeuds: appliquerDisposition(noeuds, liens), liens }
}

// ------------------------------------------------------------
// Composant
// ------------------------------------------------------------

type Proprietes = {
  questionnaires: ResumeQuestionnaire[]
  // Nom de l'organisation (racine du graphe) ; null = texte par defaut.
  nomOrganisation: string | null
  // Statut dont les questionnaires sont affiches ; null = aucun.
  statutOuvert: StatutQuestionnaire | null
  // Questionnaire selectionne ; null = aucun.
  selectionId: string | null
  // Vrai pour le Responsable : la colonne d'actions est affichee.
  peutModifier: boolean
  duplicationEnCours: boolean
  onBasculerStatut: (statut: StatutQuestionnaire) => void
  onSelectionner: (id: string | null) => void
  onNouveauVide: () => void
  onChoisirModele: () => void
  onDupliquer: () => void
}

function ContenuGraphe({
  questionnaires,
  nomOrganisation,
  statutOuvert,
  selectionId,
  peutModifier,
  duplicationEnCours,
  onBasculerStatut,
  onSelectionner,
  onNouveauVide,
  onChoisirModele,
  onDupliquer,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const { fitView } = useReactFlow()

  const graphe = useMemo(
    () => construireGraphe(questionnaires, nomOrganisation, statutOuvert, t, langue),
    [questionnaires, nomOrganisation, statutOuvert, t, langue],
  )

  // La selection ne change que l'apparence d'un nœud : pas de nouveau calcul de disposition
  const noeuds = useMemo(
    () =>
      graphe.noeuds.map((noeud) => {
        if (noeud.type !== 'questionnaire') {
          return noeud
        }
        const donnees = noeud.data as DonneesQuestionnaire
        const selectionne = selectionId !== null && noeud.id === `${PREFIXE_QUESTIONNAIRE}${selectionId}`
        return { ...noeud, data: { ...donnees, selectionne } }
      }),
    [graphe, selectionId],
  )

  // Recentre le graphe quand les nœuds affiches changent (pas quand seule la selection change)
  const signature = useMemo(() => graphe.noeuds.map((noeud) => noeud.id).join('|'), [graphe])

  useEffect(() => {
    const minuteur = setTimeout(() => {
      void fitView({ padding: 0.2, duration: 400 })
    }, 100)
    return () => clearTimeout(minuteur)
  }, [signature, fitView])

  const gererClicNoeud: NodeMouseHandler = (_evenement, noeud) => {
    if (noeud.type === 'statut') {
      onBasculerStatut((noeud.data as DonneesStatut).statut)
      return
    }
    if (noeud.type === 'questionnaire') {
      const id = noeud.id.slice(PREFIXE_QUESTIONNAIRE.length)
      onSelectionner(id === selectionId ? null : id)
    }
  }

  const titreDupliquer =
    selectionId === null ? t('questionnaires.page.actions.dupliquerChoisir') : t('questionnaires.page.actions.dupliquer')

  return (
    <>
      <ReactFlow
        nodes={noeuds}
        edges={graphe.liens}
        onNodeClick={gererClicNoeud}
        nodeTypes={TYPES_NOEUDS}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={true}
        minZoom={0.3}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls showInteractive={false} position="top-right" />
      </ReactFlow>

      {peutModifier && (
        <div className="questionnaires-graphe-actions">
          <button
            type="button"
            className="questionnaires-graphe-action"
            aria-label={t('questionnaires.liste.nouveauVide')}
            title={t('questionnaires.liste.nouveauVide')}
            onClick={onNouveauVide}
          >
            <IconeNouveauQuestionnaire />
          </button>
          <button
            type="button"
            className="questionnaires-graphe-action"
            aria-label={t('questionnaires.modeles.titre')}
            title={t('questionnaires.modeles.titre')}
            onClick={onChoisirModele}
          >
            <IconeModele />
          </button>
          <button
            type="button"
            className="questionnaires-graphe-action"
            aria-label={titreDupliquer}
            title={titreDupliquer}
            disabled={selectionId === null || duplicationEnCours}
            onClick={onDupliquer}
          >
            <IconeDupliquer />
          </button>
        </div>
      )}
    </>
  )
}

export function GrapheQuestionnaires(proprietes: Proprietes) {
  return (
    <ReactFlowProvider>
      <ContenuGraphe {...proprietes} />
    </ReactFlowProvider>
  )
}