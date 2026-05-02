import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://www.text2task.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Text2Task | Turn Client Messages Into Tasks",
    template: "%s | Text2Task",
  },

  description:
    "Text2Task turns messy client messages, emails, notes, and screenshots into organized tasks with deadlines, budgets, client details, phone numbers, emails, and priorities.",

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

  applicationName: "Text2Task",
  authors: [{ name: "Text2Task" }],
  creator: "Text2Task",
  publisher: "Text2Task",

  category: "Productivity Software",

  openGraph: {
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      "Turn messy client messages, emails, notes, and screenshots into clean structured tasks with deadlines, budgets, client details, and priorities.",
    url: siteUrl,
    siteName: "Text2Task",
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      "AI CRM for freelancers and small teams. Turn messy client messages, emails, notes, and screenshots into structured tasks in seconds.",
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
      <body className={inter.className}>
        {children}

        <Toaster position="top-right" richColors closeButton />

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}