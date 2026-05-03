import Link from "next/link";
import type { UseCasePageData } from "@/app/lib/seo/use-cases";
import { getRelatedUseCases } from "@/app/lib/seo/use-cases";

type UseCasePageProps = {
  useCase: UseCasePageData;
};

function PriorityBadge({ priority }: { priority: "Low" | "Medium" | "High" }) {
  const className =
    priority === "High"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : priority === "Medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {priority}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
      {children}
    </div>
  );
}

export default function UseCasePage({ useCase }: UseCasePageProps) {
  const relatedUseCases = getRelatedUseCases(useCase.relatedUseCases);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: useCase.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: useCase.seoTitle,
    description: useCase.metaDescription,
    url: `https://text2task.com/use-cases/${useCase.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Text2Task",
      url: "https://text2task.com",
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Text2Task",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
    },
  };

  return (
    <main className="min-h-screen bg-[#f8f7ff] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-indigo-100 bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f8f7ff_48%,_#eef2ff_100%)]">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:py-24">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm shadow-indigo-100/60 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {useCase.badge}
            </div>

            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {useCase.heroTitle}{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                {useCase.heroHighlight}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650 sm:text-xl">
              {useCase.heroDescription}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <span className="text-white">{useCase.primaryCta}</span>
              </Link>

              <a
                href="#example"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"
              >
                <span>{useCase.secondaryCta}</span>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Text + screenshot extraction
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Editable preview before saving
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Free plan includes 30 extracts
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[2rem] border border-white bg-white/85 p-4 shadow-2xl shadow-indigo-200/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-950 p-4 text-white">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                      Client message
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      Before Text2Task
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/8 p-4 text-sm leading-7 text-white/85">
                  “{useCase.beforeMessage}”
                </div>
              </div>

              <div className="-mt-3 rounded-[1.5rem] border border-indigo-100 bg-white p-4 shadow-xl shadow-slate-200/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                      Clean task output
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      After Text2Task
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Ready to save
                  </span>
                </div>

                <div className="space-y-2">
                  {useCase.exampleTasks.slice(0, 4).map((task) => (
                    <div
                      key={`${task.task}-${task.priority}`}
                      className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          {task.task}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {task.client} · Due {task.deadline} · {task.budget}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="example"
        className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionLabel>Problem</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.problemTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {useCase.problemDescription}
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-slate-950">
                What Text2Task extracts
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {useCase.extractedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-sm font-black text-slate-950">
                Example extracted tasks
              </p>
              <p className="mt-1 text-sm text-slate-500">
                A messy request becomes a clear task list.
              </p>
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-white text-xs uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="w-[24%] px-5 py-4 font-bold">Client</th>
                    <th className="w-[38%] px-5 py-4 font-bold">Task</th>
                    <th className="w-[16%] px-5 py-4 font-bold">Deadline</th>
                    <th className="w-[12%] px-5 py-4 font-bold">Budget</th>
                    <th className="w-[10%] px-5 py-4 font-bold">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {useCase.exampleTasks.map((task) => (
                    <tr key={task.task} className="bg-white">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {task.client}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <span className="line-clamp-2">{task.task}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {task.deadline}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {task.budget}
                      </td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {useCase.exampleTasks.map((task) => (
                <div
                  key={task.task}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {task.task}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {task.client}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-3">
                      <p className="font-bold uppercase tracking-[0.12em] text-slate-400">
                        Deadline
                      </p>
                      <p className="mt-1 font-black text-slate-800">
                        {task.deadline}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="font-bold uppercase tracking-[0.12em] text-slate-400">
                        Budget
                      </p>
                      <p className="mt-1 font-black text-slate-800">
                        {task.budget}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <SectionLabel>Workflow</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              From messy client message to organized work.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Text2Task is designed as a fast capture layer for real client work.
              Paste the request, review the output, and save tasks you can manage.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {useCase.workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </div>
                <h3 className="text-lg font-black text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionLabel>Benefits</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Built for the way client work actually arrives.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Text2Task helps service providers organize the exact work hidden
              inside client messages, notes, and screenshots.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {useCase.benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-black text-slate-950">
                  {benefit.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-[2rem] border border-indigo-100 bg-indigo-50/70 p-6 sm:p-8">
          <h3 className="text-xl font-black text-slate-950">
            Common tasks Text2Task can help organize
          </h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {useCase.specificTasks.map((task) => (
              <span
                key={task}
                className="rounded-full border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {task}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Questions about using Text2Task for {useCase.audienceLabel}
            </h2>
          </div>

          <div className="mt-10 divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white">
            {useCase.faq.map((item) => (
              <div key={item.question} className="p-6">
                <h3 className="text-base font-black text-slate-950">
                  {item.question}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedUseCases.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionLabel>Related use cases</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">
                Explore more workflows
              </h2>
            </div>
            <Link
              href="/use-cases"
              className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
            >
              View all use cases →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {relatedUseCases.map((related) => (
              <Link
                key={related.slug}
                href={`/use-cases/${related.slug}`}
                className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
              >
                <p className="text-sm font-bold text-indigo-700">
                  {related.audienceLabel}
                </p>
                <h3 className="mt-3 text-xl font-black text-slate-950">
                  {related.title}
                </h3>
                <p className="mt-3 line-clamp-3 leading-7 text-slate-600">
                  {related.metaDescription}
                </p>
                <p className="mt-5 text-sm font-bold text-slate-950 group-hover:text-indigo-700">
                  Read use case →
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-slate-950 px-6 py-16 text-white sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
            Try Text2Task
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Turn your next messy client request into clean tasks.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Paste a real client message or upload a screenshot. Review the AI
            output, edit if needed, and save structured tasks to your workspace.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <span className="text-slate-950">Start free</span>
            </Link>
            <Link
              href="/"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              <span className="text-white">Back to home</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}