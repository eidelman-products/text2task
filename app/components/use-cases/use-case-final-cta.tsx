import Link from "next/link";
import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseFinalCta({ useCase }: { useCase: UseCase }) {
  const { finalCta } = useCase;
  if (!finalCta) return null;

  return (
    <section className="border-y border-blue-100 bg-blue-50/60 px-6 py-10 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {finalCta.title}
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            {finalCta.description}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={finalCta.primary.href}
            className="inline-flex min-w-[140px] items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-0.5 hover:bg-blue-700"
          >
            <span className="text-white">{finalCta.primary.label}</span>
          </Link>
          <Link
            href={finalCta.secondary.href}
            className="inline-flex min-w-[140px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
          >
            <span>{finalCta.secondary.label}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
