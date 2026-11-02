import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { utiliserPages } from '../hooks/utiliser-pages'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { FiltresApi, LigneClassement } from '../types/tableau-de-bord'
import { classeTexteNote, niveauDeLaNote } from '../utilitaires/couleurs-notes'
import { formaterNombre } from '../utilitaires/periodes'
import type { Langue } from '../types/langue'
import { Pagination } from './pagination'

// Classement des points de contact, triable (ecran E7, jour 14).
// L'API envoie seulement les points qui ont au moins un avis, meilleure note d'abord :
// le rang "#" est la position dans cet ordre et ne bouge pas quand on change le tri.
// Chaque ligne est un lien vers les avis de ce point de contact.
// Refonte de l'accueil : le tableau est coupe en pages (fleches, points, "Page 1 sur 3") et le nombre
// de lignes par page se calcule d'apres la hauteur du panneau, pour que rien ne defile.

// Hauteurs en pixels, estimees d'apres les classes du tableau : une ligne (nom + type sur deux lignes)
// et la ligne d'en-tete. A ajuster si la derniere ligne est coupee ou s'il reste trop de vide en bas.
const HAUTEUR_LIGNE = 54
const HAUTEUR_EN_TETE = 46

type CleTri = 'nom' | 'site' | 'nb_avis' | 'note_moyenne' | 'csat' | 'nps'
type Ordre = 'asc' | 'desc'

type Colonne = {
  cle: CleTri
  // Fin de la cle de texte : tableau.classement.<texte>
  texte: 'pointContact' | 'site' | 'avis' | 'note' | 'csat' | 'nps'
  numerique: boolean
}

const COLONNES: Colonne[] = [
  { cle: 'nom', texte: 'pointContact', numerique: false },
  { cle: 'site', texte: 'site', numerique: false },
  { cle: 'nb_avis', texte: 'avis', numerique: true },
  { cle: 'note_moyenne', texte: 'note', numerique: true },
  { cle: 'csat', texte: 'csat', numerique: true },
  { cle: 'nps', texte: 'nps', numerique: true },
]

function valeurDeTri(ligne: LigneClassement, cle: CleTri): string | number | null {
  switch (cle) {
    case 'nom':
      return ligne.nom
    case 'site':
      return ligne.site_nom
    case 'nb_avis':
      return ligne.nb_avis
    case 'note_moyenne':
      return ligne.note_moyenne
    case 'csat':
      return ligne.csat
    case 'nps':
      return ligne.nps
  }
}

// Les valeurs manquantes (null) restent toujours en bas, que le tri soit croissant ou decroissant.
// A valeur egale : le plus d'avis d'abord, puis l'ordre alphabetique.
function comparer(a: LigneClassement, b: LigneClassement, cle: CleTri, ordre: Ordre, langue: Langue): number {
  const valeurA = valeurDeTri(a, cle)
  const valeurB = valeurDeTri(b, cle)

  if (valeurA === null && valeurB !== null) {
    return 1
  }
  if (valeurA !== null && valeurB === null) {
    return -1
  }

  let resultat = 0
  if (typeof valeurA === 'string' && typeof valeurB === 'string') {
    resultat = valeurA.localeCompare(valeurB, langue)
  } else if (typeof valeurA === 'number' && typeof valeurB === 'number') {
    resultat = valeurA - valeurB
  }

  if (resultat !== 0) {
    return ordre === 'asc' ? resultat : -resultat
  }
  return b.nb_avis - a.nb_avis || a.nom.localeCompare(b.nom, langue)
}

// Une valeur numerique, ou un tiret (avec le texte "Pas de donnees" pour les lecteurs d'ecran).
function Valeur({ texte, classe = '' }: { texte: string | null; classe?: string }) {
  const { t } = utiliserLangue()
  if (texte === null) {
    return (
      <>
        <span aria-hidden="true" className="text-texte-secondaire">
          –
        </span>
        <span className="sr-only">{t('tableau.aucuneDonnee')}</span>
      </>
    )
  }
  return <span className={classe}>{texte}</span>
}

type Proprietes = {
  lignes: LigneClassement[]
  // Filtres qui ont produit les donnees affichees.
  filtres: FiltresApi | null
}

export function TableauClassement({ lignes, filtres }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const [cle, setCle] = useState<CleTri>('note_moyenne')
  const [ordre, setOrdre] = useState<Ordre>('desc')

  // Rang fixe : position dans l'ordre envoye par l'API.
  const rangs = useMemo(
    () => new Map(lignes.map((ligne, index) => [ligne.point_contact_id, index + 1])),
    [lignes],
  )

  const lignesTriees = useMemo(
    () => [...lignes].sort((a, b) => comparer(a, b, cle, ordre, langue)),
    [lignes, cle, ordre, langue],
  )

  // Lignes de la page affichee ; la zone qui les contient sert a mesurer la hauteur disponible
  const { refZone, elementsPage, pageCourante, nbPages, allerA } = utiliserPages(lignesTriees, {
    hauteurLigne: HAUTEUR_LIGNE,
    hauteurEnTete: HAUTEUR_EN_TETE,
  })

  function trierPar(nouvelleCle: CleTri) {
    // Un nouveau tri repart de la premiere page
    allerA(0)
    if (nouvelleCle === cle) {
      setOrdre((courant) => (courant === 'asc' ? 'desc' : 'asc'))
      return
    }
    setCle(nouvelleCle)
    // Les noms et les sites commencent de A a Z, les chiffres du plus grand au plus petit.
    setOrdre(nouvelleCle === 'nom' || nouvelleCle === 'site' ? 'asc' : 'desc')
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="accueil-remplir rounded-lg bg-surface/50 p-4"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.classement.titre')}
      </h2>

      {lignes.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.classement.aucun')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.classement.description')}</p>

          <div ref={refZone} className="accueil-liste-zone">
            <div className="overflow-x-auto rounded-md">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <caption className="sr-only">{t('tableau.classement.titre')}</caption>
                <thead className="bg-fond-alt">
                  <tr className="border-b border-bordure">
                    <th scope="col" className="w-10 px-2 py-2 text-left font-medium text-texte-secondaire">
                      {t('tableau.classement.rang')}
                    </th>
                    {COLONNES.map((colonne) => {
                      const actif = colonne.cle === cle
                      const nomColonne = t(`tableau.classement.${colonne.texte}`)
                      return (
                        <th
                          key={colonne.cle}
                          scope="col"
                          aria-sort={actif ? (ordre === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={`px-2 py-0 font-medium ${colonne.numerique ? 'text-right' : 'text-left'}`}
                        >
                          <button
                            type="button"
                            onClick={() => trierPar(colonne.cle)}
                            aria-label={t('tableau.classement.trierPar', { colonne: nomColonne })}
                            className={`min-h-11 rounded-md px-1 hover:bg-surface-douce ${
                              actif ? 'text-texte' : 'text-texte-secondaire'
                            }`}
                          >
                            {nomColonne}
                            <span aria-hidden="true" className="ml-1 inline-block w-3 text-xs">
                              {actif ? (ordre === 'asc' ? '▲' : '▼') : ''}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {elementsPage.map((ligne) => (
                    <tr
                      key={ligne.point_contact_id}
                      className="relative border-b border-bordure last:border-b-0 hover:bg-fond-alt"
                    >
                      <td className="px-2 py-2 text-texte-secondaire tabular-nums">
                        {rangs.get(ligne.point_contact_id)}
                      </td>
                      <td className="px-2 py-2">
                        {/* Lien etire sur toute la ligne : un clic n'importe ou ouvre les avis de ce point. */}
                        <Link
                          to={construireLienAvis(filtres ?? {}, { point: ligne.point_contact_id })}
                          aria-label={t('tableau.classement.voirAvis', { nom: ligne.nom })}
                          className="font-medium text-texte after:absolute after:inset-0"
                        >
                          {ligne.nom}
                        </Link>
                        <span className="block text-xs text-texte-secondaire">{ligne.type}</span>
                      </td>
                      <td className="px-2 py-2 text-texte-secondaire">{ligne.site_nom}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{ligne.nb_avis}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <Valeur
                          texte={
                            ligne.note_moyenne === null
                              ? null
                              : formaterNombre(ligne.note_moyenne, langue, { decimales: 2 })
                          }
                          classe={`font-semibold ${classeTexteNote(niveauDeLaNote(ligne.note_moyenne))}`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <Valeur
                          texte={ligne.csat === null ? null : `${formaterNombre(ligne.csat, langue)} %`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <Valeur texte={ligne.nps === null ? null : formaterNombre(ligne.nps, langue)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination pageCourante={pageCourante} nbPages={nbPages} onAller={allerA} />
        </>
      )}
    </section>
  )
}