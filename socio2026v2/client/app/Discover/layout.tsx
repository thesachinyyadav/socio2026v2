import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Discover Events",
  description:
    "Browse trending events, upcoming fests, clubs, and workshops happening across Christ University campuses. Find something that excites you on SOCIO.",
  openGraph: {
    title: "Discover Campus Events | SOCIO",
    description:
      "Browse trending events, upcoming fests, clubs, and workshops happening across Christ University campuses.",
    url: `${SITE_URL}/Discover`,
  },
  alternates: {
    canonical: `${SITE_URL}/Discover`,
  },
};

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
