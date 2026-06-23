"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const crmImage = {
  src: "/landing/text2task-crm-workspace.png",
  alt: "Text2Task Task CRM showing client projects, tasks, budgets, deadlines, priorities, statuses, and project actions in one workspace.",
  width: 1238,
  height: 911,
} as const;

export default function HomepageCrmImageViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeViewer = useCallback(() => {
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
        closeViewer();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [closeViewer, isOpen]);

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        aria-label="Enlarge the Text2Task project CRM screenshot"
        onClick={() => setIsOpen(true)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition duration-200 hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
      >
        <Image
          src={crmImage.src}
          alt={crmImage.alt}
          width={crmImage.width}
          height={crmImage.height}
          className="h-auto w-full"
          sizes="(min-width: 1024px) 54vw, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
        />
        <span className="pointer-events-none absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/80 bg-white/85 text-blue-700 shadow-sm backdrop-blur-sm transition group-hover:bg-white group-focus-visible:bg-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M15 3h6v6" />
            <path d="m21 3-7 7" />
            <path d="M9 21H3v-6" />
            <path d="m3 21 7-7" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Text2Task project CRM screenshot"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-3 py-6 sm:px-6"
          onClick={closeViewer}
        >
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close enlarged screenshot"
            onClick={closeViewer}
            className="absolute right-4 top-4 z-[101] flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:right-6 sm:top-6"
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

          <div
            className="overflow-hidden rounded-2xl border border-white/20 bg-white/5"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={crmImage.src}
              alt={crmImage.alt}
              width={crmImage.width}
              height={crmImage.height}
              className="h-auto max-h-[90vh] w-auto max-w-[94vw] object-contain"
              sizes="94vw"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
