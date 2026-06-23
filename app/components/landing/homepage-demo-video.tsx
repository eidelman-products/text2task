"use client";

import { useEffect, useRef } from "react";

export default function HomepageDemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoPlayInProgressRef = useRef(false);
  const autoPlayPreparedRef = useRef(false);
  const manualPauseRef = useRef(false);
  const programmaticPauseRef = useRef(false);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handlePlay = () => {
      if (!autoPlayInProgressRef.current) {
        userInteractedRef.current = true;
        manualPauseRef.current = false;
      }
    };

    const handlePause = () => {
      if (programmaticPauseRef.current) {
        programmaticPauseRef.current = false;
        return;
      }

      if (!video.ended) {
        userInteractedRef.current = true;
        manualPauseRef.current = true;
      }
    };

    const handleVolumeChange = () => {
      userInteractedRef.current = true;
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);

    const removeVideoEventListeners = () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return () => {
        removeVideoEventListeners();
      };
    }

    const attemptViewportPlay = () => {
      if (video.ended || !video.paused || manualPauseRef.current) {
        return;
      }

      if (!autoPlayPreparedRef.current && !userInteractedRef.current) {
        video.muted = true;
        autoPlayPreparedRef.current = true;
      }

      autoPlayInProgressRef.current = true;

      void video
        .play()
        .catch(() => {
          // Autoplay can be blocked by the browser. Native controls remain usable.
        })
        .finally(() => {
          autoPlayInProgressRef.current = false;
        });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.intersectionRatio >= 0.6) {
          attemptViewportPlay();
          return;
        }

        if (entry.intersectionRatio < 0.2 && !video.paused) {
          programmaticPauseRef.current = true;
          video.pause();
        }
      },
      {
        threshold: [0, 0.2, 0.6, 1],
      },
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      removeVideoEventListeners();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src="/landing/text2task-demo.mp4"
      poster="/landing/text2task-demo-poster.svg"
      controls
      playsInline
      preload="metadata"
      aria-describedby="homepage-demo-description"
      className="aspect-video w-full bg-slate-100 object-cover"
    >
      Your browser does not support the video tag.
    </video>
  );
}
