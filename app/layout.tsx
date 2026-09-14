import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AnalyticsErrorBoundary } from "./components/analytics/analytics-error-boundary";
import { AttributionCapture } from "./components/analytics/attribution-capture";
import { ConsentAwareVercelAnalytics } from "./components/analytics/consent-aware-vercel-analytics";
import { CookieConsentBanner } from "./components/analytics/cookie-consent-banner";
import { GoogleAdsTag } from "./components/analytics/google-ads-tag";
import { MicrosoftClarity } from "./components/analytics/microsoft-clarity";
import {
  SITE_BRAND_NAME,
  SITE_CANONICAL_DESCRIPTION,
  SITE_CANONICAL_URL,
  SITE_ORIGIN,
} from "./lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),

  title: {
    default: "Text2Task | Turn Client Messages Into Tasks",
    template: "%s | Text2Task",
  },

  description: SITE_CANONICAL_DESCRIPTION,

  keywords: [
    "AI CRM",
    "AI task manager",
    "task extraction",
    "client task manager",
    "freelancer CRM",
    "freelance task manager",
    "text to task",
    "screenshot to task",
    "turn client messages into tasks",
    "turn emails into tasks",
    "client work management",
    "client request management",
    "AI tool for freelancers",
    "AI tool for web designers",
    "AI tool for virtual assistants",
    "AI tool for social media managers",
    "WordPress freelancer task manager",
    "Webflow freelancer task manager",
  ],

  applicationName: SITE_BRAND_NAME,
  authors: [{ name: SITE_BRAND_NAME }],
  creator: SITE_BRAND_NAME,
  publisher: SITE_BRAND_NAME,

  category: "Productivity Software",

  openGraph: {
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      SITE_CANONICAL_DESCRIPTION,
    url: SITE_CANONICAL_URL,
    siteName: SITE_BRAND_NAME,
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      SITE_CANONICAL_DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  verification: {
    google: undefined,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${dmSans.variable}`}>
        <GoogleAdsTag />
        <AnalyticsErrorBoundary>
          <MicrosoftClarity />
        </AnalyticsErrorBoundary>
        <AttributionCapture />

        {children}

        <CookieConsentBanner />

        <Toaster position="top-right" richColors closeButton />

        <ConsentAwareVercelAnalytics />
      </body>
    </html>
  );
}
