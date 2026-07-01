import Link from "next/link";

type HomepageHeroProps = Readonly<{
  liveDemoEnabled?: boolean;
}>;

export default function HomepageHero({
  liveDemoEnabled = false,
}: HomepageHeroProps) {
  return (
    <section className="overflow-hidden border-b border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pb-12 sm:pt-16 lg:px-8 lg:pb-14 lg:pt-[4.5rem]">
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
              href={liveDemoEnabled ? "#homepage-live-demo" : "#demo"}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              {liveDemoEnabled ? "Try the live preview" : "Watch demo"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
