import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

// Blocks that rise into place as they scroll into view on the public pages.
const TARGETS = [
  ".landing-section-heading",
  ".landing-block-heading",
  ".landing-service-card",
  ".landing-scooter-card",
  ".landing-card",
  ".landing-split",
  ".landing-panel",
  ".landing-panel-grid > *",
  ".landing-steps li",
  ".landing-trust",
  ".landing-trust-features > *",
  ".landing-accident",
  ".landing-cta",
  ".landing-info-card",
  ".landing-info-photo",
  ".landing-form-card",
  ".landing-map",
  ".landing-availability",
  ".ss-section-head",
  ".ss-service-card",
  ".ss-rent-card",
  ".ss-sale-card",
  ".ss-why",
  ".ss-note",
  ".ss-footer-block",
  ".ss-footer-map",
].join(",");

/**
 * Only elements still below the fold are hidden, and only after hydration, so the
 * server HTML stays fully visible and nothing above the fold flickers.
 */
export function ScrollReveal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const done = (el: HTMLElement) => {
      el.classList.remove("reveal", "is-visible");
      el.style.removeProperty("--reveal-delay");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.classList.add("is-visible");
          // Drop the reveal classes afterwards so hover transitions go back to normal.
          const onEnd = (e: TransitionEvent) => {
            if (e.target !== el) return; // ignore transitions bubbling up from children
            el.removeEventListener("transitionend", onEnd);
            done(el);
          };
          el.addEventListener("transitionend", onEnd);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const hidden: HTMLElement[] = [];
    // Wait a frame so a newly navigated page is in the DOM before measuring it.
    const frame = requestAnimationFrame(() => {
      const root = document.querySelector(".landing-page main");
      root?.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        // Skip nested matches inside a block that is already animating.
        if (el.parentElement?.closest(".reveal")) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
        // Stagger siblings in the same grid row.
        const index = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
        el.style.setProperty("--reveal-delay", `${(index % 4) * 80}ms`);
        el.classList.add("reveal");
        observer.observe(el);
        hidden.push(el);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      hidden.forEach(done);
    };
  }, [pathname]);

  return null;
}
