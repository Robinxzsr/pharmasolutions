/**
 * Site-wide configuration.
 *
 * Nav, brand, and contact details live here so Header, Footer, sitemap, and
 * SEO tags never drift apart. Marketing copy that changes often belongs in
 * `src/content/` instead.
 */

export const site = {
  name: "pharmacology.solutions",
  tagline: "Enhance or be left behind",
  description:
    "Personalized pharmacology coaching for those who know the world is theirs for the taking.",
  /** Absolute origin. Used by canonical URLs, OG tags, and the sitemap. */
  url: "https://pharmacology.solutions",
  locale: "en_GB",
  email: "hello@pharmacology.solutions",
} as const;

export type NavLink = {
  label: string;
  href: string;
  /** Renders as the single emphasised action in the header. */
  primary?: boolean;
};

/** Header navigation. */
export const primaryNav: NavLink[] = [
  { label: "Protocols", href: "/protocols" },
  { label: "Coaching", href: "/coaching" },
  { label: "Blog", href: "/blog" },
];

/**
 * Footer link groups.
 *
 * CURRENTLY UNUSED. The footer is a colophon now — wordmark, capture, and a
 * legal hairline — and it no longer renders a sitemap (see Footer.astro).
 * Kept here rather than deleted because it is the record of what the site's
 * full page list actually is, and because restoring a column layout
 * should not mean re-typing it.
 *
 * NOTE: everything in here that is not also in `primaryNav` is now reachable
 * only by direct URL — Curriculum, Pricing, About, Coaches, Contact, FAQ.
 * If those matter, they belong in `primaryNav` above, not in a resurrected
 * footer.
 */
export const footerNav: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Program",
    links: [
      { label: "Protocols", href: "/protocols" },
      { label: "Coaching", href: "/coaching" },
      { label: "Curriculum", href: "/curriculum" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Coaches", href: "/about#coaches" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
    ],
  },
];

export const socials: { label: string; href: string }[] = [
  { label: "X", href: "https://x.com/" },
  { label: "LinkedIn", href: "https://linkedin.com/" },
  { label: "Instagram", href: "https://instagram.com/" },
];
