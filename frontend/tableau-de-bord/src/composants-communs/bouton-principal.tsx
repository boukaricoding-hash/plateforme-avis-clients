import type { ComponentPropsWithoutRef } from 'react'

type Proprietes = Omit<ComponentPropsWithoutRef<'button'>, 'className'> & {
  // Vrai pendant l'envoi : le bouton est bloque pour eviter un double clic.
  enCours?: boolean
}

// Bouton "contour" : trait fin, fond vide, il se remplit quand le curseur passe dessus.
export function BoutonPrincipal({
  enCours = false,
  disabled,
  type = 'button',
  children,
  ...reste
}: Proprietes) {
  return (
    <button
      {...reste}
      type={type}
      disabled={disabled === true || enCours}
      aria-busy={enCours}
      className="min-h-11 w-full rounded-[5px] border border-principale bg-transparent px-4 text-base font-semibold text-principale transition-colors hover:bg-principale hover:text-texte-sur-principale disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-principale"
    >
      {children}
    </button>
  )
}