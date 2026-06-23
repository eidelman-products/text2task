import Image from "next/image";
import Link from "next/link";

const heroImage = {
  src: "/landing/use-cases/project-managers/project-manager-stakeholder-request-project-flow.png",
  alt: "Text2Task workflow showing a client request becoming an organized project draft for review before the work is saved.",
  width: 1672,
  height: 941,
} as const;

export default function HomepageHero() {
  return (
    <section className="overflow-hidden border-b border-slate-200/80 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-[4.5rem]">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="homepage-heading text-[2.5rem] text-slate-950 sm:text-[3rem] lg:text-[3.35rem] xl:text-[3.55rem]">
            Turn client messages into organized projects and tasks—without
            retyping.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Paste an email, WhatsApp message, note, or screenshot. Text2Task
            extracts the work into a draft you can review, edit, and save.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <span className="text-white">START FOR FREE</span>
            </Link>
            <Link
              href="#demo"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              Watch demo
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-9 max-w-6xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm sm:mt-10">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            width={heroImage.width}
            height={heroImage.height}
            priority
            className="h-auto w-full"
            sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 64px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
          />
        </div>
      </div>
    </section>
  );
}
