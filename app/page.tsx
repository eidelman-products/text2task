import HeroSection from "./components/landing/hero-section";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 42%, #f8fafc 100%)",
      }}
    >
      <HeroSection />
    </main>
  );
}