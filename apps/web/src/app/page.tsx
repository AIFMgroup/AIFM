'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Shield, 
  BarChart3, 
  Users, 
  FileText, 
  Wallet,
  Building2,
  TrendingUp,
  Lock,
  Zap,
  Globe,
  CheckCircle2
} from 'lucide-react';
import { getFundStats, formatCurrency, mockFunds } from '@/lib/fundData';

export default function HomePage() {
  const stats = getFundStats();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-xl font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm font-medium text-aifm-charcoal/70 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                Features
              </Link>
              <Link href="#platform" className="text-sm font-medium text-aifm-charcoal/70 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                Platform
              </Link>
              <Link href="#about" className="text-sm font-medium text-aifm-charcoal/70 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                About
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link 
                href="/sign-in"
                className="text-sm font-medium text-aifm-charcoal hover:text-aifm-gold transition-colors uppercase tracking-wider"
              >
                Sign In
              </Link>
              <Link 
                href="/admin/dashboard"
                className="btn-primary text-sm"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-aifm-gold/10 rounded-full">
                <div className="w-2 h-2 bg-aifm-gold rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-aifm-gold uppercase tracking-wider">
                  AI-Powered Fund Administration
                </span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-medium leading-tight">
                THE FUTURE OF
                <span className="block text-aifm-gold">FUND MANAGEMENT</span>
              </h1>
              
              <p className="text-lg text-aifm-charcoal/70 max-w-xl leading-relaxed">
                Streamline your fund operations with AI-powered automation. From investor onboarding 
                to regulatory compliance, we handle the complexity so you can focus on generating returns.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/admin/dashboard" className="btn-primary text-center">
                  <span>Access Platform</span>
                  <ArrowRight className="w-4 h-4 ml-2 inline" />
                </Link>
                <Link href="#platform" className="btn-outline text-center">
                  Learn More
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-8 text-white shadow-aifm-xl animate-fade-in">
                <p className="text-sm font-medium uppercase tracking-wider text-white/60 mb-2">Total AUM</p>
                <p className="text-4xl font-medium">{formatCurrency(stats.totalAUM, 'SEK')}</p>
                <div className="flex items-center gap-2 mt-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">+18.5% YTD</span>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm hover:shadow-aifm-lg transition-shadow animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-aifm-gold" />
                </div>
                <p className="text-3xl font-medium text-aifm-charcoal">{stats.totalInvestors}</p>
                <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Investors</p>
              </div>
              
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm hover:shadow-aifm-lg transition-shadow animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="w-5 h-5 text-aifm-gold" />
                </div>
                <p className="text-3xl font-medium text-aifm-charcoal">{stats.totalPortfolioCompanies}</p>
                <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Portfolio Co.</p>
              </div>
              
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm hover:shadow-aifm-lg transition-shadow animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <Wallet className="w-5 h-5 text-aifm-gold" />
                </div>
                <p className="text-3xl font-medium text-aifm-charcoal">{stats.fundsCount}</p>
                <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Active Funds</p>
              </div>
              
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm hover:shadow-aifm-lg transition-shadow animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-medium text-aifm-charcoal">99.8%</p>
                <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Compliance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="gold-line"></div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-2 mb-4">Complete Fund Administration</h2>
            <p className="text-lg text-aifm-charcoal/60 max-w-2xl mx-auto">
              Everything you need to manage your funds efficiently, all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Investor Portal',
                description: 'Digital onboarding, KYC/AML verification, and secure document sharing with your LPs.',
              },
              {
                icon: Wallet,
                title: 'Capital Management',
                description: 'Automated capital calls and distributions with real-time tracking and notifications.',
              },
              {
                icon: BarChart3,
                title: 'Portfolio Monitoring',
                description: 'Track portfolio company performance with automated data ingestion and analytics.',
              },
              {
                icon: FileText,
                title: 'Fund Accounting',
                description: 'Automated bookkeeping, NAV calculations, and comprehensive financial reporting.',
              },
              {
                icon: Shield,
                title: 'Compliance Hub',
                description: 'Built-in regulatory compliance with AIFMD, FATCA/CRS reporting support.',
              },
              {
                icon: Wallet,
                title: 'Treasury',
                description: 'Bank integrations, transaction matching, and cash flow management.',
              },
            ].map((feature) => (
              <div 
                key={feature.title}
                className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-aifm-gold/30 shadow-aifm hover:shadow-aifm-lg transition-all duration-300"
              >
                <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-aifm-gold/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-aifm-gold" />
                </div>
                <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wide mb-3">
                  {feature.title}
                </h3>
                <p className="text-aifm-charcoal/60 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Preview Section */}
      <section id="platform" className="py-24 px-6 lg:px-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="heading-2">AI-Powered Automation</h2>
              <p className="text-lg text-aifm-charcoal/70 leading-relaxed">
                Our intelligent agents handle the heavy lifting – from document analysis to transaction 
                categorization. Focus on what matters while AI takes care of the routine.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: Zap, text: 'Automatic document classification and data extraction' },
                  { icon: Lock, text: 'Bank-grade security with full audit trails' },
                  { icon: Globe, text: 'Multi-currency and multi-jurisdiction support' },
                  { icon: CheckCircle2, text: 'Four-eyes principle for critical transactions' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-aifm-gold/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-aifm-gold" />
                    </div>
                    <p className="text-aifm-charcoal/80">{item.text}</p>
                  </div>
                ))}
              </div>
              
              <Link href="/admin/dashboard" className="btn-primary inline-flex items-center">
                Explore Platform
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>

            {/* Dashboard Preview */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-aifm-gold/20 to-aifm-charcoal/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-aifm-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <h4 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Fund Overview</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 uppercase tracking-wider">Live</span>
                  </div>
                </div>
                
                {mockFunds.slice(0, 3).map((fund) => (
                  <div key={fund.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-aifm-gold/5 transition-colors">
                    <div>
                      <p className="font-medium text-aifm-charcoal">{fund.name}</p>
                      <p className="text-sm text-aifm-charcoal/60">{fund.type.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-aifm-charcoal">{formatCurrency(fund.nav, fund.currency)}</p>
                      <p className="text-sm text-green-600">+{fund.irr}% IRR</p>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-aifm-charcoal/60 uppercase tracking-wider">Total NAV</span>
                    <span className="font-medium text-aifm-charcoal">{formatCurrency(stats.totalAUM, 'SEK')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="heading-2 mb-6">Ready to Transform Your Fund Operations?</h2>
          <p className="text-lg text-aifm-charcoal/60 mb-10 max-w-2xl mx-auto">
            Join leading fund managers who trust AIFM for their fund administration needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/admin/dashboard" className="btn-primary">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2 inline" />
            </Link>
            <Link href="/about" className="btn-outline">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-aifm-gold rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <span className="font-medium tracking-widest text-aifm-charcoal uppercase">AIFM</span>
            </div>
            
            <div className="flex items-center gap-8">
              <Link href="/privacy" className="text-sm text-aifm-charcoal/60 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-aifm-charcoal/60 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                Terms
              </Link>
              <Link href="/cookies" className="text-sm text-aifm-charcoal/60 hover:text-aifm-gold transition-colors uppercase tracking-wider">
                Cookies
              </Link>
            </div>
            
            <p className="text-sm text-aifm-charcoal/40">
              © {new Date().getFullYear()} AIFM Group. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
