import Link from "next/link";
import HomepageCtaLink from "./homepage-cta-link.client";

type HomepageHeroProps = Readonly<{
  liveDemoEnabled?: boolean;
}>;

const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200";
const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100";

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
            Paste an email, WhatsApp message, note, or screenshot. Get a
            reviewable project draft with tasks, deadlines, priorities, and
            budget—before anything is saved.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {liveDemoEnabled ? (
              <>
                <HomepageCtaLink
                  href="#homepage-live-demo"
                  scrollToLiveDemo
                  trackingEvent="hero_live_demo_click"
                  className={primaryButtonClassName}
                >
                  <span className="text-white">TRY THE LIVE DEMO</span>
                </HomepageCtaLink>
                <HomepageCtaLink
                  href="/signup"
                  trackingEvent="hero_create_workspace_click"
                  className={secondaryButtonClassName}
                >
                  CREATE FREE WORKSPACE
                </HomepageCtaLink>
              </>
            ) : (
              <>
                <HomepageCtaLink
                  href="/signup"
                  trackingEvent="hero_create_workspace_click"
                  className={primaryButtonClassName}
                >
                  <span className="text-white">CREATE FREE WORKSPACE</span>
                </HomepageCtaLink>
                <Link href="#demo" className={secondaryButtonClassName}>
                  Watch demo
                </Link>
              </>
            )}
          </div>

          {liveDemoEnabled ? (
            <p className="mt-4 text-sm font-semibold text-slate-500">
              No signup or credit card required for the live demo.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
