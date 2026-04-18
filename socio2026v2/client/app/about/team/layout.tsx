import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Meet the Team",
  description:
    "Meet the founders, developers, and faculty behind SOCIO — the team of Christ University students and mentors building the campus event management platform.",
  openGraph: {
    title: "Meet the Team | SOCIO",
    description:
      "The founders, developers, and mentors behind SOCIO.",
    url: `${SITE_URL}/about/team`,
  },
  alternates: {
    canonical: `${SITE_URL}/about/team`,
  },
};

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
