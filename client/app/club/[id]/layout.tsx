import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";
import { createClient } from "@supabase/supabase-js";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    
    const { data } = await supabase
      .from("clubs")
      .select("name, description")
      .eq("id", id)
      .single();

    if (data?.name) {
      return {
        title: data.name,
        description: data.description || "Club details on SOCIO",
        openGraph: {
          title: `${data.name} | SOCIO`,
          description: data.description || "Club details on SOCIO",
          url: `${SITE_URL}/club/${id}`,
        },
        alternates: {
          canonical: `${SITE_URL}/club/${id}`,
        },
      };
    }
  } catch (error) {
    console.error("Error fetching club metadata:", error);
  }

  return {
    title: "Club Details",
    description: "View club details on SOCIO",
    openGraph: {
      title: "Club Details | SOCIO",
      description: "View club details on SOCIO",
      url: `${SITE_URL}/club/${id}`,
    },
  };
}

export default async function ClubLayout({ children }: Props) {
  return <>{children}</>;
}
