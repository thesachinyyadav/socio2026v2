import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the SOCIO team. Reach out for support, partnerships, feedback, or any questions about our campus event management platform.",
  openGraph: {
    title: "Contact Us | SOCIO",
    description:
      "Get in touch with the SOCIO team for support, partnerships, or feedback.",
    url: `${SITE_URL}/contact`,
  },
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
