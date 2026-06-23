import Link from "next/link";

export default function HomepageFinalCtaSection() {
  return (
    <section className="border-y border-blue-100 bg-blue-50/70">
      <div className="mx-auto max-w-4xl px-6 py-12 text-center sm:py-14 lg:px-8 lg:py-16">
        <h2 className="homepage-heading text-3xl text-slate-950 sm:text-4xl">
          Turn your next client message into an organized project—without
          retyping.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Start free with 30 AI extracts included. Review and edit every project
          before saving.
        </p>
        <Link
          href="/signup"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-7 text-sm font-bold text-white transition-colors hover:bg-blue-700 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 sm:w-auto"
        >
          <span className="text-white">START FOR FREE</span>
        </Link>
      </div>
    </section>
  );
}
