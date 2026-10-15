'use client';

import { IconContext } from '@phosphor-icons/react';

/* Global icon defaults. Call sites still pass explicit `size`; this only fixes
   the visual weight so every icon in the app shares one stroke language. */
export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: 'regular', color: 'currentColor' }}>
      {children}
    </IconContext.Provider>
  );
}
