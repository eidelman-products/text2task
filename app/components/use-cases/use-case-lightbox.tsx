"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type LightboxImage = {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
};

function parseDimension(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function UseCaseLightbox() {
  const [image, setImage] = useState<LightboxImage | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLButtonElement>(
        "[data-image-lightbox-trigger]"
      );

      if (trigger) {
        event.preventDefault();
        const src = trigger.getAttribute("data-image-lightbox-src");
        if (!src) return;

        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        const label =
          trigger.getAttribute("data-image-lightbox-label") || "Image preview";

        setImage({
          src,
          alt: trigger.getAttribute("data-image-lightbox-alt") || label,
          label,
          width: parseDimension(
            trigger.getAttribute("data-image-lightbox-width"),
            1600
          ),
          height: parseDimension(
            trigger.getAttribute("data-image-lightbox-height"),
            1000
          ),
        });
      }
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    if (!image) return;

    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [image]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.label} preview`}
      onClick={() => setImage(null)}
    >
      <div
        className="relative w-full max-w-6xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setImage(null)}
          className="absolute -top-12 right-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
        >
          Close
        </button>

        <div className="overflow-hidden rounded-3xl border border-white/15 bg-white p-2 shadow-2xl shadow-slate-950/40">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="h-auto max-h-[82vh] w-full rounded-[1.35rem] object-contain"
            sizes="100vw"
          />
        </div>
      </div>
    </div>
  );
}
