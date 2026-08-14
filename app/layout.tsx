import type { Metadata } from "next";
import Script from "next/script";
import { MedievalSharp, Merriweather, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AdBanner } from "@/components/ads/AdBanner";
import "./globals.css";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

const medievalSharp = MedievalSharp({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const merriweather = Merriweather({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gnomehome.gg";

export const metadata: Metadata = {
  title: {
    default: "Gn0me Home — OSRS Clan",
    template: "%s | Gn0me Home",
  },
  description:
    "Gn0me Home is an Old School RuneScape clan focused on PvM, community events, and good times. All levels welcome.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    siteName: "Gn0me Home",
    title: "Gn0me Home — OSRS Clan",
    description:
      "An Old School RuneScape clan focused on PvM, community events, and good times. All levels welcome.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gn0me Home — OSRS Clan",
    description:
      "An Old School RuneScape clan focused on PvM, community events, and good times.",
  },
  keywords: [
    "OSRS",
    "Old School RuneScape",
    "clan",
    "Gn0me Home",
    "PvM",
    "raids",
    "bosses",
    "community",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${medievalSharp.variable} ${merriweather.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {ADSENSE_CLIENT_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <Navbar />
        <main className="flex-1">{children}</main>
        <AdBanner />
        <Footer />
      </body>
    </html>
  );
}
