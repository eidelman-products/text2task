import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { absoluteUrl } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing | Text2Task",
  description:
    "View Text2Task pricing plans for turning messy client messages into organized tasks.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing | Text2Task",
    description:
      "View Text2Task pricing plans for turning messy client messages into organized tasks.",
    url: absoluteUrl("/pricing"),
    siteName: "Text2Task",
    type: "website",
  },
};

export default function PricingPage() {
  redirect("/#pricing");
}
