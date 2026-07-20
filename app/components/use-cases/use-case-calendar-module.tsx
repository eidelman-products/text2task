import type { UseCaseAccentTone, UseCaseCalendarModuleData } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";

export default function UseCaseCalendarModule({
  module,
  accentTone,
}: {
  module: UseCaseCalendarModuleData;
  accentTone?: UseCaseAccentTone;
}) {
  const accent = getUseCaseAccentClasses(accentTone);

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {module.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {module.description}
          </p>
          {module.note ? (
            <p className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-400">
              {module.note}
            </p>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {module.entries.map((entry, index) => (
            <div
              key={`${entry.day}-${index}`}
              className={`rounded-2xl border ${accent.border} ${accent.bg} p-5`}
            >
              <p className={`text-xs font-black uppercase tracking-wide ${accent.text}`}>
                {entry.day}
              </p>
              <p className="mt-2 font-black text-slate-950">{entry.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {entry.meta}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
