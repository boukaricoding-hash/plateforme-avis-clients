import { useState } from 'react'
import { Mascotte } from '../../composants/mascotte'
import type { HumeurMascotte } from '../../composants/mascotte'

// Page de test de la mascotte, visible seulement pendant npm run dev : http://localhost:5173/mascotte
// Elle n'existe pas dans la version compilee.

const HUMEURS: HumeurMascotte[] = ['accueil', 'attentif', 'content', 'triste', 'ecoute', 'ravi']

const COULEURS_EXEMPLES = ['#af6046', '#1e3a5f', '#2f7a33', '#7a3fa0', '#c0392b']

export function PageMascotte() {
  const [taille, setTaille] = useState(160)
  const [couleur, setCouleur] = useState('#af6046')
  const [fondSombre, setFondSombre] = useState(false)

  return (
    <main
      className="min-h-svh p-6"
      style={{
        // Meme principe que la vraie page : la mascotte lit --couleur-principale.
        ['--couleur-principale' as string]: couleur,
        background: fondSombre ? '#1f1e1d' : 'var(--fond)',
        color: fondSombre ? '#f4f3ee' : 'var(--texte)',
      }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <h1 className="font-titre text-3xl font-semibold">Test de la mascotte</h1>

        <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-surface/80 p-4 text-texte shadow-doux">
          <label className="flex items-center gap-3 text-sm font-medium">
            Taille : {taille}px
            <input
              type="range"
              min={80}
              max={280}
              value={taille}
              onChange={(evenement) => setTaille(Number(evenement.target.value))}
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-medium">
            Couleur principale
            <input
              type="color"
              value={couleur}
              onChange={(evenement) => setCouleur(evenement.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            {COULEURS_EXEMPLES.map((exemple) => (
              <button
                key={exemple}
                type="button"
                aria-label={'Couleur ' + exemple}
                onClick={() => setCouleur(exemple)}
                className="h-7 w-7 rounded-full border-2 border-white shadow-doux"
                style={{ background: exemple }}
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={fondSombre}
              onChange={(evenement) => setFondSombre(evenement.target.checked)}
            />
            Fond sombre
          </label>
        </section>

        <section className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {HUMEURS.map((humeur) => (
            <figure key={humeur} className="flex flex-col items-center gap-2">
              <Mascotte humeur={humeur} taille={taille} />
              <figcaption className="text-sm font-semibold">{humeur}</figcaption>
            </figure>
          ))}
        </section>
      </div>
    </main>
  )
}