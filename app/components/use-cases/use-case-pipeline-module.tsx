import type { UseCaseAccentTone, UseCasePipelineModuleData } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";

export default function UseCasePipelineModule({
  module,
  accentTone,
}: {
  module: UseCasePipelineModuleData;
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

        <div className="mt-10 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3" scope="col">
                  Client
                </th>
                <th className="px-5 py-3" scope="col">
                  Project
                </th>
                <th className="px-5 py-3" scope="col">
                  Owner
                </th>
                <th className="px-5 py-3" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {module.rows.map((row, index) => (
                <tr key={`${row.client}-${index}`}>
                  <td className="px-5 py-4 font-black text-slate-950">
                    {row.client}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{row.project}</td>
                  <td className="px-5 py-4 text-slate-700">{row.owner}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full ${accent.bg} ${accent.text} px-2.5 py-1 text-xs font-black`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-4 md:hidden">
          {module.rows.map((row, index) => (
            <div
              key={`${row.client}-${index}`}
              className={`rounded-2xl border ${accent.border} p-5`}
            >
              <p className="font-black text-slate-950">{row.client}</p>
              <p className="mt-1 text-sm text-slate-700">{row.project}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">{row.owner}</span>
                <span
                  className={`inline-flex items-center rounded-full ${accent.bg} ${accent.text} px-2.5 py-1 text-xs font-black`}
                >
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
