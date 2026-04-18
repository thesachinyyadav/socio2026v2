import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the SOCIO Terms of Service. These terms govern your access and use of the SOCIO campus event management platform at Christ University.",
  openGraph: {
    title: "Terms of Service | SOCIO",
    description:
      "Terms governing access and use of the SOCIO campus event management platform.",
    url: `${SITE_URL}/terms`,
  },
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
