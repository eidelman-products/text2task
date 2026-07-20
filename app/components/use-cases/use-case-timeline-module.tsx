import type { UseCaseAccentTone, UseCaseTimelineModuleData } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";

export default function UseCaseTimelineModule({
  module,
  accentTone,
}: {
  module: UseCaseTimelineModuleData;
  accentTone?: UseCaseAccentTone;
}) {
  const accent = getUseCaseAccentClasses(accentTone);
  const markerClasses =
    accentTone === "slate"
      ? "bg-slate-900 text-white"
      : `${accent.bg} ${accent.text}`;

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

        <ol className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {module.items.map((item) => (
            <li
              key={`${item.marker}-${item.label}`}
              className="flex items-start gap-5 py-5"
            >
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black tabular-nums ${markerClasses}`}
              >
                {item.marker}
              </span>
              <div>
                <p className="font-black text-slate-950">{item.label}</p>
                {item.description ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
