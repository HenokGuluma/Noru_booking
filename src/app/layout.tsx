import type { Metadata } from 'next';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Body face — matches the haulwise-fullstack reference project, per explicit
// request. IBM Plex Sans Ethiopic stays as the Amharic companion (see
// globals.css --geez): it's not metric-matched to Inter the way it was to
// Plex Sans, so mixed-script lines won't share a baseline pixel-for-pixel,
// but Inter + Noto/Plex Ethiopic is a common, well-regarded pairing in real
// Ethiopian products and reads fine. Flagging the tradeoff rather than
// silently dropping the guarantee CLAUDE.md documents for the Plex pairing.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

// Headings, nav labels, KPI values — bold and confident, same role Manrope
// plays in haulwise-fullstack.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Noru Crew',
    template: '%s · Noru Crew',
  },
  description: "Staff operations for Noru Booking's hotels in Ethiopia.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23093F36'/%3E%3Ctext x='50' y='63' font-family='Georgia,serif' font-weight='700' font-size='40' fill='%2317A98C' text-anchor='middle'%3ENC%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- next/font/google has no
            typed export for this face; loaded manually as the Amharic companion face. */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Ethiopic:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
