import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "About SOCIO",
  description:
    "Learn about SOCIO — the campus event management platform built for Christ University. Discover our features, mission, and how we simplify event registration and management.",
  openGraph: {
    title: "About SOCIO – Campus Event Management Platform",
    description:
      "Learn about SOCIO, our mission, our features, and how we simplify campus event management.",
    url: `${SITE_URL}/about`,
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
