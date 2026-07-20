import type { UseCaseAccentTone, UseCaseChecklistModuleData } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";

export default function UseCaseChecklistModule({
  module,
  accentTone,
}: {
  module: UseCaseChecklistModuleData;
  accentTone?: UseCaseAccentTone;
}) {
  const accent = getUseCaseAccentClasses(accentTone);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div
          className={`rounded-2xl border ${accent.border} ${accent.bg} p-6 sm:p-8`}
        >
          <h2 className="text-xl font-black text-slate-950">
            {module.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {module.description}
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {module.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-slate-800"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {module.note ? (
            <p className="mt-5 text-xs font-semibold text-slate-500">
              {module.note}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
