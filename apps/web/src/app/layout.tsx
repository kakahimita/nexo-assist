import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@fontsource/newsreader/400.css';
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/500.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/schibsted-grotesk/700.css';
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
