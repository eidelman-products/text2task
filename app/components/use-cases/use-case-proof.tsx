import type { UseCase } from "@/app/lib/use-cases";
import UseCaseScreenshotFrame from "./use-case-screenshot-frame";

export default function UseCaseProof({ useCase }: { useCase: UseCase }) {
  const { proof } = useCase;
  if (!proof) return null;

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {proof.title}
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {proof.description}
          </p>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          {proof.images.map((image, index) => (
            <UseCaseScreenshotFrame
              key={image.src}
              image={image}
              sizes={
                index === 0
                  ? "(min-width: 1024px) 56vw, 100vw"
                  : "(min-width: 1024px) 40vw, 100vw"
              }
              className={index === 0 ? "lg:col-span-2" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
