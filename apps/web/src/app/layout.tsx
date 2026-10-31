import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Nexo Assist',
  description: 'Diagnóstico de conexão da fundação técnica.',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
