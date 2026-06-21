import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import LandingFooter from "../components/landing/landing-footer";
import UseCaseLightbox from "../components/use-cases/use-case-lightbox";
import AboutReturnLink from "./about-return-link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://text2task.com";

export const metadata: Metadata = {
  title: "About Text2Task | AI Task Extraction for Client Work",
  description:
    "Learn how Text2Task helps freelancers and small teams turn messy client messages, emails, screenshots, and notes into organized tasks, deadlines, budgets, and client details.",
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    title: "About Text2Task | AI Task Extraction for Client Work",
    description:
      "Learn how Text2Task helps freelancers and small teams turn messy client communication into organized work.",
    url: `${siteUrl}/about`,
    siteName: "Text2Task",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Text2Task | AI Task Extraction for Client Work",
    description:
      "Text2Task helps freelancers and small teams turn messy client messages, emails, screenshots, and notes into organized work.",
  },
};

const problemCards = [
  {
    title: "Messy client messages",
    text: "Requests arrive as long emails, chat threads, screenshots, revision notes, and quick follow-ups.",
  },
  {
    title: "Missed details",
    text: "Deadlines, budgets, files, links, and client context are easy to overlook when they are buried in the conversation.",
  },
  {
    title: "Manual copying",
    text: "Moving work from inboxes and chats into a project system by hand burns time before the real work starts.",
  },
  {
    title: "Unclear next steps",
    text: "A request can sound simple until it needs to become a clear plan with tasks, priorities, and details.",
  },
];

const approachItems = [
  {
    title: "AI-assisted extraction",
    text: "Text2Task identifies the useful work details inside messages, screenshots, and notes.",
  },
  {
    title: "Review before saving",
    text: "The extracted project stays editable, so the final saved work remains under the user's control.",
  },
  {
    title: "Structured workspace",
    text: "Tasks, deadlines, budgets, resources, and client details become easier to manage after intake.",
  },
];

const workflowAudiences = [
  {
    title: "Freelancers",
    text: "Capture client requests without rebuilding every task list by hand.",
  },
  {
    title: "Web designers",
    text: "Turn revisions, screenshots, assets, deadlines, and budget notes into organized project work.",
  },
  {
    title: "Developers",
    text: "Keep bug notes, fixes, links, and maintenance requests connected to the right client work.",
  },
  {
    title: "Small agencies",
    text: "Bring multi-client requests into a clearer workflow before handoff or delivery.",
  },
  {
    title: "Virtual assistants",
    text: "Separate mixed admin instructions into practical next actions across clients.",
  },
  {
    title: "Social media managers",
    text: "Organize content requests, approvals, captions, dates, and campaign changes.",
  },
];

const workflowProof = [
  {
    step: "1",
    label: "Client WhatsApp message",
    src: "/landing/text2task-client-whatsapp-graphic-designers.png",
    alt: "Client WhatsApp message with graphic design revision request.",
  },
  {
    step: "2",
    label: "AI extracts the work",
    src: "/landing/text2task-client-whatsapp-graphic-designers extracted.png",
    alt: "Text2Task AI extraction preview from a client WhatsApp message.",
  },
  {
    step: "3",
    label: "Saved in the CRM",
    src: "/landing/New-Task-CRM.png",
    alt: "New extracted task saved inside the Text2Task CRM.",
  },
];

export default function AboutPage() {
  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Text2Task",
    description:
      "Text2Task helps freelancers and small teams turn messy client messages, emails, screenshots, and notes into organized tasks, deadlines, budgets, and client details.",
    url: `${siteUrl}/about`,
    isPartOf: {
      "@type": "WebSite",
      name: "Text2Task",
      url: siteUrl,
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Text2Task",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
    },
  };

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-slate-950">
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
        />

        <section className="relative overflow-hidden border-b border-indigo-100 bg-[radial-gradient(circle_at_16%_12%,_rgba(199,210,254,0.62),_transparent_31%),radial-gradient(circle_at_88%_14%,_rgba(221,214,254,0.54),_transparent_30%),linear-gradient(135deg,_#ffffff_0%,_#fafaff_52%,_#eef2ff_100%)]">
          <div className="absolute left-[8%] top-8 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-[10%] h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6 pt-6 sm:pt-8 lg:px-8">
  <Suspense fallback={null}>
    <AboutReturnLink />
  </Suspense>
</div>

          <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-16 pt-10 sm:pb-20 sm:pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-16">
            <div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Turn messy client communication into organized work.
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
                Text2Task is an independent SaaS product built for freelancers
                and small teams who manage client work across emails,
                screenshots, WhatsApp messages, and notes.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
                >
                  <span className="text-white">Try Text2Task</span>
                </Link>

                <Link
                  href="/use-cases"
                  className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"
                >
                  <span>View use cases</span>
                </Link>
              </div>
            </div>

            <div className="relative min-h-[500px] lg:min-h-[560px]">
              <button
                type="button"
                data-image-lightbox-trigger
                data-image-lightbox-src="/landing/text2task-client-gmail-web-designers.png"
                data-image-lightbox-alt="Client email request with website edits, budget, and deadline."
                data-image-lightbox-label="Client email request"
                data-image-lightbox-width="1586"
                data-image-lightbox-height="992"
                aria-label="Open client email request screenshot preview"
                className="group absolute right-0 top-0 w-[84%] cursor-pointer rounded-3xl border border-white bg-white/80 p-3 text-left shadow-2xl shadow-indigo-200/50 backdrop-blur transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
              >
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                  <Image
                    src="/landing/text2task-client-gmail-web-designers.png"
                    alt="Client email request with website edits, budget, and deadline."
                    width={1586}
                    height={992}
                    priority
                    className="h-auto w-full object-cover"
                    sizes="(min-width: 1024px) 46vw, 90vw"
                  />
                </div>
                <span className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/70 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Click to enlarge
                </span>
              </button>

              <button
                type="button"
                data-image-lightbox-trigger
                data-image-lightbox-src="/landing/text2task-ai-project-preview.png"
                data-image-lightbox-alt="Text2Task AI project preview with extracted tasks, deadline, budget, and client details."
                data-image-lightbox-label="AI project preview"
                data-image-lightbox-width="959"
                data-image-lightbox-height="909"
                aria-label="Open Text2Task AI project preview screenshot"
                className="group absolute bottom-0 left-0 w-[78%] cursor-pointer rounded-3xl border border-white bg-white/90 p-3 text-left shadow-2xl shadow-slate-200/80 backdrop-blur transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
              >
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                  <Image
                    src="/landing/text2task-ai-project-preview.png"
                    alt="Text2Task AI project preview with extracted tasks, deadline, budget, and client details."
                    width={1380}
                    height={564}
                    priority
                    className="h-auto w-full object-cover"
                    sizes="(min-width: 1024px) 42vw, 86vw"
                  />
                </div>
                <span className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/70 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Click to enlarge
                </span>
              </button>

              <div
                className="pointer-events-none absolute left-[13%] top-[46%] flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-white/95 text-lg font-black text-indigo-700 shadow-xl shadow-indigo-200/50 backdrop-blur"
                aria-hidden="true"
              >
                -&gt;
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Why Text2Task exists
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Client requests rarely arrive as clean tasks. They show up as
                emails, screenshots, chat messages, quick notes, and revision
                requests. Text2Task exists to turn that intake into organized
                work without removing the human review step.
              </p>
            </div>

            <div className="relative min-h-[390px]">
              <div className="absolute -right-8 top-0 h-40 w-40 rounded-full bg-indigo-200/30 blur-3xl" />
              <button
                type="button"
                data-image-lightbox-trigger
                data-image-lightbox-src="/landing/text2task-client-whatsapp-request.png"
                data-image-lightbox-alt="Client WhatsApp request before extraction."
                data-image-lightbox-label="Client WhatsApp request"
                data-image-lightbox-width="760"
                data-image-lightbox-height="760"
                aria-label="Open client WhatsApp request screenshot preview"
                className="group absolute left-0 top-0 w-[52%] cursor-pointer rounded-[1.75rem] border border-white bg-white/80 p-3 text-left shadow-2xl shadow-slate-200/70 backdrop-blur transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
              >
                <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
                  <Image
                    src="/landing/text2task-client-whatsapp-request.png"
                    alt="Client WhatsApp request before extraction."
                    width={760}
                    height={760}
                    className="h-auto max-h-[340px] w-full object-contain"
                    sizes="(min-width: 1024px) 28vw, 90vw"
                  />
                </div>
                <span className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/70 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Click to enlarge
                </span>
              </button>

              <button
                type="button"
                data-image-lightbox-trigger
                data-image-lightbox-src="/landing/text2task-client-update-review.png"
                data-image-lightbox-alt="Text2Task client update review showing extracted changes before saving."
                data-image-lightbox-label="Client update review"
                data-image-lightbox-width="1400"
                data-image-lightbox-height="840"
                aria-label="Open Text2Task client update review screenshot preview"
                className="group absolute bottom-0 right-0 w-[68%] cursor-pointer rounded-[1.75rem] border border-white bg-white/90 p-3 text-left shadow-2xl shadow-indigo-100/80 backdrop-blur transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
              >
                <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
                  <Image
                    src="/landing/text2task-client-update-review.png"
                    alt="Text2Task client update review showing extracted changes before saving."
                    width={1400}
                    height={840}
                    className="h-auto max-h-[320px] w-full object-contain"
                    sizes="(min-width: 1024px) 32vw, 90vw"
                  />
                </div>
                <span className="pointer-events-none absolute bottom-5 right-5 rounded-full border border-white/70 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Click to enlarge
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="border-y border-indigo-100 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                The problem we solve
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Text2Task helps reduce the friction between receiving a client
                request and knowing exactly what needs to happen next.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
              {problemCards.map((card, index) => (
                <div
                  key={card.title}
                  className="relative border-t border-slate-200 pt-6"
                >
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700 ring-8 ring-white">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Our approach
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Text2Task is built around AI-assisted extraction and a
                review-first workflow. The product helps draft the structure,
                while the user stays in control before anything is saved.
              </p>
            </div>

            <div className="relative">
              <div
                className="absolute left-5 top-6 hidden h-[calc(100%-48px)] w-px bg-gradient-to-b from-indigo-200 via-indigo-300 to-transparent sm:block"
                aria-hidden="true"
              />
              <div className="grid gap-8">
                {approachItems.map((item, index) => (
                  <div
                    key={item.title}
                    className="relative grid gap-4 sm:grid-cols-[42px_1fr]"
                  >
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white text-sm font-black text-indigo-700 shadow-sm shadow-indigo-100">
                      {index + 1}
                    </div>
                    <div className="pb-2">
                      <h3 className="text-lg font-black text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-indigo-100 bg-[radial-gradient(circle_at_top,_rgba(199,210,254,0.28),_transparent_36%),#ffffff]">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built for client-service workflows
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Text2Task is designed for the kind of work that starts in client
                communication and needs to become clear tasks before delivery can
                move forward.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-x-8 gap-y-0 overflow-hidden rounded-[2rem] border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
              {workflowAudiences.map((audience) => (
                <div
                  key={audience.title}
                  className="border-b border-slate-200 py-6 text-left lg:[&:nth-last-child(-n+3)]:border-b-0"
                >
                  <div className="mb-3 h-1.5 w-8 rounded-full bg-indigo-400" />
                  <h3 className="text-base font-black text-slate-950">
                    {audience.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {audience.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              From client WhatsApp to AI extraction to saved CRM task.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
              A real client request can move from messy message to reviewed work
              and finally into the workspace.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {workflowProof.map((image, index) => (
              <div key={image.src} className="relative">
                {index > 0 ? (
                  <div
                    className="pointer-events-none absolute -left-4 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-100 bg-white text-sm font-black text-indigo-700 shadow-lg shadow-indigo-100 lg:flex"
                    aria-hidden="true"
                  >
                    -&gt;
                  </div>
                ) : null}

                <button
                  type="button"
                  data-image-lightbox-trigger
                  data-image-lightbox-src={image.src}
                  data-image-lightbox-alt={image.alt}
                  data-image-lightbox-label={image.label}
                  data-image-lightbox-width="1400"
                  data-image-lightbox-height="900"
                  aria-label={`Open screenshot preview: ${image.alt}`}
                  className="group relative w-full cursor-pointer rounded-3xl border border-white bg-white/85 p-3 text-left shadow-lg shadow-slate-200/60 backdrop-blur transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                >
                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={1400}
                      height={900}
                      className="h-56 w-full object-contain"
                      sizes="(min-width: 1024px) 30vw, 90vw"
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-3 px-1 pb-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-700">
                      {image.step}
                    </span>
                    <span className="text-sm font-black text-slate-950">
                      {image.label}
                    </span>
                  </div>

                  <span className="pointer-events-none absolute bottom-16 right-5 rounded-full border border-white/70 bg-slate-950/70 px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    Click to enlarge
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-16 sm:pb-20 lg:px-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.32),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827)] px-6 py-10 text-center text-white shadow-2xl shadow-slate-900/25 sm:px-10">
            <h2 className="mx-auto max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Ready to turn your next client request into organized work?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-100">
              Paste a real client message, review the extracted project plan,
              and save the work when it looks right.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
              >
                <span className="text-slate-950">Start free</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <span className="text-white">Contact support</span>
              </Link>
            </div>
          </div>
        </section>

      </main>

      <LandingFooter />
      <UseCaseLightbox />
    </div>
  );
}
