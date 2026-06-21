import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseClientUpdates({
  useCase,
}: {
  useCase: UseCase;
}) {
  const { clientUpdates } = useCase;
  if (!clientUpdates) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {clientUpdates.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {clientUpdates.description}
          </p>
        </div>

        <div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {clientUpdates.steps.map((step, index) => (
              <div
                key={step.title}
                className="grid gap-3 py-5 sm:grid-cols-[2.5rem_1fr]"
              >
                <span className="text-sm font-black text-blue-700">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-black text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 border-l-2 border-blue-500 pl-4 text-sm font-bold leading-6 text-slate-700">
            {clientUpdates.note}
          </p>
        </div>
      </div>
    </section>
  );
}
