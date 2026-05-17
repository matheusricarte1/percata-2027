"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

function motionDisabled() {
  if (typeof window === "undefined") return true;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accountReduced = document.documentElement.dataset.reducedMotion === "1";
  const accountDisabled = document.documentElement.dataset.showAnimations === "0";
  return prefersReduced || accountReduced || accountDisabled;
}

export function AnimationRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (motionDisabled()) {
      document.documentElement.dataset.motionReady = "1";
      gsap.set("[data-animate-page], [data-animate-auto] > *", {
        clearProps: "opacity,transform,filter",
      });
      return;
    }

    const context = gsap.context(() => {
      document.documentElement.dataset.motionReady = "1";

      const pages = gsap.utils.toArray<HTMLElement>("[data-animate-page]");
      pages.forEach((page) => {
        gsap.fromTo(
          page,
          { autoAlpha: 0, y: 10, filter: "blur(6px)" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.42,
            ease: "power3.out",
            clearProps: "filter,transform,opacity,visibility",
          },
        );
      });

      const autoContainers = gsap.utils.toArray<HTMLElement>("[data-animate-auto]");
      autoContainers.forEach((container) => {
        const firstLevel = Array.from(container.children);
        const candidates =
          firstLevel.length === 1 && firstLevel[0] instanceof HTMLElement && firstLevel[0].children.length > 1
            ? Array.from(firstLevel[0].children)
            : firstLevel;

        const children = candidates.filter(
          (child) =>
            child instanceof HTMLElement &&
            !child.hasAttribute("data-motion-static") &&
            child.tagName !== "SCRIPT",
        );
        if (children.length === 0) return;

        gsap.fromTo(
          children,
          { autoAlpha: 0, y: 14, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.38,
            stagger: { each: 0.045, from: "start" },
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
          },
        );
      });

      const explicitGroups = gsap.utils.toArray<HTMLElement>("[data-animate-stagger]");
      explicitGroups.forEach((group) => {
        const items = group.querySelectorAll<HTMLElement>("[data-animate-item]");
        if (items.length === 0) return;
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.32,
            stagger: 0.035,
            ease: "power2.out",
            clearProps: "transform,opacity,visibility",
          },
        );
      });
    });

    return () => context.revert();
  }, [pathname]);

  return null;
}
