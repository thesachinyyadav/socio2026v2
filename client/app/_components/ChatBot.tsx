"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

/* ─── Types ─────────────────────────────────────────── */
interface QA { q: string; a: string }
interface Message { role: "user" | "assistant"; content: string }

/* ─── Preset Q&A databases ──────────────────────────── */
const GLOBAL_QA: QA[] = [
  { q: "What is Socio?", a: "Socio is a campus event management platform that lets you discover, register for, and manage college events and fests — all in one place." },
  { q: "How do I create an event?", a: "Go to the Manage page from the sidebar. If you have organiser access, you'll see a 'Create Event' button. Fill in the details and publish!" },
  { q: "How do I register for an event?", a: "Open any event page and click the 'Register' button. You'll need to be signed in with your college email." },
  { q: "How do I contact support?", a: "Head to the Contact page from the footer or sidebar. You can reach us via email or the support form." },
  { q: "Is there a mobile app?", a: "Yes! Socio has a Progressive Web App (PWA) for mobile. Visit the App Download page for instructions on how to install it." },
];

function getPageQA(pathname: string): QA[] {
  if (pathname === "/events") return [
    { q: "How do I find events?", a: "You're on the right page! Browse all upcoming events here. Use the search bar and filters to narrow down by category, date, or fest." },
    { q: "Can I filter by event type?", a: "Yes! Use the filter options at the top to filter by category (Technical, Cultural, Sports, etc.), date range, or associated fest." },
    { q: "Are events free?", a: "It depends on the event. Each event card shows whether it's free or paid. Click on an event for full details including pricing." },
    { q: "How do I know if registration is open?", a: "Events with open registration show a 'Register' button. If registration is closed, you'll see the status on the event card." },
  ];
  if (pathname.startsWith("/event/")) return [
    { q: "How do I register for this event?", a: "Click the 'Register' button on this page. Make sure you're signed in first. You'll receive a confirmation with your QR code." },
    { q: "Where is the venue?", a: "The venue details are shown in the event information section on this page. Look for the location/venue field." },
    { q: "Can I cancel my registration?", a: "You can view your registration status on your Profile page. Contact the event organiser directly for cancellations." },
    { q: "What is the QR code for?", a: "After registering, you receive a QR code. This is scanned at the venue entrance for attendance tracking. Keep it handy!" },
  ];
  if (pathname === "/fests") return [
    { q: "What is a fest?", a: "A fest is a collection of related events, usually spanning multiple days — like a college cultural or technical festival." },
    { q: "How do I view fest events?", a: "Click on any fest card to see all events that are part of that fest. You can register for individual events within." },
    { q: "When is the next fest?", a: "Check the fest cards on this page — each shows the start and end dates. Upcoming fests are listed first." },
  ];
  if (pathname.startsWith("/fest/")) return [
    { q: "What events are in this fest?", a: "Scroll down on this page to see all events that are part of this fest. You can register for each one individually." },
    { q: "How long does this fest run?", a: "The fest duration is shown at the top of this page with start and end dates." },
    { q: "Can I register for all events at once?", a: "You'll need to register for each event separately. Browse the events listed below and click Register on the ones you want." },
  ];
  if (pathname === "/profile") return [
    { q: "Where are my registrations?", a: "Your registered events are shown on this page under the Registrations section. You can also see your attendance history." },
    { q: "Can I edit my profile here?", a: "Profile editing is not available right now. You can use this page to view your details, registrations, attendance history, and QR codes." },
    { q: "Where is my QR code?", a: "Your QR codes for registered events appear in the Registrations section. Click on a registration to view or download your QR." },
  ];
  if (pathname === "/Discover") return [
    { q: "What is the Discover page?", a: "Discover helps you explore events and fests tailored to your interests. Browse by category to find something you'll enjoy!" },
    { q: "Can I search for specific events?", a: "Yes! Use the search bar at the top to find events by name, or use filters to narrow down by type and date." },
  ];
  if (pathname === "/manage") return [
    { q: "How do I create an event?", a: "Click 'Create Event' at the top of the Events tab. Fill in the event details like title, date, venue, and description, then publish." },
    { q: "How do I view registrations?", a: "Go to the Events tab, find your event, and click on it to see all registrations. You can also export the data." },
    { q: "How do I create a fest?", a: "Switch to the Fests tab and click 'Create Fest'. Set up the fest details, then add events to it from the Events tab." },
    { q: "How do reports work?", a: "Go to the Report tab to generate detailed reports. Choose fest or event mode, select your data, and export to Excel." },
  ];
  if (pathname === "/masteradmin") return [
    { q: "What can I do as master admin?", a: "You can manage all users, events, fests, view analytics, send notifications, and generate comprehensive reports." },
    { q: "How do I manage user roles?", a: "Go to the Users tab to view all users. You can assign roles like organiser or modify existing permissions." },
    { q: "How do I generate reports?", a: "Use the Report tab. Select fest or event mode, apply filters, and export detailed Excel reports with registration and attendance data." },
  ];
  if (pathname === "/" || pathname === "/dashboard") return [
    { q: "Where do I start?", a: "Welcome to Socio! Head to the Events page to browse upcoming events, or check out Fests to see what's happening on campus." },
    { q: "How do I sign in?", a: "Click the Sign In button in the top right. You can sign in with your Google account." },
    { q: "What can I do on Socio?", a: "Discover and register for campus events, track your registrations and attendance, and manage events if you're an organiser." },
  ];
  if (pathname === "/auth") return [
    { q: "How do I sign in?", a: "Click 'Sign in with Google' to use your Google account. Make sure to use your college email if required by your institution." },
    { q: "I can't sign in", a: "Make sure you're using a supported browser and that pop-ups aren't blocked. Try clearing your cache or using an incognito window." },
  ];
  return [];
}

/* ─── Fuzzy match typed questions ───────────────────── */
function findAnswer(input: string, qaList: QA[]): string | null {
  const lower = input.toLowerCase().trim();
  for (const qa of qaList) {
    const keywords = qa.q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits >= 2 || (keywords.length <= 3 && hits >= 1)) return qa.a;
  }
  if (/register|sign.?up|join/i.test(lower)) return "To register for an event, open the event page and click the 'Register' button. Make sure you're signed in first!";
  if (/qr|code|ticket/i.test(lower)) return "After registering, you receive a unique QR code used for attendance tracking. Find it on your Profile page.";
  if (/cancel|refund/i.test(lower)) return "To cancel a registration, please contact the event organiser directly. You can find their details on the event page.";
  if (/contact|help|support/i.test(lower)) return "You can reach our support team via the Contact page. Navigate there from the sidebar or footer.";
  if (/create|make|new.*event/i.test(lower)) return "To create an event, go to the Manage page. If you have organiser access, you'll see a 'Create Event' button.";
  if (/fest|festival/i.test(lower)) return "Fests are collections of related events. Visit the Fests page to browse upcoming festivals.";
  if (/profile|account/i.test(lower)) return "Visit your Profile page to view your registrations, attendance history, and QR codes. Profile editing is not available right now.";
  return null;
}

/* ─── Component ─────────────────────────────────────── */
export default function ChatBot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm SocioAssist — your campus event guide. Pick a question below and I’ll help." },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pageQA = getPageQA(pathname);
  const allQA = [...pageQA, ...GLOBAL_QA];
  const quickQuestions = [...pageQA.slice(0, 4), ...GLOBAL_QA.slice(0, Math.max(0, 4 - pageQA.length))].map((qa) => qa.q);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    setMessages([{ role: "assistant", content: "Hi! I'm SocioAssist — your campus event guide. Pick a question below and I’ll help." }]);
  }, [pathname]);
  const handleQuestion = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: text.trim() }]);
    const answer = findAnswer(text, allQA);
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: answer || "I'm not sure about that one yet. Try another question below, or visit the FAQ or Contact page for more help.",
      }]);
    }, 400);
  };

  const asked = messages.filter((m) => m.role === "user").map((m) => m.content);
  const remaining = quickQuestions.filter((q) => !asked.includes(q));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {isOpen && (
          <div className="mb-4 w-[360px] h-[520px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-[#154CB3] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    <circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm">SocioAssist</p>
                  <p className="text-xs text-blue-100">Quick Help</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#154CB3] text-white rounded-br-md"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {remaining.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {remaining.map((q) => (
                    <button key={q} onClick={() => handleQuestion(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors cursor-pointer">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>


          </div>
        )}

        {/* FAB */}
        <button onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-[#154CB3] hover:bg-[#0d3580] text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all hover:shadow-xl hover:scale-105">
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

