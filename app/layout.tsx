import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CrossPlay Hub | Your game. Your community.',
  description: 'A community for gamer profiles, gameplay clips, and connections across platforms.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
