import { redirect } from "next/navigation";

export const metadata = {
  title: "Pricing | Text2Task",
  description:
    "View Text2Task pricing plans for turning messy client messages into organized tasks.",
};

export default function PricingPage() {
  redirect("/#pricing");
}