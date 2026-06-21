import type { UseCase } from "@/app/lib/use-cases";

export default function UseCasePainPoints({ useCase }: { useCase: UseCase }) {
  const { outcomes, painPoints } = useCase;
  if (!painPoints) return null;

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {painPoints.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {painPoints.description}
          </p>
          {painPoints.supportingDescription ? (
            <p className="mt-4 text-lg leading-8 text-slate-600">
              {painPoints.supportingDescription}
            </p>
          ) : null}
        </div>

        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {painPoints.items.map((item) => (
            <li
              key={item}
              className="flex gap-4 py-4 text-base leading-7 text-slate-700"
            >
              <span
                aria-hidden="true"
                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {outcomes ? (
          <div className="border-t border-slate-200 pt-9 lg:col-span-2">
            <h3 className="text-xl font-black text-slate-950">
              {outcomes.title}
            </h3>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              {outcomes.description}
            </p>
            <div className="mt-6 grid gap-x-10 sm:grid-cols-2">
              {outcomes.items.map((item) => (
                <div key={item.title} className="border-t border-slate-200 py-5">
                  <h4 className="font-black text-slate-950">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
