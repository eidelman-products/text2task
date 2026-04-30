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

export const metadata: Metadata = {
  title: {
    default: "Text2Task | Turn Messy Client Messages Into Tasks",
    template: "%s | Text2Task",
  },
  description:
    "Text2Task is an AI CRM that turns messy client messages, emails, screenshots, and notes into structured tasks with clients, deadlines, budgets, and priorities.",
  keywords: [
    "AI CRM",
    "task extraction",
    "client task manager",
    "freelancer CRM",
    "AI task manager",
    "text to task",
    "screenshot to task",
  ],
  applicationName: "Text2Task",
  authors: [{ name: "Text2Task" }],
  creator: "Text2Task",
  publisher: "Text2Task",
  metadataBase: new URL("https://text2task.com"),
  openGraph: {
    title: "Text2Task | Turn Messy Client Messages Into Tasks",
    description:
      "Extract clients, tasks, budgets, deadlines, and priorities from text or screenshots — then manage everything in a clean CRM-style workspace.",
    url: "https://text2task.com",
    siteName: "Text2Task",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Text2Task | Turn Messy Client Messages Into Tasks",
    description:
      "AI CRM for freelancers and small teams. Turn messy client messages into structured tasks in seconds.",
  },
  robots: {
    index: true,
    follow: true,
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