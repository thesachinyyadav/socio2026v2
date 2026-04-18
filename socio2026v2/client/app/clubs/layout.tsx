import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Clubs & Centres",
  description:
    "Explore research centres, academic clubs, cultural societies, sports teams, and student organisations at Christ University. Find your community on SOCIO.",
  openGraph: {
    title: "Clubs & Centres | SOCIO",
    description:
      "Explore clubs, research centres, and student organisations at Christ University.",
    url: `${SITE_URL}/clubs`,
  },
  alternates: {
    canonical: `${SITE_URL}/clubs`,
  },
};

export default function ClubsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
