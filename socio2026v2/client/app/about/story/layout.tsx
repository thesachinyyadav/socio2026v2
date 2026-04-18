import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "The story behind SOCIO — how a team of Christ University students built the campus event management platform to transform how students discover and engage with events.",
  openGraph: {
    title: "Our Story | SOCIO",
    description:
      "How SOCIO was born — the story behind the campus event management platform.",
    url: `${SITE_URL}/about/story`,
  },
  alternates: {
    canonical: `${SITE_URL}/about/story`,
  },
};

export default function StoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
