import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-gradient-to-b from-[#063168] to-[#3D75BD] pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Logo and contact info */}
          <div className="lg:col-span-1">
            <Link href={session ? "/Discover" : "/"}>
              <Image src={Logo} alt="SOCIO Logo" width={120} height={120} className="mb-5 brightness-0 invert" />
            </Link>
            <p className="text-white/80 text-base mb-6">
              Connecting campus through events, &amp; activities.
            </p>
            <div className="flex items-center mb-4">
              <a href="tel:+918861330665" className="flex items-center text-white/70 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-base">+91 88613 30665</span>
              </a>
            </div>
            <div className="flex items-center mb-4">
              <a href="mailto:thesocio.blr@gmail.com" className="flex items-center text-white/70 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-base">thesocio.blr@gmail.com</span>
              </a>
            </div>
            <div className="flex items-center mb-7">
              <a href="mailto:hr.socio.blr@gmail.com" className="flex items-center text-white/70 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-[#FFCC00]/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-base">hr.socio.blr@gmail.com</span>
              </a>
            </div>
            <div className="flex space-x-5">
              <a href="https://instagram.com/wsocio.in" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white hover:scale-110 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@the.socio.official" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white hover:scale-110 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/socio.official/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white hover:scale-110 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Navigate */}
          <div>
            <h3 className="font-semibold text-lg mb-5 text-white border-b border-[#FFCC00] pb-2">Navigate</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-white/70 text-base hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/Discover" className="text-white/70 text-base hover:text-white transition-colors">Discover</Link></li>
              <li><Link href="/events" className="text-white/70 text-base hover:text-white transition-colors">Events</Link></li>
              <li><Link href="/clubs" className="text-white/70 text-base hover:text-white transition-colors">Clubs</Link></li>
              <li><Link href="/about" className="text-white/70 text-base hover:text-white transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-lg mb-5 text-white border-b border-[#FFCC00] pb-2">Support</h3>
            <ul className="space-y-3">
              <li><a href="/contact" className="text-white/70 text-base hover:text-white transition-colors">Contact Us</a></li>
              <li><a href="/faq" className="text-white/70 text-base hover:text-white transition-colors">FAQs</a></li>
              <li><a href="/support" className="text-white/70 text-base hover:text-white transition-colors">Help Center</a></li>
              <li><Link href="/support/careers" className="text-white/70 text-base hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>

          {/* For Organizers */}
          <div>
            <h3 className="font-semibold text-lg mb-5 text-white border-b border-[#FFCC00] pb-2">For Organizers</h3>
            <ul className="space-y-3">
              <li><a href="https://gated.withsocio.com/" target="_blank" rel="noopener noreferrer" className="text-white/70 text-base hover:text-white transition-colors">Socio Gated</a></li>
              <li><a href="https://withsocio.com" target="_blank" rel="noopener noreferrer" className="text-white/70 text-base hover:text-white transition-colors">With Socio</a></li>
              <li><Link href="/solutions" className="text-white/70 text-base hover:text-white transition-colors">Our Solutions</Link></li>

            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-lg mb-5 text-white border-b border-[#FFCC00] pb-2">Legal</h3>
            <ul className="space-y-3">
              <li><Link href="/terms" className="text-white/70 text-base hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-white/70 text-base hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="text-white/70 text-base hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link href="/refunds" className="text-white/70 text-base hover:text-white transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-14 pt-6 border-t border-white/15 flex justify-center items-center">
          <p className="text-sm text-white/50">© {currentYear} SOCIO. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
