import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Support & Help Center",
  description:
    "Need help with SOCIO? Browse support articles on accounts, event registration, technical issues, organiser tools, and the mobile app.",
  openGraph: {
    title: "Support & Help Center | SOCIO",
    description:
      "Browse support articles for SOCIO — accounts, event registration, technical issues, and more.",
    url: `${SITE_URL}/support`,
  },
  alternates: {
    canonical: `${SITE_URL}/support`,
  },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
