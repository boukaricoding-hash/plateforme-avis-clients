import { JOUE } from '../constantes'

type Proprietes = {
  // Identifiant unique de cette mascotte, pour les masques de bouche.
  id: string
}

// Tout le visage : joues, yeux, sourcils, bouches et goutte de gene.
export function Visage({ id }: Proprietes) {
  return (
    <>
      <defs>
        <clipPath id={id + '-bouche-content'}>
          <path d="M80 106 Q100 134 120 106 Q100 112 80 106 Z" />
        </clipPath>
        <clipPath id={id + '-bouche-ravi'}>
          <path d="M76 104 Q100 142 124 104 Q100 112 76 104 Z" />
        </clipPath>
      </defs>

      {/* Joues */}
      <g className="mascotte-joues">
        <ellipse cx="57" cy="108" rx="11" ry="6.5" style={{ fill: JOUE }} />
        <ellipse cx="143" cy="108" rx="11" ry="6.5" style={{ fill: JOUE }} />
      </g>

      {/* Yeux ouverts (qui clignent) */}
      <g className="mascotte-v mascotte-v-yeux-ouverts">
        <g className="mascotte-yeux">
          <ellipse cx="78" cy="84" rx="14" ry="16" style={{ fill: 'var(--surface)' }} />
          <ellipse cx="122" cy="84" rx="14" ry="16" style={{ fill: 'var(--surface)' }} />
          <g className="mascotte-pupilles">
            <circle cx="78" cy="86" r="8.5" style={{ fill: 'var(--texte)' }} />
            <circle cx="122" cy="86" r="8.5" style={{ fill: 'var(--texte)' }} />
            <circle cx="75" cy="82.5" r="3" style={{ fill: 'white' }} />
            <circle cx="119" cy="82.5" r="3" style={{ fill: 'white' }} />
            <circle cx="81" cy="90" r="1.4" style={{ fill: 'white', opacity: 0.8 }} />
            <circle cx="125" cy="90" r="1.4" style={{ fill: 'white', opacity: 0.8 }} />
          </g>
        </g>
      </g>

      {/* Yeux fermes qui rient (ravi) */}
      <g className="mascotte-v mascotte-v-ravi">
        <path
          d="M63 90 Q78 70 93 90"
          strokeWidth="5.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />
        <path
          d="M107 90 Q122 70 137 90"
          strokeWidth="5.5"
          strokeLinecap="round"
          style={{ stroke: 'var(--texte)' }}
        />
      </g>

      {/* Sourcils */}
      <g
        className="mascotte-v mascotte-v-attentif"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      >
        <path d="M64 62 Q78 54 92 60" />
        <path d="M108 60 Q122 54 136 62" />
      </g>
      <g
        className="mascotte-v mascotte-v-triste"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      >
        <path d="M64 70 Q78 66 92 58" />
        <path d="M136 70 Q122 66 108 58" />
      </g>
      <g
        className="mascotte-v mascotte-v-ecoute"
        strokeWidth="4.5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      >
        <path d="M66 64 Q78 60 90 63" />
        <path d="M110 58 Q122 52 134 60" />
      </g>

      {/* Bouches */}
      <path
        className="mascotte-v mascotte-v-accueil"
        d="M82 108 Q100 126 118 108"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      />
      <path
        className="mascotte-v mascotte-v-attentif"
        d="M90 114 Q100 120 110 114"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      />
      <g className="mascotte-v mascotte-v-content">
        <path d="M80 106 Q100 134 120 106 Q100 112 80 106 Z" style={{ fill: 'var(--texte)' }} />
        <ellipse
          cx="100"
          cy="119"
          rx="9"
          ry="5"
          clipPath={'url(#' + id + '-bouche-content)'}
          style={{ fill: JOUE }}
        />
      </g>
      <g className="mascotte-v mascotte-v-ravi">
        <path d="M76 104 Q100 142 124 104 Q100 112 76 104 Z" style={{ fill: 'var(--texte)' }} />
        <ellipse
          cx="100"
          cy="124"
          rx="12"
          ry="7"
          clipPath={'url(#' + id + '-bouche-ravi)'}
          style={{ fill: JOUE }}
        />
      </g>
      <path
        className="mascotte-v mascotte-v-triste"
        d="M86 123 Q100 109 114 123"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      />
      <path
        className="mascotte-v mascotte-v-ecoute"
        d="M91 116 Q100 121 109 116"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: 'var(--texte)' }}
      />

      {/* Goutte de gene (triste) */}
      <g className="mascotte-v mascotte-v-triste">
        <path
          className="mascotte-goutte"
          d="M156 56 Q164 70 156 78 Q148 70 156 56 Z"
          style={{ fill: 'var(--info)', opacity: 0.85 }}
        />
      </g>
    </>
  )
}