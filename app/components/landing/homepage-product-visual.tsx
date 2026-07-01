import Image from "next/image";

const heroImage = {
  src: "/landing/use-cases/project-managers/project-manager-stakeholder-request-project-flow.png",
  alt: "Text2Task workflow showing a client request becoming an organized project draft for review before the work is saved.",
  width: 1672,
  height: 941,
} as const;

export default function HomepageProductVisual() {
  return (
    <div className="px-5 pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            width={heroImage.width}
            height={heroImage.height}
            priority
            className="h-auto w-full"
            sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 64px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
          />
        </div>
      </div>
    </div>
  );
}
