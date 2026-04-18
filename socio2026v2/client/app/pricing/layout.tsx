import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Pricing & Plans",
  description:
    "Choose the right SOCIO plan for your university events — Free, Basic, or Pro. Transparent pricing for event organisers with per-fest and annual billing options.",
  openGraph: {
    title: "Pricing & Plans | SOCIO",
    description:
      "Transparent pricing for university event management — Free, Basic, and Pro plans.",
    url: `${SITE_URL}/pricing`,
  },
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
