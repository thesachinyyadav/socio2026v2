import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Master Admin Dashboard",
  description:
    "Master admin dashboard for SOCIO. Access user management, analytics, event approvals, and platform settings.",
  openGraph: {
    title: "Master Admin Dashboard | SOCIO",
    description:
      "Master admin dashboard for SOCIO — user management, analytics, and approvals.",
    url: `${SITE_URL}/masteradmin`,
  },
  alternates: {
    canonical: `${SITE_URL}/masteradmin`,
  },
};

export default function MasterAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
