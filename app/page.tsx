"use client";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import HeroSection from "@/app/components/landing/hero-section";
import PreviewGridSection from "@/app/components/landing/preview-grid-section";
import ProductPreviewSection from "@/app/components/landing/product-preview-section";
import TrustSection from "@/app/components/landing/trust-section";
import PricingSection from "@/app/components/landing/pricing-section";
import Footer from "@/app/components/landing/footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export default function Home() {
  function signInWithGoogle() {
    window.location.href = "/api/auth/login";
  }

  return (
    <main
      className={inter.className}
      style={{
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 40%, #f8fafc 100%)",
        minHeight: "100vh",
        padding: 0,
        margin: 0,
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "80px 24px 60px",
        }}
      >
        <HeroSection
          jakartaClassName={jakarta.className}
          onSignIn={signInWithGoogle}
        />

        <PreviewGridSection jakartaClassName={jakarta.className} />

        <ProductPreviewSection jakartaClassName={jakarta.className} />

        <TrustSection jakartaClassName={jakarta.className} />

        <PricingSection
          jakartaClassName={jakarta.className}
          onSignIn={signInWithGoogle}
        />

        <Footer jakartaClassName={jakarta.className} />
      </section>
    </main>
  );
}