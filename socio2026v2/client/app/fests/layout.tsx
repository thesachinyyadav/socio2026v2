import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Fests",
  description:
    "Discover college fests at Christ University — tech fests, cultural fests, science expos, management summits, sports meets, and more. Browse and register on SOCIO.",
  openGraph: {
    title: "College Fests | SOCIO",
    description:
      "Discover college fests at Christ University — tech, cultural, science, management, sports and more.",
    url: `${SITE_URL}/fests`,
  },
  alternates: {
    canonical: `${SITE_URL}/fests`,
  },
};

export default function FestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
