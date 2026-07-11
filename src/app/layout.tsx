import type { Metadata, Viewport } from "next";
import { Young_Serif, Schibsted_Grotesk } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import { websiteJsonLd } from "@/lib/jsonld";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PwaRegistration from "@/components/PwaRegistration";
import LegacyCookbookMigration from "@/components/LegacyCookbookMigration";
import PortableKitchenProvider from "@/components/PortableKitchenProvider";
import ContributionDeletionBridge from "@/components/ContributionDeletionBridge";
import "./globals.css";

const youngSerif = Young_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-young-serif",
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#d99a16",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${schibsted.variable}`}>
      <body className="min-h-screen flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }} />
        <PortableKitchenProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <LegacyCookbookMigration />
          <ContributionDeletionBridge />
          <PwaRegistration />
        </PortableKitchenProvider>
      </body>
    </html>
  );
}
