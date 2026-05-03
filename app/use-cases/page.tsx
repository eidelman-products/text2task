import type { Metadata } from "next";
import Link from "next/link";
import { getAllUseCases } from "@/app/lib/seo/use-cases";

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

      <section className="border-b border-indigo-100 bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f8f7ff_52%,_#eef2ff_100%)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[0.98fr_1.02fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm">
              Text2Task use cases
            </div>

            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              AI task extraction for real freelance workflows.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
              Text2Task turns messy client messages, screenshots, notes, and
              work requests into structured tasks. Explore how different service
              providers can use it to organize client work faster.
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
            <div className="w-full rounded-[2rem] border border-white bg-white/85 p-4 shadow-2xl shadow-indigo-200/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-950 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                      Messy client request
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-white/80">
                      “Can you update the homepage, fix mobile, create 3 social
                      posts, send it before Friday, and keep it around $850?”
                    </p>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
              </div>

              <div className="-mt-3 rounded-[1.5rem] border border-indigo-100 bg-white p-5 shadow-xl shadow-slate-200/60">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
                      Clean Text2Task output
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Structured by client, task, deadline, budget and priority.
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 sm:inline-flex">
                    Ready to save
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Use case
                    </p>
                    <p className="mt-2 font-black text-slate-950">
                      Web Designers
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Website edits → tasks
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Use case
                    </p>
                    <p className="mt-2 font-black text-slate-950">
                      Social Media
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Content requests → tasks
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Extracted
                    </p>
                    <p className="mt-2 font-black text-slate-950">
                      Deadline + budget
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Friday · $850
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Result
                    </p>
                    <p className="mt-2 font-black text-slate-950">
                      Organized workspace
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Review, edit, save
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm font-black text-indigo-950">
                    Built for service providers who work from real client
                    messages — not perfect forms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-indigo-700">
              Explore workflows
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Choose the use case closest to your work.
            </h2>
          </div>
          <Link
            href="/signup"
            className="text-sm font-black text-indigo-700 hover:text-indigo-950"
          >
            Start free →
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {useCases.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/use-cases/${useCase.slug}`}
              className="group flex min-h-[330px] flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100"
            >
              <div className="mb-5 inline-flex w-fit rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
                {useCase.audienceLabel}
              </div>

              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                {useCase.title}
              </h2>

              <p className="mt-4 line-clamp-4 leading-7 text-slate-600">
                {useCase.metaDescription}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {useCase.specificTasks.slice(0, 4).map((task) => (
                  <span
                    key={task}
                    className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    {task}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <span className="text-sm font-black text-slate-950 group-hover:text-indigo-700">
                  View use case →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-indigo-700">
                Why use-case pages matter
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Text2Task is built for service providers, not generic task lists.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Different freelancers receive different types of client requests.
                Web designers get website edits. Social media managers get
                content requests. Video editors get revision notes. Text2Task
                helps turn each messy request into structured work.
              </p>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                  Messy input
                </p>
                <p className="mt-3 text-sm leading-7 text-white/80">
                  “Can you update the homepage, change the CTA, fix mobile,
                  add the pricing section, and send the first draft by Friday?”
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Extracted
                  </p>
                  <p className="mt-2 font-black text-slate-950">
                    4 clear tasks
                  </p>
                </div>
                <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Deadline
                  </p>
                  <p className="mt-2 font-black text-slate-950">Friday</p>
                </div>
                <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Budget
                  </p>
                  <p className="mt-2 font-black text-slate-950">$850</p>
                </div>
                <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Status
                  </p>
                  <p className="mt-2 font-black text-slate-950">
                    Ready to save
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}