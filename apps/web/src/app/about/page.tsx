'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { PasswordModal } from '@/components/PasswordModal';
import { 
  Shield, Zap, BarChart3, Users, Database, Globe, 
  ClipboardList, Brain
} from 'lucide-react';

export default function AboutPage() {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if user has already entered the correct code
    const accessGranted = localStorage.getItem('aifm_access_granted');
    const accessTime = localStorage.getItem('aifm_access_time');
    
    // Check if access was granted within the last 24 hours
    if (accessGranted === 'true' && accessTime) {
      const timeDiff = Date.now() - parseInt(accessTime);
      const hours24 = 24 * 60 * 60 * 1000;
      
      if (timeDiff < hours24) {
        setIsAuthorized(true);
        return;
      } else {
        // Access expired, clear it
        localStorage.removeItem('aifm_access_granted');
        localStorage.removeItem('aifm_access_time');
      }
    }
    
    // Show modal if not authorized
    setShowPasswordModal(true);
  }, []);

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    setIsAuthorized(true);
  };

  // Don't render content until authorized
  if (!isAuthorized) {
    return (
      <PasswordModal isOpen={showPasswordModal} onSuccess={handlePasswordSuccess} />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          {/* AIFM Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-aifm-gold rounded-3xl flex items-center justify-center shadow-aifm-xl">
              <span className="text-white font-bold text-5xl">A</span>
            </div>
          </div>
          
          <h1 className="heading-1 mb-6">
            About AIFM
          </h1>
          <p className="text-xl text-aifm-charcoal/70 mb-12 max-w-3xl mx-auto">
            AI-powered fund administration platform transforming how fund managers operate
          </p>
        </div>

        {/* Core Features Section */}
        <div className="mb-20">
          <h2 className="heading-2 mb-8 text-center">
            Complete Fund Management Solution
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">AI-Powered Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  Intelligent document processing, automated bookkeeping, and smart data extraction powered by GPT-4.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">Bank-Grade Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  Enterprise security with full audit trails, role-based access control, and four-eyes principle.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <BarChart3 className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">Real-Time Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  Live dashboards with NAV calculations, portfolio performance, and investor reporting.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">Investor Portal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  White-label portal for investors with KYC/AML, document sharing, and capital call tracking.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <Database className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">Treasury Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  Bank integrations, transaction matching, and automated cash flow management.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 bg-white rounded-2xl hover:shadow-lg hover:border-aifm-gold/30 transition-all duration-200">
              <CardHeader>
                <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-4">
                  <ClipboardList className="w-7 h-7 text-aifm-gold" />
                </div>
                <CardTitle className="text-lg">Regulatory Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-aifm-charcoal/60">
                  Built-in AIFMD, FATCA/CRS support with automated regulatory reporting.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Capabilities */}
        <div className="mb-20 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-3xl p-12 text-white">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-aifm-gold rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-medium uppercase tracking-wider mb-4">AI-Powered Bookkeeping</h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Our AI agents handle document processing, classification, and booking suggestions automatically.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl font-medium text-aifm-gold mb-2">95%</div>
              <p className="text-sm text-white/60 uppercase tracking-wider">Accuracy Rate</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-medium text-aifm-gold mb-2">&lt;5s</div>
              <p className="text-sm text-white/60 uppercase tracking-wider">Processing Time</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-medium text-aifm-gold mb-2">24/7</div>
              <p className="text-sm text-white/60 uppercase tracking-wider">Availability</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-medium text-aifm-gold mb-2">100%</div>
              <p className="text-sm text-white/60 uppercase tracking-wider">Audit Trail</p>
            </div>
          </div>
        </div>

        {/* Integration Partners */}
        <div className="mb-20">
          <h2 className="heading-2 mb-8 text-center">Integrations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {['Banks (PSD2)', 'Fortnox', 'BankID', 'AWS'].map((partner) => (
              <div 
                key={partner}
                className="bg-gray-50 rounded-xl p-6 text-center hover:bg-aifm-gold/5 transition-colors"
              >
                <Globe className="w-8 h-8 text-aifm-charcoal/40 mx-auto mb-3" />
                <p className="font-medium text-aifm-charcoal">{partner}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center">
          <h2 className="heading-2 mb-4">Get Started</h2>
          <p className="text-lg text-aifm-charcoal/60 mb-8 max-w-xl mx-auto">
            Ready to transform your fund administration? Contact us for a demo.
          </p>
          <a href="mailto:info@aifm.se" className="btn-primary">
            Contact Us
          </a>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
