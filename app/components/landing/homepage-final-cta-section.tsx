import Link from "next/link";
import HomepageCtaLink from "./homepage-cta-link.client";

type HomepageFinalCtaSectionProps = Readonly<{
  liveDemoEnabled?: boolean;
}>;

const primaryButtonClassName =
  "mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-7 text-sm font-bold text-white transition-colors hover:bg-blue-700 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 sm:w-auto";
const secondaryButtonClassName =
  "mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-300 bg-white px-7 text-sm font-bold text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 sm:ml-3 sm:mt-7 sm:w-auto";

export default function HomepageFinalCtaSection({
  liveDemoEnabled = false,
}: HomepageFinalCtaSectionProps) {
  return (
    <section className="border-y border-blue-100 bg-blue-50/70">
      <div className="mx-auto max-w-4xl px-6 py-12 text-center sm:py-14 lg:px-8 lg:py-16">
        <h2 className="homepage-heading text-3xl text-slate-950 sm:text-4xl">
          Turn your next client message into an organized project—without
          retyping.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Start free with 30 AI extracts included. Review and edit every
          project before saving.
        </p>

        <div className="sm:flex sm:items-center sm:justify-center">
          <HomepageCtaLink
            href="/signup"
            trackingEvent="final_create_workspace_click"
            className={primaryButtonClassName}
          >
            <span className="text-white">CREATE FREE WORKSPACE</span>
          </HomepageCtaLink>

          {liveDemoEnabled ? (
            <HomepageCtaLink
              href="#homepage-live-demo"
              scrollToLiveDemo
              trackingEvent="final_live_demo_click"
              className={secondaryButtonClassName}
            >
              TRY THE LIVE DEMO
            </HomepageCtaLink>
          ) : (
            <Link href="#demo" className={secondaryButtonClassName}>
              See how it works
            </Link>
          )}
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-500">
          30 free AI extracts. No credit card required.
        </p>
      </div>
    </section>
  );
}
