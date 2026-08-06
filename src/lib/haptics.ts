// Lightweight haptic feedback helpers (no-op where unsupported).
export type HapticStyle = "light" | "medium" | "heavy" | "success" | "error";

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 28,
  success: [10, 40, 18],
  error: [24, 60, 24],
};

export function haptic(style: HapticStyle = "light") {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    navigator.vibrate(PATTERNS[style]);
  } catch {
    /* ignore */
  }
}

/** Attaches global tap haptics + ripple-free "pop" to interactive elements. */
export function installGlobalHaptics() {
  if (typeof document === "undefined") return () => {};
  const onPointerDown = (e: Event) => {
    const target = e.target as HTMLElement | null;
    const el = target?.closest?.(
      'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, summary',
    ) as HTMLElement | null;
    if (!el || el.hasAttribute("disabled") || el.dataset["noHaptic"] === "true") return;
    haptic(el.dataset["haptic"] as HapticStyle | undefined ?? "light");
  };
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onPointerDown);
}

/** Reveals elements on scroll by toggling the `is-revealed` class. */
export function installScrollReveal(root?: HTMLElement | null) {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return () => {};
  const scope: ParentNode = root ?? document;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );

  const collect = () => {
    scope
      .querySelectorAll<HTMLElement>("main section, main article, main [data-reveal]")
      .forEach((el) => {
        if (el.classList.contains("reveal-on-scroll") || el.classList.contains("is-revealed")) return;
        el.classList.add("reveal-on-scroll");
        observer.observe(el);
      });
  };
  collect();

  const mo = new MutationObserver(() => collect());
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    observer.disconnect();
  };
}
