import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { themeInitScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:1994";
const description =
  "NodeDR POS, küçük perakende mağazaları için ücretsiz, açık kaynaklı, çevrimdışı çalışan Satış Noktası ve stok yönetim sistemidir. Abonelik yok, internet gerekmez.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NodeDR POS | Çevrimdışı Satış Noktası & Stok Yönetimi",
    template: "%s | NodeDR POS",
  },
  description,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "NodeDR POS",
    title: "NodeDR POS | Çevrimdışı Satış Noktası & Stok Yönetimi",
    description,
  },
  twitter: {
    card: "summary",
    title: "NodeDR POS | Çevrimdışı Satış Noktası & Stok Yönetimi",
    description,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "NodeDR POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Windows, Linux, Docker",
  description,
  url: "https://github.com/Raktim94/nodedr-pos",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "TRY",
  },
  publisher: {
    "@type": "Organization",
    name: "Nodedr Infotech Private Limited",
    url: "https://www.nodedr.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
