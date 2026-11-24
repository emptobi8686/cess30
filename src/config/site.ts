export const siteConfig = {
  name: "BLUEPRINT",
  shortName: "BP",
  description:
    "A digital academic companion for Civil Engineering students at the University of Lagos.",
  location: "University of Lagos • Civil Engineering",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
