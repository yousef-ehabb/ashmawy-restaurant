/**
 * HeroWaveTransition
 *
 * An elegant, smooth, asymmetric wave transition between the Hero Slideshow
 * and the warm cream Menu section for Ashmawy Restaurant.
 *
 * Design Specifications:
 * - Asymmetric, broad cubic Bezier wave avoiding repetitive sine patterns.
 * - Two thin, refined accent layers:
 *   1) Deep burgundy red (oklch(0.38 0.16 26))
 *   2) Brand primary red (oklch(0.6 0.21 31))
 *   3) Warm cream base (oklch(0.975 0.018 70) / var(--color-background))
 * - Fluid scaling across all screen sizes (preserveAspectRatio="none") without horizontal overflow.
 * - Responsive height: compact on mobile (~28px) to preserve screen real estate;
 *   subtle and broad on desktop (~48-54px).
 * - Positioned with pointer-events-none and z-[8] to remain behind interactive elements
 *   (slide indicators z-30, CTA button z-10).
 */

export function HeroWaveTransition() {
  return (
    <div
      className="hero-wave-transition pointer-events-none absolute -bottom-[1px] inset-x-0 z-[8] w-full overflow-hidden leading-none select-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="hero-wave-svg block w-full"
      >
        {/* Layer 1: Subtle Deep Burgundy Accent Wave (Top-most ribbon) */}
        <path
          d="M0,17 C320,31 540,29 740,19 C940,9 1220,5 1440,13 L1440,56 L0,56 Z"
          fill="oklch(0.38 0.16 26)"
          className="transition-colors duration-300"
        />

        {/* Layer 2: Subtle Brand Primary Red Accent Wave (Middle ribbon) */}
        <path
          d="M0,19.5 C320,33.5 540,31.5 740,21.5 C940,11.5 1220,7.5 1440,15.5 L1440,56 L0,56 Z"
          fill="var(--color-primary, oklch(0.6 0.21 31))"
          className="transition-colors duration-300"
        />

        {/* Layer 3: Warm Cream Base Wave (Blends seamlessly into Menu background) */}
        <path
          d="M0,22 C320,36 540,34 740,24 C940,14 1220,10 1440,18 L1440,56 L0,56 Z"
          fill="var(--color-background, oklch(0.975 0.018 70))"
          className="transition-colors duration-300"
        />
      </svg>
    </div>
  );
}

