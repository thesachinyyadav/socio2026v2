import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full border-t border-gray-200 py-8 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between">
          {/* Logo and contact info */}
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <Link href={session ? "/Discover" : "/"}>
              <Image src={Logo} alt="SOCIO Logo" width={100} height={100} className="mb-4" />
            </Link>
            <p className="text-gray-600 mb-4">
              Connecting campus through events, & activities.
            </p>
            <div className="flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#154CB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href="tel:+918861330665" className="hover:text-[#154CB3]">+91 88613 30665</a>
            </div>
            <div className="flex items-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#154CB3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <a href="mailto:thesocio.blr@gmail.com" className="hover:text-[#154CB3]">thesocio.blr@gmail.com</a>
            </div>
            <div className="flex items-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#FFCC00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7V5a3 3 0 013-3h6a3 3 0 013 3v2m-2 4l-1 9H9l-1-9m-2 0h12" />
              </svg>
              <a href="mailto:hr.socio.blr@gmail.com" className="hover:text-[#154CB3]">hr.socio.blr@gmail.com</a>
            </div>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/the.socio.official" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-br from-purple-600 to-orange-500 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="http://www.youtube.com/@the.socio.official" target="_blank" rel="noopener noreferrer" className="bg-red-600 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/socio.official/" target="_blank" rel="noopener noreferrer" className="bg-blue-700 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
                </svg>
              </a>
              <a href="https://x.com/thesociofficial" target="_blank" rel="noopener noreferrer" className="bg-black p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
            </div>
          </div>
          
          {/* Navigation links */}
          <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-4 text-[#154CB3] border-b border-[#FFCC00] pb-2">Navigate</h3>
              <ul className="space-y-2">
                <li><Link href="/" className="text-gray-600 hover:text-[#154CB3]">Home</Link></li>
                <li><Link href="/Discover" className="text-gray-600 hover:text-[#154CB3]">Discover</Link></li>
                <li><Link href="/events" className="text-gray-600 hover:text-[#154CB3]">Events</Link></li>
                <li><Link href="/clubs" className="text-gray-600 hover:text-[#154CB3]">Clubs</Link></li>
                <li><Link href="/about" className="text-gray-600 hover:text-[#154CB3]">About Us</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4 text-[#154CB3] border-b border-[#FFCC00] pb-2">Support</h3>
              <ul className="space-y-2">
                <li><a href="/about" className="text-gray-600 hover:text-[#154CB3]">Contact Us</a></li>
                <li><a href="/about#faqs" className="text-gray-600 hover:text-[#154CB3]">FAQs</a></li>
                <li><a href="/about#feedback" className="text-gray-600 hover:text-[#154CB3]">Feedback</a></li>
                <li><a href="/about" className="text-gray-600 hover:text-[#154CB3]">Help Center</a></li>
                <li><Link href="/support/careers" className="text-gray-600 hover:text-[#154CB3]">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4 text-[#154CB3] border-b border-[#FFCC00] pb-2">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/terms" className="text-gray-600 hover:text-[#154CB3]">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-gray-600 hover:text-[#154CB3]">Privacy Policy</Link></li>
                <li><Link href="/cookies" className="text-gray-600 hover:text-[#154CB3]">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-2 sm:mb-0">© {currentYear} SOCIO. All rights reserved.</p>
          <div className="flex space-x-4">
            <Link href="/about" className="text-sm text-gray-600 hover:text-[#154CB3]">About</Link>
            <Link href="/terms" className="text-sm text-gray-600 hover:text-[#154CB3]">Terms</Link>
            <Link href="/privacy" className="text-sm text-gray-600 hover:text-[#154CB3]">Privacy</Link>
            <Link href="/about#feedback" className="text-sm text-gray-600 hover:text-[#154CB3]">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}