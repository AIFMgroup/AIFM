'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 mt-24 py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-lg font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
            </div>
            <p className="text-sm text-aifm-charcoal/60">
              AI-Powered Fund Management Platform
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider text-sm mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/terms" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/data-protection" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  Data Protection
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider text-sm mb-4">Resources</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/clients" className="text-aifm-charcoal/60 hover:text-aifm-gold transition">
                  For Clients
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-medium text-aifm-charcoal uppercase tracking-wider text-sm mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-aifm-charcoal/60">
              <li>
                <a href="mailto:info@aifm.se" className="hover:text-aifm-gold transition">
                  info@aifm.se
                </a>
              </li>
              <li>
                <a href="mailto:support@aifm.se" className="hover:text-aifm-gold transition">
                  support@aifm.se
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="gold-line mb-8"></div>

        {/* Copyright */}
        <div className="text-center text-sm text-aifm-charcoal/50">
          <p>© {currentYear} AIFM Group. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
