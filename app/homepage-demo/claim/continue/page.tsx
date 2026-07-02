import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  HOMEPAGE_DEMO_CLAIM_LOGIN_PATH,
} from "@/lib/auth/homepage-demo-auth-intent";
import { createClient } from "@/lib/supabase/server";

import HomepageDemoClaimContinuationClient from "./HomepageDemoClaimContinuationClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saving your project | Text2Task",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function HomepageDemoClaimContinuationPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    redirect(HOMEPAGE_DEMO_CLAIM_LOGIN_PATH);
  }

  return (
    <main style={pageStyle}>
      <HomepageDemoClaimContinuationClient />
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100svh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background:
    "radial-gradient(circle at 50% 0%, rgba(219, 234, 254, 0.9) 0, rgba(219, 234, 254, 0) 34%), linear-gradient(135deg, #f8fbff 0%, #eef5ff 48%, #ffffff 100%)",
  color: "#0f172a",
};
