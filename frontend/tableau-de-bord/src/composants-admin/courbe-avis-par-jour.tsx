import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { AvisParJour, PointAvisParJour } from '../types/suivi-dts'
import { formaterJour, formaterJourCourt, formaterNombre } from '../utilitaires/periodes'

// Courbe du nombre d'avis par jour de toute la plateforme (ecran E19, jour 24), administrateur seulement.
// Un point par jour sur 30 jours, y compris les jours sans avis (0) : la courbe n'a pas de trou.
// Meme dessin que la courbe de l'accueil (zone coloree, couleur principale qui suit le theme),
// sans clic sur un jour : la liste des avis d'une organisation n'est pas ouverte a DTS ici.
// Le dessin se manipule a la souris ou au doigt ; le total du texte au-dessus le resume
// pour les lecteurs d'ecran.
// Ce composant ne charge rien : la page lui donne avis_par_jour du hook utiliserVueGlobale.
// Textes : suiviDts.vueGlobale.courbe.* (titre, description, aucun, avis).

// Au-dela de ce nombre de jours, on ne dessine plus un point par jour (trop serre).
const JOURS_AVEC_POINTS = 31

type Proprietes = {
  avisParJour: AvisParJour
}

export function CourbeAvisParJour({ avisParJour }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  // Les signes ':' que useId ajoute ne passent pas dans url(#...) : on les retire.
  const idDegrade = `degrade-vue-globale-${useId().replace(/:/g, '')}`

  const { points, total, jours } = avisParJour

  return (
    <section
      aria-labelledby={idTitre}
      className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="m-0 font-titre text-lg font-bold text-texte">
        {t('suiviDts.vueGlobale.courbe.titre')}
      </h2>

      {total === 0 ? (
        <p className="m-0 text-sm text-texte-secondaire">
          {t('suiviDts.vueGlobale.courbe.aucun', { jours })}
        </p>
      ) : (
        <>
          <p className="m-0 text-sm text-texte-secondaire">
            {t('suiviDts.vueGlobale.courbe.description', {
              jours,
              total: formaterNombre(total, langue, { decimales: 0 }),
            })}
          </p>

          <div aria-hidden="true" className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points}
                margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      style={{ stopColor: 'var(--couleur-principale)', stopOpacity: 0.4 }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: 'var(--couleur-principale)', stopOpacity: 0.04 }}
                    />
                  </linearGradient>
                </defs>
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
                    const point = payload[0]?.payload as PointAvisParJour | undefined
                    if (point === undefined) {
                      return null
                    }
                    return (
                      <div className="rounded-md border border-bordure bg-surface px-3 py-2 text-sm shadow-moyen">
                        <p className="font-semibold text-texte">
                          {formaterJour(String(label), langue)}
                        </p>
                        <p className="text-texte-secondaire">
                          {t('suiviDts.vueGlobale.courbe.avis')} : {point.nb_avis}
                        </p>
                      </div>
                    )
                  }}
                />
                {/* Sans animation : sinon la courbe se redessinerait a chaque actualisation. */}
                <Area
                  type="monotone"
                  dataKey="nb_avis"
                  stroke="var(--couleur-principale)"
                  strokeWidth={2}
                  fill={`url(#${idDegrade})`}
                  dot={points.length <= JOURS_AVEC_POINTS}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}