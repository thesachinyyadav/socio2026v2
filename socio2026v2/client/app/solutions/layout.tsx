import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "See how SOCIO powers college fests, department events, workshops, and more. End-to-end event management solutions for universities and student organisations.",
  openGraph: {
    title: "Solutions | SOCIO",
    description:
      "End-to-end event management solutions for college fests, department events, and student organisations.",
    url: `${SITE_URL}/solutions`,
  },
  alternates: {
    canonical: `${SITE_URL}/solutions`,
  },
};

export default function SolutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
