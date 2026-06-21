import Image from "next/image";
import type { UseCaseImage } from "@/app/lib/use-cases";

type UseCaseScreenshotFrameProps = {
  image: UseCaseImage;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function UseCaseScreenshotFrame({
  image,
  className,
  imageClassName,
  sizes = "(min-width: 1024px) 48vw, 100vw",
  priority,
}: UseCaseScreenshotFrameProps) {
  return (
    <button
      type="button"
      data-image-lightbox-trigger
      data-image-lightbox-src={image.src}
      data-image-lightbox-alt={image.alt}
      data-image-lightbox-label={image.label}
      data-image-lightbox-width={image.width}
      data-image-lightbox-height={image.height}
      aria-label={`Open preview: ${image.label}`}
      className={cx(
        "group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm transition duration-300 hover:border-blue-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
        className
      )}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          priority={priority ?? image.priority}
          className={cx(
            "h-auto w-full object-contain",
            imageClassName
          )}
          sizes={sizes}
        />
      </div>
    </button>
  );
}
