import { QuestionChoixMultiple } from './question-choix-multiple'
import { QuestionChoixUnique } from './question-choix-unique'
import { QuestionEchelle } from './question-echelle'
import { QuestionEmojis } from './question-emojis'
import { QuestionEtoiles } from './question-etoiles'
import { QuestionNps } from './question-nps'
import { QuestionOuiNon } from './question-oui-non'
import { QuestionTexteLibre } from './question-texte-libre'
import type { ProprietesQuestion } from './types-question'

// Choisit le bon composant selon le type de la question.
// L'ecran de question (etape 7) n'a qu'a utiliser ce composant.
export function QuestionParType(proprietes: ProprietesQuestion) {
  switch (proprietes.question.type) {
    case 'ETOILES':
      return <QuestionEtoiles {...proprietes} />
    case 'EMOJIS':
      return <QuestionEmojis {...proprietes} />
    case 'NPS':
      return <QuestionNps {...proprietes} />
    case 'CHOIX_UNIQUE':
      return <QuestionChoixUnique {...proprietes} />
    case 'CHOIX_MULTIPLE':
      return <QuestionChoixMultiple {...proprietes} />
    case 'OUI_NON':
      return <QuestionOuiNon {...proprietes} />
    case 'ECHELLE':
      return <QuestionEchelle {...proprietes} />
    case 'TEXTE_LIBRE':
      return <QuestionTexteLibre {...proprietes} />
    default:
      // Type inconnu (ne devrait pas arriver) : on n'affiche rien plutot que de planter.
      return null
  }
}