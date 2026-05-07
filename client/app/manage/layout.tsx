import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Manage Events",
  description:
    "Manage your events, registrations, and attendees in SOCIO. Track event analytics, send notifications, and manage event details.",
  openGraph: {
    title: "Manage Events | SOCIO",
    description:
      "Manage your events, registrations, and attendees in SOCIO.",
    url: `${SITE_URL}/manage`,
  },
  alternates: {
    canonical: `${SITE_URL}/manage`,
  },
};

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
