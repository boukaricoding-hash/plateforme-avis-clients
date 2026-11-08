import { useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import type { TexteMultilingue } from '../types/avis'
import type { ModeleQuestionnaire } from '../types/questionnaires'
import { IconeFermer, IconeModele } from './icones-questionnaires'

// Panneau "Partir d'un modele" de la page Questionnaires (ecran E10, jour 19).
// Il remplace la zone du graphe (comme le panneau de gestion des matieres sur la page Classes)
// et n'est affiche que pour le Responsable, seul autorise a cloner un modele.
// Ce composant n'appelle pas l'API : la page lui donne les modeles du secteur et l'etat du clonage,
// et recoit le modele choisi (onChoisir). Apres un clonage reussi, c'est la page qui ouvre l'editeur.
// Le modele choisi est copie en nouveau brouillon : l'original ne change pas.

// Texte d'un libelle selon la langue : anglais si demande et rempli, sinon francais
function texteLangue(texte: TexteMultilingue, langue: string): string {
  if (langue === 'en' && texte.en !== undefined && texte.en !== null && texte.en.trim() !== '') {
    return texte.en
  }
  return texte.fr
}

// Squelette affiche pendant le chargement des modeles
function SqueletteModeles({ libelle }: { libelle: string }) {
  return (
    <div className="questionnaires-modeles-squelette" role="status" aria-label={libelle}>
      <div aria-hidden="true" className="questionnaires-modeles-squelette-contenu">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="questionnaires-squelette-ligne"
            style={{ height: 64, width: '100%', animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  )
}

type Proprietes = {
  // Modeles du secteur ; null tant qu'ils ne sont pas charges.
  modeles: ModeleQuestionnaire[] | null
  // Vrai tant que les modeles ne sont pas charges.
  chargement: boolean
  // Erreur du chargement des modeles (null = tout va bien).
  erreur: ErreurService | null
  // Vrai pendant la copie d'un modele : tous les boutons sont bloques.
  clonageEnCours: boolean
  // Erreur du dernier clonage (null = aucune).
  erreurClonage: ErreurService | null
  onChoisir: (modeleId: string) => void
  onReessayer: () => void
  onFermer: () => void
}

export function ChoixModele({
  modeles,
  chargement,
  erreur,
  clonageEnCours,
  erreurClonage,
  onChoisir,
  onReessayer,
  onFermer,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  // Modele sur lequel la personne a clique : c'est lui qui affiche "Creation..."
  const [choisiId, setChoisiId] = useState<string | null>(null)

  function choisir(modeleId: string): void {
    setChoisiId(modeleId)
    onChoisir(modeleId)
  }

  return (
    <div className="questionnaires-modeles">
      <div className="questionnaires-modeles-entete">
        <div className="questionnaires-modeles-titre-bloc">
          <div className="questionnaires-modeles-titre-icone">
            <IconeModele className="questionnaires-modeles-titre-icone-svg" />
          </div>
          <h2 className="questionnaires-modeles-titre">{t('questionnaires.modeles.titre')}</h2>
        </div>
        <button
          type="button"
          className="questionnaires-modeles-fermer"
          aria-label={t('questionnaires.page.fermer')}
          title={t('questionnaires.page.fermer')}
          disabled={clonageEnCours}
          onClick={onFermer}
        >
          <IconeFermer className="questionnaires-modeles-fermer-icone-svg" />
        </button>
      </div>

      <div className="questionnaires-modeles-contenu">
        <p className="questionnaires-modeles-aide">{t('questionnaires.modeles.aide')}</p>

        {erreurClonage !== null && (
          <div className="questionnaires-modeles-erreur" role="alert">
            {erreurClonage.statut === 404
              ? t('questionnaires.modeles.erreurIntrouvable')
              : t('questionnaires.modeles.erreurClonage')}
          </div>
        )}

        {chargement && <SqueletteModeles libelle={t('questionnaires.modeles.chargement')} />}

        {!chargement && erreur !== null && (
          <div className="questionnaires-modeles-erreur" role="alert">
            <span>{t('questionnaires.modeles.erreur')}</span>
            <button type="button" className="questionnaires-modeles-reessayer" onClick={onReessayer}>
              {t('questionnaires.page.reessayer')}
            </button>
          </div>
        )}

        {!chargement && erreur === null && modeles !== null && modeles.length === 0 && (
          <div className="questionnaires-modeles-vide">{t('questionnaires.modeles.aucun')}</div>
        )}

        {!chargement && erreur === null && modeles !== null && modeles.length > 0 && (
          <ul className="questionnaires-modeles-liste">
            {modeles.map((modele, i) => {
              const titreBrut = texteLangue(modele.titre, langue).trim()
              const titre = titreBrut !== '' ? titreBrut : t('questionnaires.liste.sansTitre')
              const accueil = modele.message_accueil !== null ? texteLangue(modele.message_accueil, langue).trim() : ''
              const enCreation = clonageEnCours && choisiId === modele.id
              return (
                <li
                  key={modele.id}
                  className="questionnaires-modeles-ligne"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.045}s` }}
                >
                  <div className="questionnaires-modeles-ligne-icone">
                    <IconeModele className="questionnaires-modeles-ligne-icone-svg" />
                  </div>
                  <div className="questionnaires-modeles-ligne-texte">
                    <span className="questionnaires-modeles-ligne-nom">{titre}</span>
                    {accueil !== '' && <span className="questionnaires-modeles-ligne-description">{accueil}</span>}
                    <span className="questionnaires-modeles-ligne-meta">
                      {t('questionnaires.modeles.questions', { nombre: modele.nombre_questions })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="questionnaires-modeles-utiliser"
                    aria-label={t('questionnaires.modeles.utiliserNom', { titre })}
                    disabled={clonageEnCours}
                    onClick={() => choisir(modele.id)}
                  >
                    {enCreation ? t('questionnaires.modeles.enCours') : t('questionnaires.modeles.utiliser')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}