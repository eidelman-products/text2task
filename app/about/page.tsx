import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import LandingFooter from "../components/landing/landing-footer";
import LandingHeader from "../components/landing/landing-header";
import { absoluteUrl } from "../lib/site-config";
import AboutReturnLink from "./about-return-link";

const pageTitle = "About Text2Task | Our Story and Product Principles";
const pageDescription =
  "Learn why Text2Task was built, the product principles behind its review-first workflow, and the independent story shaping its development.";

export const metadata: Metadata = {
  title: {
    absolute: pageTitle,
  },
  description: pageDescription,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: absoluteUrl("/about"),
    siteName: "Text2Task",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const founderImages = {
  portrait: {
    src: "/landing/about/text2task-founder-portrait.png",
    alt: "Founder and independent builder of Text2Task",
    width: 1254,
    height: 1254,
  },
  working: {
    src: "/landing/about/text2task-founder-working.png",
    alt: "The founder of Text2Task working on the product",
    width: 1184,
    height: 896,
  },
  standing: {
    src: "/landing/about/text2task-founder-standing.png",
    alt: "The founder of Text2Task in a modern workspace",
    width: 1122,
    height: 1402,
  },
} as const;

const productPrinciples = [
  {
    title: "Clarity over automation",
    text: "The goal is not to automate every decision. The goal is to make the work easier to understand and act on.",
  },
  {
    title: "Review before save",
    text: "Extracted work remains editable so the person managing the project stays in control of what becomes part of the workspace.",
  },
  {
    title: "Built for real intake",
    text: "Client requests are often incomplete, mixed together, and spread across different formats. The product is designed around that reality.",
  },
  {
    title: "Practical by design",
    text: "Text2Task focuses on useful project structure, clear next steps, and less time spent repeatedly copying information between messages and project tools.",
  },
] as const;

const journeyStages = [
  {
    title: "From messages to structured projects",
    text: "Identify the useful details inside text and supported images, then turn them into a project draft and actionable tasks.",
  },
  {
    title: "From a draft to a working client workspace",
    text: "Review projects, tasks, deadlines, client details, updates, and resources in one organized place.",
  },
  {
    title: "Toward a clearer ongoing workflow",
    text: "Continue reducing repetitive client-work administration while keeping review and final decisions with the user.",
  },
] as const;

const audiences = [
  "Freelancers",
  "Small agencies",
  "Web designers and developers",
  "Graphic designers and social media managers",
  "Virtual assistants",
  "Project managers",
  "Other client-service professionals",
] as const;

const supportEmail = "support@text2task.com";

const trustPoints = [
  {
    title: "User-controlled review",
    text: "Nothing needs to be saved before the extracted work has been reviewed.",
  },
  {
    title: "Ongoing product development",
    text: "The product continues to evolve around real client-service workflows.",
  },
  {
    title: "Direct support",
    text: "Questions and product issues can be sent to support.",
  },
] as const;

export default function AboutPage() {
  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: pageTitle,
    description: pageDescription,
    url: absoluteUrl("/about"),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "Text2Task",
      url: absoluteUrl("/"),
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Text2Task",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
    },
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <LandingHeader />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
        />

        <section className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <Suspense fallback={null}>
                <AboutReturnLink />
              </Suspense>

              <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-blue-700 first:mt-0">
                About Text2Task
              </p>

              <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-[4.75rem] lg:leading-[0.96]">
                More efficient client work starts with Text2Task.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Text2Task is an independently built SaaS product that turns
                scattered client communication into clear, reviewable projects
                and tasks—so less time is spent copying details and more time
                can go into the work itself.
              </p>

              <p className="mt-7 border-l-2 border-blue-600 pl-5 text-base font-black text-slate-950">
                Built independently.
              </p>

              <Link
                href="/#how-it-works"
                className="mt-8 inline-flex text-sm font-black text-blue-700 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
              >
                See how Text2Task works {"\u2192"}
              </Link>
            </div>

            <figure className="relative mx-auto w-full max-w-[560px] lg:ml-auto">
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100">
                <Image
                  src={founderImages.portrait.src}
                  alt={founderImages.portrait.alt}
                  width={founderImages.portrait.width}
                  height={founderImages.portrait.height}
                  priority
                  className="aspect-[4/5] h-auto w-full object-cover object-center sm:aspect-square lg:aspect-[4/5]"
                  sizes="(min-width: 1280px) 520px, (min-width: 1024px) 44vw, calc(100vw - 48px)"
                />
              </div>
            </figure>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                Our mission
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Make client work easier to understand and faster to organize.
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                The problem is not that the work is missing. It is that the work
                is buried inside messages, screenshots, revisions, links,
                deadlines, and follow-ups. Text2Task exists to turn that noise
                into a clear starting point without rebuilding every project and
                task list by hand.
              </p>

              <div className="mx-auto my-10 h-px w-24 bg-blue-600" />

              <p className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
                Clarity before automation.
              </p>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                AI should help structure the work. The final decision should
                remain with the user.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-2xl lg:order-2">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                The story behind the product
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Built from a simple frustration with messy client work.
              </h2>
              <div className="mt-7 space-y-5 text-lg leading-8 text-slate-600">
                <p>
                  Too much useful work still begins in places that were never
                  designed to manage it: inboxes, WhatsApp threads, screenshots,
                  and notes. The important details are there, but the structure
                  is not.
                </p>
                <p>
                  I built Text2Task to reduce the time spent manually copying
                  client requests into project systems. AI helps organize the
                  information into a workable draft, while the user reviews and
                  decides what gets saved.
                </p>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-500">
                  Founder and independent builder of Text2Task
                </p>
              </div>
            </div>

            <figure className="lg:order-1">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <Image
                  src={founderImages.working.src}
                  alt={founderImages.working.alt}
                  width={founderImages.working.width}
                  height={founderImages.working.height}
                  className="h-auto w-full object-cover object-center"
                  sizes="(min-width: 1280px) 560px, (min-width: 1024px) 44vw, calc(100vw - 48px)"
                />
              </div>
            </figure>
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-300">
                What guides the product
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Useful AI should make work clearer, not make decisions
                disappear.
              </h2>
            </div>

            <div className="mt-12 grid gap-x-12 gap-y-0 md:grid-cols-2">
              {productPrinciples.map((principle, index) => (
                <article
                  key={principle.title}
                  className="border-t border-white/15 py-7"
                >
                  <p className="text-sm font-black text-blue-300">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-4 text-2xl font-black tracking-tight text-white">
                    {principle.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
                    {principle.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:px-8 lg:py-24">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                How Text2Task is evolving
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                One focused problem, a broader working system.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Text2Task started with one job: turn scattered client
                communication into structured work. The product continues to
                grow around that same core problem.
              </p>

              <div className="mt-10 border-y border-slate-200">
                {journeyStages.map((stage, index) => (
                  <article
                    key={stage.title}
                    className="grid gap-4 border-b border-slate-200 py-6 last:border-b-0 sm:grid-cols-[96px_1fr]"
                  >
                    <p className="text-sm font-black text-blue-700">
                      Stage {index + 1}
                    </p>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-slate-950">
                        {stage.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        {stage.text}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <figure className="lg:pt-8">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <Image
                  src={founderImages.standing.src}
                  alt={founderImages.standing.alt}
                  width={founderImages.standing.width}
                  height={founderImages.standing.height}
                  className="aspect-[4/5] h-auto w-full object-cover object-center"
                  sizes="(min-width: 1280px) 420px, (min-width: 1024px) 34vw, calc(100vw - 48px)"
                />
              </div>
            </figure>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                  Who it is built for
                </p>
                <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  People who turn requests into deliverables.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                  Text2Task is designed for professionals who regularly receive
                  client instructions and need to turn them into clear,
                  manageable work.
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-3">
                  {audiences.map((audience) => (
                    <span
                      key={audience}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800"
                    >
                      {audience}
                    </span>
                  ))}
                </div>
                <p className="mt-8 border-t border-slate-200 pt-6 text-lg font-black leading-8 text-slate-950">
                  Different services, same recurring problem: the work arrives
                  in communication before it becomes a plan.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                Built for long-term use
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Independent, active, and built to keep improving.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Text2Task is actively maintained as a long-term SaaS product.
                Product decisions are guided by practical workflows, clear user
                control, and direct support, not automation for its own sake.
              </p>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-blue-700">
                <Link
                  href="/privacy"
                  className="transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
                >
                  Privacy
                </Link>
                <Link
                  href="/terms"
                  className="transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
                >
                  Terms
                </Link>
                <Link
                  href="/contact"
                  className="transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
                >
                  Contact
                </Link>
              </div>
            </div>

            <div className="border-y border-slate-200">
              {trustPoints.map((point) => (
                <article key={point.title} className="border-b border-slate-200 py-6 last:border-b-0">
                  <h3 className="text-xl font-black tracking-tight text-slate-950">
                    {point.title}
                  </h3>
                  {point.title === "Direct support" ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Questions and product issues can be sent to{" "}
                      <a
                        href={`mailto:${supportEmail}`}
                        className="font-bold text-blue-700 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
                      >
                        {supportEmail}
                      </a>
                      .
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {point.text}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950">
          <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
            <div className="grid gap-8 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,_rgba(37,99,235,0.28),_rgba(15,23,42,0)_42%),#0f172a] p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
              <div>
                <h2 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Bring the next client request into focus.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                  Try Text2Task with a real message and review the result before
                  anything is saved.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40"
                >
                  <span className="text-white">Start free</span>
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
