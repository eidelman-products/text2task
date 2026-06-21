import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseTransformation({
  useCase,
}: {
  useCase: UseCase;
}) {
  const { transformation } = useCase;
  if (!transformation) return null;

  return (
    <section
      id="transformation"
      className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8"
    >
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {transformation.title}
        </h2>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          {transformation.description}
        </p>
      </div>

      <div className="mt-10 grid divide-y divide-slate-200 border-y border-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="py-6 lg:pr-7">
          <h3 className="text-sm font-black text-slate-950">
            {transformation.beforeLabel}
          </h3>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {transformation.beforeText}
          </p>
        </div>

        <div className="py-6 lg:px-7">
          <h3 className="text-sm font-black text-slate-950">
            {transformation.inputTitle}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {transformation.inputs.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div className="py-6 lg:pl-7">
          <h3 className="text-sm font-black text-slate-950">
            {transformation.outputTitle}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {transformation.outputs.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 max-w-3xl border-l-2 border-blue-500 pl-5 text-lg font-semibold leading-8 text-slate-800">
        {transformation.value}
      </p>
    </section>
  );
}
