import type { ComponentPropsWithoutRef } from 'react'

type Proprietes = Omit<ComponentPropsWithoutRef<'button'>, 'className'> & {
  // Vrai pendant l'envoi : le bouton est bloque pour eviter un double clic.
  enCours?: boolean
}

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
      className="min-h-11 w-full rounded-md bg-principale px-4 text-base font-semibold text-texte-sur-principale transition-colors hover:bg-principale-fonce disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}