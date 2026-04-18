import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Our Mission",
  description:
    "SOCIO's mission is to simplify campus event management at Christ University — making it easy for students to discover, register, and engage with events.",
  openGraph: {
    title: "Our Mission | SOCIO",
    description:
      "SOCIO's mission to simplify campus event management for Christ University students.",
    url: `${SITE_URL}/about/mission`,
  },
  alternates: {
    canonical: `${SITE_URL}/about/mission`,
  },
};

export default function MissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
