import type { Metadata, Viewport } from 'next';
import { EB_Garamond } from 'next/font/google';
import './globals.css';

const ebGaramond = EB_Garamond({
  variable: '--font-eb-garamond',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'An',
  description: 'Yêu An nhất trên thế giới',
};

export const viewport: Viewport = {
  themeColor: '#fcf9f8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${ebGaramond.variable} antialiased`}>
        <div className="paper-grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
