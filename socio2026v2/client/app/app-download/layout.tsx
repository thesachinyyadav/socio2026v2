import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Download the SOCIO App",
  description:
    "Download the SOCIO mobile app — browse campus events, register on the go, and get real-time notifications for Christ University events.",
  openGraph: {
    title: "Download the SOCIO App",
    description:
      "Get the SOCIO mobile app to browse and register for campus events on the go.",
    url: `${SITE_URL}/app-download`,
  },
  alternates: {
    canonical: `${SITE_URL}/app-download`,
  },
};

export default function AppDownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
