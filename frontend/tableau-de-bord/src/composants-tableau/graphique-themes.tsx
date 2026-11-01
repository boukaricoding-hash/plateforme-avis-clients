import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ScoreTheme } from '../types/tableau-de-bord'
import { couleurGraphiqueNote, niveauDeLaNote } from '../utilitaires/couleurs-notes'
import { formaterNombre } from '../utilitaires/periodes'

// Score par theme, sur 5, points faibles en premier (ecran E7, jour 14).
// L'API envoie deja les themes tries du plus faible au meilleur.
// Pas de clic ici : la liste des avis n'a pas de filtre par theme.

const HAUTEUR_PAR_THEME = 44
const HAUTEUR_MINIMUM = 120

type Proprietes = {
  themes: ScoreTheme[]
}

export function GraphiqueThemes({ themes }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

  const donnees = themes.map((theme) => ({
    id: theme.theme_id,
    nom: langue === 'en' && theme.libelle_en !== '' ? theme.libelle_en : theme.libelle_fr,
    score: theme.score,
    // Texte deja formate : le graphique l'ecrit tel quel au bout de la barre.
    texteScore: formaterNombre(theme.score, langue, { decimales: 2 }),
    nombreReponses: theme.nb_reponses,
  }))

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('tableau.themes.titre')}
      </h2>

      {donnees.length === 0 ? (
        <p className="mt-3 text-sm text-texte-secondaire">{t('tableau.themes.aucun')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte-secondaire">{t('tableau.themes.description')}</p>

          {/* Le dessin est masque aux lecteurs d'ecran : la liste cachee ci-dessous dit la meme chose. */}
          <div aria-hidden="true" className="mt-3">
            <ResponsiveContainer
              width="100%"
              height={Math.max(HAUTEUR_MINIMUM, donnees.length * HAUTEUR_PAR_THEME + 24)}
            >
              <BarChart
                data={donnees}
                layout="vertical"
                margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid horizontal={false} stroke="var(--bordure)" />
                <XAxis
                  type="number"
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte-secondaire)', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="nom"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--texte)', fontSize: 12 }}
                />
                <Bar dataKey="score" barSize={18} radius={[0, 4, 4, 0]}>
                  {donnees.map((ligne) => (
                    <Cell key={ligne.id} fill={couleurGraphiqueNote(niveauDeLaNote(ligne.score))} />
                  ))}
                  <LabelList dataKey="texteScore" position="right" fill="var(--texte)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="sr-only">
            {donnees.map((ligne) => (
              <li key={ligne.id}>
                {ligne.nom} : {t('tableau.cartes.noteSur5', { note: ligne.texteScore })},{' '}
                {t('tableau.themes.reponses', { nombre: ligne.nombreReponses })}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-texte-secondaire">{t('tableau.cartes.legendeNote')}</p>
        </>
      )}
    </section>
  )
}