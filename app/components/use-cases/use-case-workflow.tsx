import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseWorkflow({ useCase }: { useCase: UseCase }) {
  const { workflow } = useCase;
  if (!workflow) return null;

  return (
    <section
      id="workflow"
      className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8"
    >
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {workflow.title}
        </h2>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          {workflow.description}
        </p>
      </div>

      <div className="mt-10 grid divide-y divide-slate-200 border-y border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
        {workflow.steps.map((step, index) => (
          <article
            key={step.title}
            className="py-6 md:px-7 md:first:pl-0 md:last:pr-0"
          >
            <p className="text-sm font-black text-blue-700">0{index + 1}</p>
            <h3 className="mt-3 text-lg font-black text-slate-950">
              {step.title}
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              {step.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
