import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Read the SOCIO Cookie Policy. Understand what cookies we use, why, and how you can manage them on our campus event management platform.",
  openGraph: {
    title: "Cookie Policy | SOCIO",
    description:
      "Understand what cookies SOCIO uses and how to manage them.",
    url: `${SITE_URL}/cookies`,
  },
  alternates: {
    canonical: `${SITE_URL}/cookies`,
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
