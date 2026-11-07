import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { utiliserLangue } from '../hooks/utiliser-langue'
import type { ErreurService } from '../services/api'
import { adresseQr } from '../services/qr-codes'
import type { FormatQr, LigneQr, TailleChevalet } from '../types/qr-codes'
import { TYPES_POINT_CONTACT } from '../types/sites-points'
import { BoutonTelecharger } from './bouton-telecharger'
import type { OptionTelechargement } from './bouton-telecharger'

// Carte d'honneur de l'ecran E11 (QR codes et chevalets) : le QR code du point selectionne.
// - Un QR valide : apercu PNG (squelette qui brille puis fondu a l'arrivee de l'image), chiffres,
//   bouton Telecharger (menu des formats a la demande) et, pour le Responsable, Regenerer.
// - Un QR revoque : plus d'apercu ni de telechargement (le serveur repond 409 QR_REVOQUE), mais
//   l'historique (scans, avis) reste visible. Seule la regeneration le remet en service.
// - Pendant une revocation ou une regeneration : l'apercu est voile, un cercle tourne et une
//   ligne balaie le QR. La confirmation et l'action elles-memes se font depuis la page.
// Ce composant n'appelle pas l'API. Le code public du point n'est jamais affiche.

type ActionEnCours = 'revoquer' | 'regenerer' | null

type Proprietes = {
  ligne: LigneQr
  // Vrai pour le Responsable : lui seul voit le bouton Regenerer.
  peutModifier: boolean
  // Augmente a chaque regeneration du QR de ce point : l'apercu se recharge.
  versionQr: number
  // Action en cours sur ce point (voile sur l'apercu), sinon null.
  actionEnCours: ActionEnCours
  surRegenerer: () => void
  surTelecharge: (nomFichier: string) => void
  surEchecTelechargement: (erreur: ErreurService) => void
}

// Largeur de l'apercu en pixels : assez net pour un ecran, leger a charger.
const LARGEUR_APERCU = 256

// Formats proposes dans le menu de telechargement : le menu est construit depuis cette liste.
type FormatTelechargement = {
  cle: string
  format: FormatQr
  taille?: TailleChevalet
  libelle: string
  // Cle de traduction de la precision affichee a droite du libelle.
  cleDetail: string
  extension: string
}

const FORMATS_TELECHARGEMENT: FormatTelechargement[] = [
  {
    cle: 'png',
    format: 'png',
    libelle: 'PNG',
    cleDetail: 'qrCodes.telechargement.detailImage',
    extension: 'png',
  },
  {
    cle: 'svg',
    format: 'svg',
    libelle: 'SVG',
    cleDetail: 'qrCodes.telechargement.detailVectoriel',
    extension: 'svg',
  },
  {
    cle: 'pdf-a6',
    format: 'pdf',
    taille: 'A6',
    libelle: 'PDF A6',
    cleDetail: 'qrCodes.telechargement.detailChevalet',
    extension: 'pdf',
  },
  {
    cle: 'pdf-a5',
    format: 'pdf',
    taille: 'A5',
    libelle: 'PDF A5',
    cleDetail: 'qrCodes.telechargement.detailChevalet',
    extension: 'pdf',
  },
]

// Un chiffre des statistiques : le nombre, ou "—" si on n'a pas de donnee (jamais 0 a la place).
function texteChiffre(valeur: number | null | undefined, langue: string): string {
  if (valeur === null || valeur === undefined) {
    return '—'
  }
  return valeur.toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR')
}

function IconeRegenerer() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
      <polyline points="4 3 4 8 9 8" />
      <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
      <polyline points="20 21 20 16 15 16" />
    </svg>
  )
}

// Voile pose sur l'apercu pendant une action : on sent que quelque chose se passe.
function VoileAction({ libelle }: { libelle: string }) {
  return (
    <div className="qr-apercu-voile" role="status">
      <span className="qr-apercu-balayage" aria-hidden="true" />
      <span className="qr-spinner qr-spinner--grand" aria-hidden="true" />
      {libelle}
    </div>
  )
}

type ProprietesApercu = {
  adresse: string
  texteAlternatif: string
  textePasDImage: string
  libelleVoile: string | null
}

// Apercu du QR : l'etat de chargement de l'image vit ici. Le composant est recree (cle) quand
// le point ou la version du QR change, donc chaque nouvelle image repart du squelette.
function ApercuQr({ adresse, texteAlternatif, textePasDImage, libelleVoile }: ProprietesApercu) {
  const [etat, setEtat] = useState<'chargement' | 'charge' | 'echec'>('chargement')

  if (etat === 'echec') {
    return (
      <div className="qr-apercu-cadre qr-apercu-cadre--revoque">
        {textePasDImage}
        {libelleVoile !== null && <VoileAction libelle={libelleVoile} />}
      </div>
    )
  }

  return (
    <div className="qr-apercu-cadre">
      {etat === 'chargement' && <span className="qr-apercu-squelette" aria-hidden="true" />}
      <img
        src={adresse}
        alt={texteAlternatif}
        width={156}
        height={156}
        onLoad={() => setEtat('charge')}
        onError={() => setEtat('echec')}
        className={`qr-apercu-img${etat === 'charge' ? ' qr-apercu-img--charge' : ''}`}
      />
      {libelleVoile !== null && <VoileAction libelle={libelleVoile} />}
    </div>
  )
}

export function CarteQr({
  ligne,
  peutModifier,
  versionQr,
  actionEnCours,
  surRegenerer,
  surTelecharge,
  surEchecTelechargement,
}: Proprietes) {
  const { t, langue } = utiliserLangue()
  const idTitre = useId()

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

  const chiffres = [
    { cle: 'scans', libelle: t('qrCodes.carte.scans'), valeur: texteChiffre(statistiques?.nb_scans, langue) },
    { cle: 'avis', libelle: t('qrCodes.carte.avis'), valeur: texteChiffre(statistiques?.nb_avis, langue) },
    { cle: 'taux', libelle: t('qrCodes.carte.tauxCourt'), valeur: tauxConversion },
  ]

  let libelleVoile: string | null = null
  if (actionEnCours === 'regenerer') {
    libelleVoile = t('qrCodes.carte.generation')
  } else if (actionEnCours === 'revoquer') {
    libelleVoile = t('qrCodes.carte.revocation')
  }

  // Les formats de telechargement, construits a partir de la liste ci-dessus.
  const options: OptionTelechargement[] = FORMATS_TELECHARGEMENT.map((fichier) => ({
    cle: fichier.cle,
    libelle: fichier.libelle,
    detail: t(fichier.cleDetail),
    libelleAccessible: t('qrCodes.carte.telecharger', { nom: point.nom, format: fichier.libelle }),
    adresse: adresseQr(point.id, fichier.format, { taille: fichier.taille }),
    nomParDefaut: `${point.nom}.${fichier.extension}`,
  }))

  const occupe = actionEnCours !== null
  const libelleRuban = (revoque ? t('qrCodes.ligne.revoque') : t('qrCodes.ligne.valide')).toLocaleUpperCase(
    langue,
  )

  return (
    <article className="qr-carte-principale" aria-labelledby={idTitre}>
      <span className="qr-ruban-zone">
        <span className={`qr-ruban${revoque ? ' qr-ruban--revoque' : ''}`}>{libelleRuban}</span>
      </span>

      {revoque ? (
        <div className="qr-apercu-cadre qr-apercu-cadre--revoque">
          {t('qrCodes.carte.qrIndisponible')}
          {libelleVoile !== null && <VoileAction libelle={libelleVoile} />}
        </div>
      ) : (
        <ApercuQr
          key={`${point.id}-${versionQr}`}
          adresse={`${adresseQr(point.id, 'png', { largeur: LARGEUR_APERCU })}&v=${versionQr}`}
          texteAlternatif={t('qrCodes.carte.apercu', { nom: point.nom })}
          textePasDImage={t('qrCodes.carte.qrIndisponible')}
          libelleVoile={libelleVoile}
        />
      )}

      <h3 id={idTitre} className="qr-carte-nom">
        {point.nom}
      </h3>
      <p className="qr-carte-soustitre">{soustitre}</p>

      {!point.actif && (
        <div className="qr-carte-badges">
          <span className="qr-badge qr-badge--inactif">{t('qrCodes.carte.pointDesactive')}</span>
        </div>
      )}

      <div className="qr-stats">
        {chiffres.map((chiffre, index) => (
          <div key={chiffre.cle} className="qr-stat" style={{ '--i': index } as CSSProperties}>
            <span className="qr-stat-valeur">{chiffre.valeur}</span>
            <span className="qr-stat-libelle">{chiffre.libelle}</span>
          </div>
        ))}
      </div>

      {revoque && <p className="qr-carte-explication">{t('qrCodes.carte.revoqueExplication')}</p>}

      <div className="qr-carte-actions">
        {!revoque && (
          <BoutonTelecharger
            libelle={t('qrCodes.telechargement.bouton')}
            options={options}
            desactive={occupe}
            surSucces={surTelecharge}
            surEchec={surEchecTelechargement}
          />
        )}
        {peutModifier && (
          <button
            type="button"
            disabled={occupe}
            onClick={surRegenerer}
            className={revoque ? 'qr-bouton-principal' : 'qr-bouton-secondaire'}
          >
            <IconeRegenerer />
            {t('qrCodes.carte.regenerer')}
          </button>
        )}
      </div>
    </article>
  )
}