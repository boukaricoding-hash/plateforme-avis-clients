import { useId } from 'react'
import { useNavigate } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { construireLienAvis } from '../services/tableau-de-bord'
import type { FiltresApi, PointSerie } from '../types/tableau-de-bord'
import { formaterJour, formaterJourCourt, formaterNombre } from '../utilitaires/periodes'

// Courbe du nombre d'avis par jour (ecran E7, jour 14).
// Un clic sur un jour ouvre la liste des avis de ce jour, avec les autres filtres du tableau de bord.
// Le dessin se manipule a la souris ou au doigt ; au clavier, les cartes et les autres liens de la page
// menent a la meme liste d'avis.

// Au-dela de ce nombre de jours, on ne dessine plus un point par jour (trop serre).
const JOURS_AVEC_POINTS = 31

type Proprietes = {
  points: PointSerie[]
  // Filtres qui ont produit les donnees affichees.
  filtres: FiltresApi | null
}

export function GraphiqueCourbe({ points, filtres }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const navigate = useNavigate()
  const idTitre = useId()

  const total = points.reduce((somme, point) => somme + point.nb_avis, 0)

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg bg-surface/50 p-4"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.courbe.titre')}
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.courbe.aucun')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.courbe.description')}</p>
          <p className="sr-only">
            {t('tableau.cartes.nbAvis')} : {total}
          </p>

          <div aria-hidden="true" className="mt-3 cursor-pointer">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={points}
                margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer={false}
                onClick={(etat) => {
                  if (etat.activeIndex === undefined) {
                    return
                  }
                  const point = points[Number(etat.activeIndex)]
                  // Un jour sans avis n'ouvre rien : la liste serait vide.
                  if (point !== undefined && point.nb_avis > 0) {
                    void navigate(construireLienAvis(filtres ?? {}, { from: point.date, to: point.date }))
                  }
                }}
              >
                <CartesianGrid vertical={false} stroke="var(--bordure)" />
                <XAxis
                  dataKey="date"
                  minTickGap={24}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                  tickFormatter={(jour) => formaterJourCourt(String(jour), langue)}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active !== true || payload === undefined || payload.length === 0) {
                      return null
                    }
                    const point = payload[0]?.payload as PointSerie | undefined
                    if (point === undefined) {
                      return null
                    }
                    return (
                      <div className="rounded-md border border-bordure bg-surface px-3 py-2 text-sm shadow-moyen">
                        <p className="font-semibold text-texte">{formaterJour(String(label), langue)}</p>
                        <p className="text-texte-secondaire">
                          {t('tableau.courbe.avis')} : {point.nb_avis}
                        </p>
                        {point.note_moyenne !== null && (
                          <p className="text-texte-secondaire">
                            {t('tableau.courbe.noteMoyenne')} :{' '}
                            {formaterNombre(point.note_moyenne, langue, { decimales: 2 })}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                {/* Sans animation : sinon la ligne se redessinerait a chaque actualisation de 10 secondes. */}
                <Line
                  type="monotone"
                  dataKey="nb_avis"
                  stroke="var(--couleur-principale)"
                  strokeWidth={2}
                  dot={points.length <= JOURS_AVEC_POINTS}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}