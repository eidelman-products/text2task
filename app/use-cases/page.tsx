import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllUseCases } from "@/app/lib/use-cases";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://text2task.com";

export const metadata: Metadata = {
  title: "Text2Task Use Cases | AI Task Manager for Freelancers",
  description:
    "Explore how Text2Task helps web designers, WordPress freelancers, Webflow freelancers, graphic designers, social media managers, video editors, virtual assistants, and small agencies turn messy client messages into organized tasks.",
  alternates: {
    canonical: `${siteUrl}/use-cases`,
  },
  openGraph: {
    title: "Text2Task Use Cases | AI Task Manager for Freelancers",
    description:
      "Explore how Text2Task helps freelancers and service providers turn messy client messages, screenshots, notes, and work requests into structured tasks.",
    url: `${siteUrl}/use-cases`,
    siteName: "Text2Task",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Text2Task Use Cases | AI Task Manager for Freelancers",
    description:
      "Explore Text2Task use cases for freelancers, designers, social media managers, video editors, virtual assistants, and small agencies.",
  },
};

export default function UseCasesPage() {
  const useCases = getAllUseCases();

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Text2Task Use Cases",
    description:
      "Use cases for Text2Task, an AI task manager that turns messy client messages and screenshots into structured tasks.",
    url: `${siteUrl}/use-cases`,
    mainEntity: useCases.map((useCase) => ({
      "@type": "WebPage",
      name: useCase.title,
      url: `${siteUrl}/use-cases/${useCase.slug}`,
      description: useCase.metaDescription,
    })),
  };

  return (
    <main className="min-h-screen bg-[#f8f7ff] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function (event) {
              var trigger = event.target.closest("[data-use-case-lightbox-src]");
              var lightbox = document.getElementById("use-cases-lightbox");
              if (!lightbox) return;

              if (trigger) {
                event.preventDefault();
                var image = lightbox.querySelector("[data-use-case-lightbox-image]");
                if (!image) return;
                image.setAttribute("src", trigger.getAttribute("data-use-case-lightbox-src") || "");
                image.setAttribute("alt", trigger.getAttribute("data-use-case-lightbox-alt") || "");
                lightbox.removeAttribute("hidden");
                document.documentElement.style.overflow = "hidden";
                return;
              }

              if (
                event.target.closest("[data-use-case-lightbox-close]") ||
                event.target === lightbox
              ) {
                lightbox.setAttribute("hidden", "");
                document.documentElement.style.overflow = "";
              }
            });

            document.addEventListener("keydown", function (event) {
              if (event.key !== "Escape") return;
              var lightbox = document.getElementById("use-cases-lightbox");
              if (!lightbox || lightbox.hasAttribute("hidden")) return;
              lightbox.setAttribute("hidden", "");
              document.documentElement.style.overflow = "";
            });
          `,
        }}
      />

      <section className="relative overflow-hidden border-b border-indigo-100 bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f8f7ff_52%,_#eef2ff_100%)]">
        <div className="absolute left-[8%] top-8 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-[12%] h-64 w-64 rounded-full bg-violet-200/25 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              AI task extraction for real client workflows.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
              Text2Task turns messy client messages, screenshots, notes, and
              work requests into structured tasks. Choose the workflow closest
              to your work.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <span className="text-white">Try Text2Task</span>
              </Link>

              <Link
                href="/"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"
              >
                <span>Back to home</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              data-use-case-lightbox-src="/landing/text2task-client-gmail-web-designers.png"
              data-use-case-lightbox-alt="Client email request with website edits, budget, and deadline."
              className="group w-full cursor-pointer rounded-3xl border border-white bg-white/80 p-3 text-left shadow-2xl shadow-indigo-200/40 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-indigo-200/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
            >
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                <Image
                  src="/landing/text2task-client-gmail-web-designers.png"
                  alt="Client email request with website edits, budget, and deadline."
                  width={1586}
                  height={992}
                  priority
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(min-width: 1024px) 48vw, 100vw"
                />
              </div>
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Choose the use case closest to your work.
            </h2>
          </div>
          <Link
            href="/signup"
            className="text-sm font-black text-indigo-700 transition hover:text-indigo-950"
          >
            Start free -&gt;
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {useCases.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/use-cases/${useCase.slug}`}
              className="group flex min-h-[315px] flex-col rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm shadow-slate-200/50 transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-2xl hover:shadow-indigo-100/80"
            >
              <div className="mb-5 inline-flex w-fit rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                {useCase.audienceLabel}
              </div>

              <h3 className="text-xl font-black tracking-tight text-slate-950">
                {useCase.title}
              </h3>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                {useCase.metaDescription}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {useCase.specificTasks.slice(0, 4).map((task) => (
                  <span
                    key={task}
                    className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    {task}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-7">
                <span className="text-sm font-black text-slate-950 transition group-hover:text-indigo-700">
                  View use case -&gt;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-[radial-gradient(circle_at_top,_rgba(199,210,254,0.28),_transparent_36%),#ffffff]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Real client requests arrive messy. Text2Task makes them usable.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Every workflow starts the same way: a client sends a long email,
              a WhatsApp message, a screenshot, or scattered notes. Text2Task
              helps turn that intake into clear work you can review, save, and
              manage.
            </p>

            <div className="mt-7 grid gap-3">
              {[
                "Works with email, WhatsApp, notes, and screenshots",
                "Extracts tasks, deadlines, budgets, and client details",
                "Keeps the final plan editable before saving",
              ].map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-3 text-sm font-bold text-slate-700"
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-300" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px]">
            <button
              type="button"
              data-use-case-lightbox-src="/landing/text2task-client-whatsapp-video-editors.png"
              data-use-case-lightbox-alt="Client WhatsApp request with video revision notes."
              className="group absolute right-0 top-0 w-[82%] cursor-pointer rounded-3xl border border-white bg-white/80 p-3 text-left shadow-2xl shadow-indigo-100/70 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-indigo-200/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
            >
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                <Image
                  src="/landing/text2task-client-whatsapp-video-editors.png"
                  alt="Client WhatsApp request with video revision notes."
                  width={1448}
                  height={1086}
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(min-width: 1024px) 45vw, 100vw"
                />
              </div>
            </button>

            <button
              type="button"
              data-use-case-lightbox-src="/landing/text2task-ai-project-preview.png"
              data-use-case-lightbox-alt="Text2Task AI project preview with extracted tasks, deadline, budget, and client details."
              className="group absolute bottom-0 left-0 w-[78%] cursor-pointer rounded-3xl border border-white bg-white/90 p-3 text-left shadow-2xl shadow-slate-200/80 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-indigo-100/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
            >
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                <Image
                  src="/landing/text2task-ai-project-preview.png"
                  alt="Text2Task AI project preview with extracted tasks, deadline, budget, and client details."
                  width={1380}
                  height={564}
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(min-width: 1024px) 42vw, 100vw"
                />
              </div>
            </button>
          </div>
        </div>
      </section>

      <div
        id="use-cases-lightbox"
        hidden
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Use case image preview"
      >
        <div className="relative w-full max-w-6xl">
          <button
            type="button"
            data-use-case-lightbox-close
            className="absolute -top-12 right-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          >
            Close
          </button>
          <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white p-2 shadow-2xl shadow-slate-950/40">
            <img
              data-use-case-lightbox-image
              src=""
              alt=""
              className="h-auto max-h-[82vh] w-full rounded-[1.5rem] object-contain"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
