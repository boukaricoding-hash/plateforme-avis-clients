import { useId } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { FiltresApi, RepartitionNote } from '../types/tableau-de-bord'
import {
  classeFondPleinNote,
  couleurGraphiqueNote,
  niveauDeNoteEntiere,
} from '../utilitaires/couleurs-notes'

// Repartition des notes de 1 a 5 (ecran E7, jour 14).
// Un clic sur une barre (ou sur le lien du dessous) ouvre la liste des avis de cette note.

type Proprietes = {
  repartition: RepartitionNote[]
  // Filtres qui ont produit les donnees affichees (pour que le lien garde la meme periode, le meme site...).
  filtres: FiltresApi | null
}

// Le backend range un avis dans la barre "k" avec Math.round(note) : la note 3,4 va dans la barre 3.
// La liste des avis filtre sur la note exacte : pour retrouver les memes avis, on demande
// de k - 0,5 inclus a k + 0,4999 (les extremites 1 et 5 sont limitees a 1 et 5).
function plageDeLaNote(note: number): { note_min: number; note_max: number } {
  return {
    note_min: note === 1 ? 1 : note - 0.5,
    note_max: note === 5 ? 5 : note + 0.4999,
  }
}

export function GraphiqueRepartition({ repartition, filtres }: Proprietes) {
  const { t } = utiliserLangue()
  const navigate = useNavigate()
  const idTitre = useId()

  // Toujours cinq barres, de 1 a 5, meme si l'API n'en renvoie pas une.
  const donnees = [1, 2, 3, 4, 5].map((note) => {
    const nombre = repartition.find((ligne) => ligne.note === note)?.nombre ?? 0
    return { note, nombre, libelle: t('tableau.repartition.note', { note }) }
  })
  const total = donnees.reduce((somme, ligne) => somme + ligne.nombre, 0)

  function lienDeLaNote(note: number): string {
    return construireLienAvis(filtres ?? {}, plageDeLaNote(note))
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg bg-surface/50 p-4"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.repartition.titre')}
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.repartition.aucun')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.repartition.description')}</p>

          {/* Le dessin est masque aux lecteurs d'ecran : la rangee de liens en dessous dit la meme chose. */}
          <div aria-hidden="true" className="mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={donnees}
                margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke="var(--bordure)" />
                <XAxis
                  dataKey="libelle"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                />
                <Bar
                  dataKey="nombre"
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(_barre, index) => {
                    const ligne = donnees[index]
                    if (ligne !== undefined) {
                      void navigate(lienDeLaNote(ligne.note))
                    }
                  }}
                >
                  {donnees.map((ligne) => (
                    <Cell
                      key={ligne.note}
                      fill={couleurGraphiqueNote(niveauDeNoteEntiere(ligne.note))}
                    />
                  ))}
                  <LabelList dataKey="nombre" position="top" fill="var(--texte)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Les memes cinq barres en liens : utilisables au clavier et avec un lecteur d'ecran. */}
          <ul className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
            {donnees.map((ligne) => (
              <li key={ligne.note}>
                <Link
                  to={lienDeLaNote(ligne.note)}
                  aria-label={t('tableau.repartition.aria', { note: ligne.note, nombre: ligne.nombre })}
                  className="block min-h-11 rounded-md px-1 py-1.5 text-texte hover:bg-fond-alt"
                >
                  <span
                    aria-hidden="true"
                    className={`mr-1 inline-block size-2 rounded-full ${classeFondPleinNote(
                      niveauDeNoteEntiere(ligne.note),
                    )}`}
                  />
                  <span className="font-medium">{ligne.libelle}</span>
                  <span className="block text-texte-secondaire">{ligne.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}