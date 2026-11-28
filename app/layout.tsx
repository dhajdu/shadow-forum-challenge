import type { Metadata } from "next";
import { Archivo, Caveat, Inter } from "next/font/google";
import "./globals.css";

// Neon Noir type: Archivo (condensed, via its width axis) for display, Inter for text.
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-body", display: "swap" });
// Typed signatures (Constitution e-sign) show in a hand-written face.
const signature = Caveat({ subsets: ["latin", "latin-ext"], variable: "--font-signature", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://eoshadowforum.com";
const TITLE = "The Shadow Forum";
const DESCRIPTION = "Into the Shadow — a private Q4 accountability challenge. By invitation only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The Shadow Forum — Race into the shadow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${signature.variable}`}>
      <body>{children}</body>
    </html>
  );
}
