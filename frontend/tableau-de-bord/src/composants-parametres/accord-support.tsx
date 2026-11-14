import { useId, useState } from 'react'
import { utiliserAccordSupport } from '../hooks/utiliser-accord-support'
import { utiliserLangue } from '../hooks/utiliser-langue'
import { DUREES_ACCES_SUPPORT, type DureeAccesSupport } from '../types/suivi-dts'

// Bloc "Accord de support" de l'ecran E14 (parametres, jour 24), pour le Responsable seulement.
// Par defaut, l'equipe DTS ne peut pas consulter l'organisation. Le Responsable peut l'y autoriser
// pour une duree limitee (1 heure, 24 heures ou 7 jours) :
// - l'interrupteur donne l'accord (avec la duree choisie) ou le retire tout de suite, sans autre bouton ;
// - tant qu'un accord est actif, "Renouveler" remplace l'accord par un nouveau, avec la duree choisie ;
// - DTS lit seulement (rien ne peut etre modifie) et ne voit pas les coordonnees des clients ;
// - chaque accord donne, retire et chaque consultation est ecrit dans le journal.
// Le composant prend ses donnees dans utiliserAccordSupport et n'affiche rien pour un autre role.
// Textes : suiviDts.accord.*

const DUREE_PAR_DEFAUT: DureeAccesSupport = 'UNE_HEURE'

const CLASSE_BOUTON_SECONDAIRE =
  'min-h-11 rounded-md border border-bordure-champ px-4 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

type ProprietesDuree = {
  nom: string
  duree: DureeAccesSupport
  coche: boolean
  bloque: boolean
  surChoix: () => void
}

// Une duree (bouton radio).
function ChoixDuree({ nom, duree, coche, bloque, surChoix }: ProprietesDuree) {
  const { t } = utiliserLangue()
  const idChamp = useId()

  return (
    <div className="flex items-center gap-3 rounded-md border border-bordure px-3">
      <input
        id={idChamp}
        type="radio"
        name={nom}
        checked={coche}
        disabled={bloque}
        onChange={surChoix}
        className="h-5 w-5 shrink-0 cursor-pointer accent-principale disabled:cursor-not-allowed"
      />
      <label
        htmlFor={idChamp}
        className="flex min-h-11 flex-1 cursor-pointer items-center text-sm font-semibold text-texte"
      >
        {t(`suiviDts.accord.duree.${duree}`)}
      </label>
    </div>
  )
}

export function SectionAccordSupport() {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const idLibelle = useId()
  const nomGroupe = useId()
  const [duree, setDuree] = useState<DureeAccesSupport>(DUREE_PAR_DEFAUT)
  const {
    acces,
    accord,
    chargement,
    erreur,
    recharger,
    enCours,
    succes,
    erreurAction,
    accorder,
    retirer,
  } = utiliserAccordSupport()

  // Seul le Responsable gere l'accord.
  if (acces === 'aucun') {
    return null
  }

  const actif = accord !== null
  const formatDate = new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Lecture pas encore faite ou en echec : on ne connait pas l'etat, donc pas d'interrupteur.
  const etatConnu = !chargement && erreur === null

  function basculer(): void {
    if (actif) {
      void retirer()
    } else {
      void accorder(duree)
    }
  }

  // Message de l'action : annonce aux lecteurs d'ecran (role status).
  function messageEtat(): string {
    if (enCours !== null) {
      return t('suiviDts.accord.enregistrement')
    }
    if (succes === 'accorder') {
      return t('suiviDts.accord.succes.accorder')
    }
    return succes === 'retirer' ? t('suiviDts.accord.succes.retirer') : ''
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <h2 id={idTitre} className="font-titre text-lg font-bold text-texte">
        {t('suiviDts.accord.titre')}
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">{t('suiviDts.accord.description')}</p>

      {chargement && (
        <p role="status" className="m-0 mt-4 text-sm text-texte-secondaire">
          {t('suiviDts.accord.chargement')}
        </p>
      )}

      {erreur !== null && (
        <div className="mt-4">
          <p role="alert" className="m-0 text-sm text-erreur">
            {erreur.statut === 0 ? t('commun.erreurReseau') : t('suiviDts.accord.erreurLecture')}
          </p>
          <button type="button" onClick={recharger} className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}>
            {t('commun.reessayer')}
          </button>
        </div>
      )}

      {etatConnu && (
        <>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span id={idLibelle} className="text-sm font-semibold text-texte">
              {t('suiviDts.accord.interrupteur')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={actif}
              aria-labelledby={idLibelle}
              disabled={enCours !== null}
              onClick={basculer}
              className="inline-flex min-h-11 min-w-14 shrink-0 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`flex h-7 w-12 items-center rounded-full px-1 transition-colors ${actif ? 'bg-principale' : 'bg-bordure-forte'}`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-texte-sur-principale shadow-doux transition-transform ${actif ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </span>
            </button>
          </div>

          <p className="m-0 mt-2 text-sm text-texte-secondaire">
            {actif
              ? `${t('suiviDts.accord.actif', { date: formatDate.format(new Date(accord.expire_le)) })} ${t('suiviDts.accord.accordePar', { nom: accord.accorde_par.nom })}`
              : t('suiviDts.accord.inactif')}
          </p>

          <fieldset className="m-0 mt-4 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-semibold text-texte">
              {t('suiviDts.accord.duree.groupe')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DUREES_ACCES_SUPPORT.map((choix) => (
                <ChoixDuree
                  key={choix}
                  nom={nomGroupe}
                  duree={choix}
                  coche={duree === choix}
                  bloque={enCours !== null}
                  surChoix={() => setDuree(choix)}
                />
              ))}
            </div>
          </fieldset>

          {actif && (
            <button
              type="button"
              disabled={enCours !== null}
              onClick={() => void accorder(duree)}
              className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}
            >
              {t('suiviDts.accord.renouveler')}
            </button>
          )}
        </>
      )}

      <p role="status" className="m-0 mt-3 min-h-5 text-sm text-succes">
        {messageEtat()}
      </p>
      {erreurAction !== null && (
        <p role="alert" className="m-0 mt-1 text-sm text-erreur">
          {erreurAction.statut === 0 ? t('commun.erreurReseau') : t('suiviDts.accord.erreur')}
        </p>
      )}
    </section>
  )
}