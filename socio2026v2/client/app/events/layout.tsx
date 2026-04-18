import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "All Events",
  description:
    "Explore all campus events at Christ University — academic, cultural, sports, literary, arts, and innovation events. Filter, search, and register on SOCIO.",
  openGraph: {
    title: "All Campus Events | SOCIO",
    description:
      "Explore all campus events at Christ University — academic, cultural, sports, literary, arts, and innovation.",
    url: `${SITE_URL}/events`,
  },
  alternates: {
    canonical: `${SITE_URL}/events`,
  },
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
