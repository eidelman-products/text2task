import Link from "next/link";
import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseRelated({
  relatedUseCases,
}: {
  relatedUseCases: UseCase[];
}) {
  if (relatedUseCases.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          Related use cases
        </h2>
        <Link
          href="/use-cases"
          className="text-sm font-black text-blue-700 transition hover:text-slate-950"
        >
          View all use cases -&gt;
        </Link>
      </div>

      <div className="mt-6 grid divide-y divide-slate-200 border-y border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
        {relatedUseCases.map((related) => (
          <Link
            key={related.slug}
            href={`/use-cases/${related.slug}`}
            className="group py-5 transition md:px-6 md:first:pl-0 md:last:pr-0"
          >
            <h3 className="font-black text-slate-950 transition group-hover:text-blue-700">
              {related.audienceLabel}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {related.listing.description}
            </p>
            <p className="mt-3 text-sm font-black text-blue-700">
              Read use case -&gt;
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
