import { useId, useState } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ActionRevocation } from '../hooks/utiliser-qr-codes'
import { adresseQr } from '../services/qr-codes'
import type { FormatQr, LigneQr, TailleChevalet } from '../types/qr-codes'
import { TYPES_POINT_CONTACT } from '../types/sites-points'

// Carte d'un QR code (ecran E11, jour 17) : apercu, chiffres, telechargements et, pour le
// Responsable, revocation ou regeneration avec confirmation.
// - Un QR valide : apercu PNG (charge au defilement), liens PNG, SVG, PDF A6 et PDF A5.
// - Un QR revoque : plus d'apercu ni de lien (le serveur repond 409 QR_REVOQUE), mais l'historique
//   (scans, avis) reste visible. Seule la regeneration le remet en service.
// - Revoquer : le chevalet deja imprime affiche "QR code desactive".
//   Regenerer : un nouveau code remplace l'ancien, le chevalet deja imprime n'est plus reconnu.
// Ce composant n'appelle pas l'API : l'action vient de utiliserQrCodes. Ici on garde seulement
// la confirmation en cours. Le code public du point n'est jamais affiche.

type Proprietes = {
  ligne: LigneQr
  // Vrai pour le Responsable : lui seul voit les boutons Revoquer et Regenerer.
  peutModifier: boolean
  // Augmente a chaque regeneration du QR de ce point : l'apercu se recharge.
  versionQr: number
  revocation: ActionRevocation
}

// Largeur de l'apercu en pixels : assez net pour un ecran, leger a charger.
const LARGEUR_APERCU = 256

type Telechargement = {
  cle: string
  format: FormatQr
  taille?: TailleChevalet
  libelle: string
}

const TELECHARGEMENTS: Telechargement[] = [
  { cle: 'png', format: 'png', libelle: 'PNG' },
  { cle: 'svg', format: 'svg', libelle: 'SVG' },
  { cle: 'pdf-a6', format: 'pdf', taille: 'A6', libelle: 'PDF A6' },
  { cle: 'pdf-a5', format: 'pdf', taille: 'A5', libelle: 'PDF A5' },
]

type Confirmation = 'aucune' | 'revoquer' | 'regenerer'

const CLASSE_BOUTON =
  'min-h-11 rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte transition-colors hover:bg-accent-fond disabled:cursor-not-allowed disabled:opacity-60'

// Un chiffre des statistiques : le nombre, ou "—" si on n'a pas de donnee (jamais 0 a la place).
function texteChiffre(valeur: number | null | undefined, langue: string): string {
  if (valeur === null || valeur === undefined) {
    return '—'
  }
  return valeur.toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR')
}

export function CarteQr({ ligne, peutModifier, versionQr, revocation }: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()
  const idConfirmation = useId()
  const [confirmation, setConfirmation] = useState<Confirmation>('aucune')

  const { point, statistiques } = ligne
  const revoque = point.revoque_le !== null

  const libelleType = (TYPES_POINT_CONTACT as readonly string[]).includes(point.type)
    ? t(`sites.types.${point.type}`)
    : point.type
  const soustitre = point.zone !== null ? `${libelleType} · ${point.zone}` : libelleType

  const tauxConversion =
    statistiques !== null && statistiques.taux_conversion !== null
      ? `${texteChiffre(statistiques.taux_conversion, langue)} %`
      : '—'

  async function confirmer(regenerer: boolean): Promise<void> {
    const reussi = await revocation.changer(point.id, regenerer)
    if (reussi) {
      setConfirmation('aucune')
    }
  }

  // Le resultat de la derniere action ne s'affiche que sur la carte concernee.
  const concerne = revocation.pointId === point.id
  let messageErreur: string | null = null
  if (concerne && revocation.erreur !== null) {
    if (revocation.erreur.statut === 0) {
      messageErreur = t('commun.erreurReseau')
    } else if (revocation.erreur.statut === 403) {
      messageErreur = t('qrCodes.carte.erreurDroits')
    } else if (revocation.erreur.statut === 404) {
      messageErreur = t('qrCodes.carte.erreurIntrouvable')
    } else {
      messageErreur = t('qrCodes.carte.erreur')
    }
  }
  let messageSucces = ''
  if (concerne && revocation.succes && revocation.resultat !== null) {
    messageSucces =
      revocation.resultat.action === 'regenere'
        ? t('qrCodes.carte.succesRegenere')
        : t('qrCodes.carte.succesRevoque')
  }

  return (
    <article
      aria-labelledby={idTitre}
      className="flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-5 shadow-doux"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={idTitre} className="m-0 font-titre text-lg font-bold text-texte">
            {point.nom}
          </h3>
          <p className="m-0 text-sm text-texte-secondaire">{soustitre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold ${
              revoque ? 'text-erreur' : 'text-succes'
            }`}
          >
            {revoque ? t('qrCodes.carte.statutRevoque') : t('qrCodes.carte.statutValide')}
          </span>
          {!point.actif && (
            <span className="rounded-full border border-bordure px-2 py-0.5 text-xs font-semibold text-texte-secondaire">
              {t('qrCodes.carte.pointDesactive')}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-4">
        {/* Apercu : fond blanc pour que le QR reste lisible en theme sombre */}
        {revoque ? (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md border border-bordure bg-fond-alt p-2 text-center text-xs font-semibold text-texte-secondaire">
            {t('qrCodes.carte.qrIndisponible')}
          </div>
        ) : (
          <img
            key={`${point.id}-${versionQr}`}
            src={adresseQr(point.id, 'png', { largeur: LARGEUR_APERCU })}
            alt={t('qrCodes.carte.apercu', { nom: point.nom })}
            loading="lazy"
            width={128}
            height={128}
            className="h-32 w-32 shrink-0 rounded-md border border-bordure bg-white p-1"
          />
        )}

        <dl className="m-0 grid min-w-56 flex-1 grid-cols-3 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-texte-secondaire">
              {t('qrCodes.carte.scans')}
            </dt>
            <dd className="m-0 text-lg font-bold text-texte">
              {texteChiffre(statistiques?.nb_scans, langue)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-texte-secondaire">
              {t('qrCodes.carte.avis')}
            </dt>
            <dd className="m-0 text-lg font-bold text-texte">
              {texteChiffre(statistiques?.nb_avis, langue)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-texte-secondaire">
              {t('qrCodes.carte.tauxConversion')}
            </dt>
            <dd className="m-0 text-lg font-bold text-texte">{tauxConversion}</dd>
          </div>
        </dl>
      </div>

      {/* Telechargements : seulement pour un QR valide */}
      {revoque ? (
        <p className="m-0 text-sm text-texte-secondaire">{t('qrCodes.carte.revoqueExplication')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {TELECHARGEMENTS.map((fichier) => (
            <a
              key={fichier.cle}
              href={adresseQr(point.id, fichier.format, { taille: fichier.taille })}
              download
              aria-label={t('qrCodes.carte.telecharger', {
                nom: point.nom,
                format: fichier.libelle,
              })}
              className="inline-flex min-h-11 items-center rounded-md border border-bordure-champ px-3 text-sm font-semibold text-texte no-underline transition-colors hover:bg-accent-fond"
            >
              {fichier.libelle}
            </a>
          ))}
        </div>
      )}

      {/* Revoquer ou regenerer : Responsable seulement */}
      {peutModifier && confirmation === 'aucune' && (
        <div className="flex flex-wrap gap-2">
          {!revoque && (
            <button
              type="button"
              disabled={revocation.enCours}
              onClick={() => setConfirmation('revoquer')}
              className={CLASSE_BOUTON}
            >
              {t('qrCodes.carte.revoquer')}
            </button>
          )}
          <button
            type="button"
            disabled={revocation.enCours}
            onClick={() => setConfirmation('regenerer')}
            className={CLASSE_BOUTON}
          >
            {t('qrCodes.carte.regenerer')}
          </button>
        </div>
      )}

      {peutModifier && confirmation !== 'aucune' && (
        <div
          role="group"
          aria-labelledby={idConfirmation}
          className="flex flex-col gap-3 rounded-md border border-erreur bg-fond-alt p-3"
        >
          <p id={idConfirmation} className="m-0 text-sm text-texte">
            {confirmation === 'regenerer'
              ? t('qrCodes.carte.confirmationRegenerer', { nom: point.nom })
              : t('qrCodes.carte.confirmationRevoquer', { nom: point.nom })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={revocation.enCours}
              aria-busy={revocation.enCours}
              onClick={() => void confirmer(confirmation === 'regenerer')}
              className="min-h-11 rounded-md bg-erreur px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revocation.enCours
                ? t('qrCodes.carte.enCours')
                : confirmation === 'regenerer'
                  ? t('qrCodes.carte.confirmerRegenerer')
                  : t('qrCodes.carte.confirmerRevoquer')}
            </button>
            <button
              type="button"
              disabled={revocation.enCours}
              onClick={() => setConfirmation('aucune')}
              className={CLASSE_BOUTON}
            >
              {t('qrCodes.carte.annuler')}
            </button>
          </div>
        </div>
      )}

      <p role="status" className="m-0 min-h-5 text-sm text-succes">
        {messageSucces}
      </p>
      {messageErreur !== null && (
        <p role="alert" className="m-0 text-sm text-erreur">
          {messageErreur}
        </p>
      )}
    </article>
  )
}