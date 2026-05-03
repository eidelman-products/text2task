import Link from "next/link";
import { getAllUseCases } from "@/app/lib/seo/use-cases";

export default function UseCasesPreviewSection() {
  const featuredUseCases = getAllUseCases().slice(0, 4);

  return (
    <section className="border-y border-indigo-100 bg-[#f8f7ff] px-6 py-16 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-indigo-700">
              Built for real client workflows
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Explore how Text2Task works for different service providers.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Web designers, WordPress freelancers, social media managers,
              video editors, virtual assistants and small agencies all receive
              messy client requests. Text2Task turns those requests into
              structured tasks.
            </p>
          </div>

          <Link
            href="/use-cases"
            className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            <span className="text-white">View all use cases</span>
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featuredUseCases.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/use-cases/${useCase.slug}`}
              className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                {useCase.audienceLabel}
              </p>
              <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">
                {useCase.title}
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                {useCase.metaDescription}
              </p>
              <p className="mt-5 text-sm font-black text-slate-950 group-hover:text-indigo-700">
                Read use case →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}