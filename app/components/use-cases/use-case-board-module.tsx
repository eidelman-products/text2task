import type { UseCaseAccentTone, UseCaseBoardModuleData } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";

export default function UseCaseBoardModule({
  module,
  accentTone,
}: {
  module: UseCaseBoardModuleData;
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

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {module.groups.map((group) => (
            <div
              key={group.label}
              className={`rounded-2xl border ${accent.border} ${accent.bg} p-5`}
            >
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-950">
                {group.label}
              </h3>
              <ul className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="text-sm leading-6 text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">
                      {item.label}
                    </span>
                    {item.tag ? (
                      <span
                        className={`ml-2 inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${accent.text}`}
                      >
                        {item.tag}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
