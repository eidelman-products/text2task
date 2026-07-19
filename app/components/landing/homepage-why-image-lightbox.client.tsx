"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type HomepageWhyImageLightboxProps = Readonly<{
  src: string;
  alt: string;
  width: number;
  height: number;
}>;

const ENLARGED_IMAGE_WIDTH = 820;

export default function HomepageWhyImageLightbox({
  src,
  alt,
  width,
  height,
}: HomepageWhyImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);

    window.requestAnimationFrame(() => {
      triggerButtonRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [closeLightbox, isOpen]);

  return (
    <>
      <div className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full object-contain"
          sizes="(min-width: 1536px) 850px, (min-width: 1280px) 760px, (min-width: 1024px) 58vw, calc(100vw - 48px)"
        />

        <button
          ref={triggerButtonRef}
          type="button"
          aria-label={`Tap to enlarge image: ${alt}`}
          onClick={() => setIsOpen(true)}
          className="absolute inset-0 flex items-end justify-end p-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 lg:hidden"
        >
          <span className="pointer-events-none rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Tap to enlarge
          </span>
        </button>
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged image: ${alt}`}
          className="fixed inset-0 z-[100] bg-slate-950/85"
          onClick={closeLightbox}
        >
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close enlarged image"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-[101] flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="h-full w-full overflow-auto overscroll-contain p-6 pt-20">
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className="mx-auto h-auto w-[820px] max-w-none object-contain"
              sizes={`${ENLARGED_IMAGE_WIDTH}px`}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
