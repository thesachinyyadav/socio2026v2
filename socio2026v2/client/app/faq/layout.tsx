import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";
import { FAQPageJsonLd } from "@/app/_components/JsonLd";

const faqItems = [
  {
    question: "What is SOCIO?",
    answer:
      "SOCIO is a campus event management platform for Christ University that lets students discover, register, and manage events, fests, clubs, and workshops.",
  },
  {
    question: "How do I register for an event?",
    answer:
      "Sign in with your university Google account, browse events, and click Register on any event page. You'll receive a confirmation with a QR code.",
  },
  {
    question: "Is SOCIO free to use?",
    answer:
      "Yes, SOCIO is free for students to browse and register for events. Organisers can choose from Free, Basic, or Pro plans.",
  },
  {
    question: "Can outsiders register for events?",
    answer:
      "Some events allow external participants. Check the event details page — if outsider registration is enabled, you'll see an option to register as a visitor.",
  },
];

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about SOCIO — event registration, accounts, technical issues, organiser tools, and more.",
  openGraph: {
    title: "FAQ | SOCIO",
    description:
      "Find answers to common questions about SOCIO — event registration, accounts, and more.",
    url: `${SITE_URL}/faq`,
  },
  alternates: {
    canonical: `${SITE_URL}/faq`,
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FAQPageJsonLd questions={faqItems} />
      {children}
    </>
  );
}
