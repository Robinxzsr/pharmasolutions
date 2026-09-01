/**
 * Site-wide configuration.
 *
 * Nav, brand, and contact details live here so Header, Footer, sitemap, and
 * SEO tags never drift apart. Marketing copy that changes often belongs in
 * `src/content/` instead.
 */

export const site = {
  name: "Pharmasolutions",
  tagline: "Pharmacology coaching that makes the mechanism click.",
  description:
    "A guided pharmacology coaching program for students and clinicians — built around mechanisms, not memorisation.",
  /** Absolute origin. Used by canonical URLs, OG tags, and the sitemap. */
  url: "https://pharmasolutions.example.com",
  locale: "en_GB",
  email: "hello@pharmasolutions.example.com",
} as const;

export type NavLink = {
  label: string;
  href: string;
  /** Renders as the single emphasised action in the header. */
  primary?: boolean;
};

/** Header navigation. */
export const primaryNav: NavLink[] = [
  { label: "Program", href: "/program" },
  { label: "Curriculum", href: "/curriculum" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/blog" },
  { label: "Enrol", href: "/enrol", primary: true },
];

/**
 * Footer link groups. The reference design uses four columns — keep this
 * array at four entries unless the footer layout changes with it.
 */
export const footerNav: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Program",
    links: [
      { label: "Overview", href: "/program" },
      { label: "Curriculum", href: "/curriculum" },
      { label: "Pricing", href: "/pricing" },
      { label: "Enrol", href: "/enrol" },
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
      { label: "Articles", href: "/blog" },
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
