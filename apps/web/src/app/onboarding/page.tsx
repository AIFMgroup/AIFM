'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, ArrowRight, ArrowLeft, Upload,
  User, Building2, FileText, Shield, CreditCard, PenTool,
  Mail, Phone, Globe, MapPin,
  Eye, Lock, Sparkles
} from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';

// Onboarding steps
const steps = [
  { id: 1, title: 'Grundläggande Info', icon: User, description: 'Personliga eller företagsuppgifter' },
  { id: 2, title: 'KYC-dokument', icon: FileText, description: 'Ladda upp ID och dokument' },
  { id: 3, title: 'Riskbedömning', icon: Shield, description: 'Investerarprofil och risktolerans' },
  { id: 4, title: 'Bankinformation', icon: CreditCard, description: 'Kontouppgifter för utbetalningar' },
  { id: 5, title: 'Signering', icon: PenTool, description: 'Granska och signera avtal' },
];

// Mock funds for selection
const availableFunds = [
  { id: 'fund-1', name: 'Nordic Growth Fund I', minInvestment: 5000000, currency: 'SEK', status: 'OPEN' },
  { id: 'fund-2', name: 'Scandinavian Tech Fund II', minInvestment: 1000000, currency: 'EUR', status: 'OPEN' },
  { id: 'fund-3', name: 'Baltic Real Estate Fund', minInvestment: 2000000, currency: 'EUR', status: 'CLOSED' },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [investorType, setInvestorType] = useState<'individual' | 'company' | null>(null);
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Basic info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    orgNumber: '',
    country: 'Sweden',
    address: '',
    city: '',
    postalCode: '',
    // Investment
    commitmentAmount: '',
    // KYC
    idUploaded: false,
    proofOfAddressUploaded: false,
    companyDocsUploaded: false,
    // Risk
    riskTolerance: '',
    investmentExperience: '',
    sourceOfFunds: '',
    isPEP: false,
    // Bank
    bankName: '',
    iban: '',
    bic: '',
    // Agreement
    agreementAccepted: false,
    termsAccepted: false,
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (fileType: string) => {
    // Simulate file upload
    if (fileType === 'ID') handleInputChange('idUploaded', true);
    if (fileType === 'ProofOfAddress') handleInputChange('proofOfAddressUploaded', true);
    if (fileType === 'CompanyDocs') handleInputChange('companyDocsUploaded', true);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (investorType === 'individual') {
          return formData.firstName && formData.lastName && formData.email && formData.country;
        }
        return formData.companyName && formData.orgNumber && formData.email && formData.country;
      case 2:
        return formData.idUploaded && formData.proofOfAddressUploaded;
      case 3:
        return formData.riskTolerance && formData.investmentExperience && formData.sourceOfFunds;
      case 4:
        return formData.bankName && formData.iban;
      case 5:
        return formData.agreementAccepted && formData.termsAccepted;
      default:
        return false;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-aifm-gold rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-medium tracking-widest text-aifm-charcoal uppercase text-sm">AIFM</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-aifm-charcoal/60">
              <Lock className="w-4 h-4" />
              <span>Säker anslutning</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="heading-2 mb-2">Investeraronboarding</h1>
          <p className="text-aifm-charcoal/60">Bli investerare i våra fonder - komplett digital process</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-aifm-gold text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>
                    <p className={`text-xs mt-2 font-medium ${isCurrent ? 'text-aifm-gold' : 'text-aifm-charcoal/50'}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 md:w-24 h-0.5 mx-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Step Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
                  {(() => {
                    const StepIcon = steps[currentStep - 1].icon;
                    return <StepIcon className="w-5 h-5 text-aifm-gold" />;
                  })()}
                </div>
                <div>
                  <h2 className="font-medium text-aifm-charcoal">{steps[currentStep - 1].title}</h2>
                  <p className="text-sm text-aifm-charcoal/60">{steps[currentStep - 1].description}</p>
                </div>
              </div>
              <HelpTooltip
                title="Onboarding"
                description="Alla steg måste fyllas i för att slutföra din ansökan. Din information behandlas konfidentiellt och enligt GDPR."
                steps={[
                  'Fyll i alla obligatoriska fält (markerade med *)',
                  'Ladda upp nödvändiga dokument',
                  'Granska och signera avtal digitalt',
                ]}
                tips={[
                  'Du kan spara och fortsätta senare',
                  'Kontakta oss om du har frågor',
                ]}
                position="left"
                size="md"
              />
            </div>
          </div>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="p-6">
              {/* Investor Type Selection */}
              {!investorType && (
                <div className="mb-8">
                  <label className="block text-sm font-medium text-aifm-charcoal/70 mb-4 uppercase tracking-wider">
                    Jag investerar som
                  </label>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setInvestorType('individual')}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-aifm-gold transition-colors text-left"
                    >
                      <User className="w-8 h-8 text-aifm-gold mb-3" />
                      <h3 className="font-medium text-aifm-charcoal mb-1">Privatperson</h3>
                      <p className="text-sm text-aifm-charcoal/60">Investera som individ</p>
                    </button>
                    <button
                      onClick={() => setInvestorType('company')}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-aifm-gold transition-colors text-left"
                    >
                      <Building2 className="w-8 h-8 text-aifm-gold mb-3" />
                      <h3 className="font-medium text-aifm-charcoal mb-1">Företag/Organisation</h3>
                      <p className="text-sm text-aifm-charcoal/60">Investera via juridisk person</p>
                    </button>
                  </div>
                </div>
              )}

              {investorType && (
                <div className="space-y-6">
                  {/* Fund Selection */}
                  <div>
                    <label className="block text-sm font-medium text-aifm-charcoal/70 mb-3 uppercase tracking-wider">
                      Välj Fond *
                    </label>
                    <div className="grid gap-3">
                      {availableFunds.map((fund) => (
                        <button
                          key={fund.id}
                          onClick={() => fund.status === 'OPEN' && setSelectedFund(fund.id)}
                          disabled={fund.status === 'CLOSED'}
                          className={`p-4 border-2 rounded-xl text-left transition-all ${
                            selectedFund === fund.id 
                              ? 'border-aifm-gold bg-aifm-gold/5' 
                              : fund.status === 'CLOSED'
                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 hover:border-aifm-gold/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-aifm-charcoal">{fund.name}</h4>
                              <p className="text-sm text-aifm-charcoal/60">
                                Min. {formatCurrency(fund.minInvestment, fund.currency)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                fund.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {fund.status === 'OPEN' ? 'Öppen' : 'Stängd'}
                              </span>
                              {selectedFund === fund.id && (
                                <CheckCircle2 className="w-5 h-5 text-aifm-gold" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {investorType === 'individual' ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                          Förnamn *
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="input w-full"
                          placeholder="Anna"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                          Efternamn *
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="input w-full"
                          placeholder="Svensson"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                          Företagsnamn *
                        </label>
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => handleInputChange('companyName', e.target.value)}
                          className="input w-full"
                          placeholder="Företag AB"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                          Org.nummer *
                        </label>
                        <input
                          type="text"
                          value={formData.orgNumber}
                          onChange={(e) => handleInputChange('orgNumber', e.target.value)}
                          className="input w-full"
                          placeholder="556xxx-xxxx"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                        E-post *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aifm-charcoal/30" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="input w-full pl-10"
                          placeholder="anna@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                        Telefon
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aifm-charcoal/30" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="input w-full pl-10"
                          placeholder="+46 70 123 45 67"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                      Land *
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aifm-charcoal/30" />
                      <select
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className="input w-full pl-10"
                      >
                        <option value="Sweden">Sverige</option>
                        <option value="Norway">Norge</option>
                        <option value="Denmark">Danmark</option>
                        <option value="Finland">Finland</option>
                        <option value="Other">Annat</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                      Adress
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-aifm-charcoal/30" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="input w-full pl-10"
                        placeholder="Storgatan 1"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                        Stad
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className="input w-full"
                        placeholder="Stockholm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                        Postnummer
                      </label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                        className="input w-full"
                        placeholder="111 22"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                      Planerat åtagande
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aifm-charcoal/50">SEK</span>
                      <input
                        type="number"
                        value={formData.commitmentAmount}
                        onChange={(e) => handleInputChange('commitmentAmount', e.target.value)}
                        className="input w-full pl-12"
                        placeholder="10 000 000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: KYC Documents */}
          {currentStep === 2 && (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">KYC/AML-verifiering</p>
                  <p className="text-sm text-blue-700">Vi är enligt lag skyldiga att verifiera din identitet. Alla dokument hanteras konfidentiellt.</p>
                </div>
              </div>

              {/* ID Upload */}
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  ID-handling *
                </label>
                <p className="text-sm text-aifm-charcoal/50 mb-3">Pass, körkort eller nationellt ID-kort</p>
                {formData.idUploaded ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-800">ID-handling uppladdad</span>
                    <button className="ml-auto text-sm text-green-600 hover:underline">Byt</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleFileUpload('ID')}
                    className="w-full p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-aifm-gold transition-colors text-center"
                  >
                    <Upload className="w-8 h-8 text-aifm-charcoal/30 mx-auto mb-2" />
                    <p className="text-sm text-aifm-charcoal/60">Klicka eller dra fil hit</p>
                  </button>
                )}
              </div>

              {/* Proof of Address */}
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Adressbevis *
                </label>
                <p className="text-sm text-aifm-charcoal/50 mb-3">Faktura eller kontoutdrag (max 3 månader gammalt)</p>
                {formData.proofOfAddressUploaded ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-800">Adressbevis uppladdat</span>
                    <button className="ml-auto text-sm text-green-600 hover:underline">Byt</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleFileUpload('ProofOfAddress')}
                    className="w-full p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-aifm-gold transition-colors text-center"
                  >
                    <Upload className="w-8 h-8 text-aifm-charcoal/30 mx-auto mb-2" />
                    <p className="text-sm text-aifm-charcoal/60">Klicka eller dra fil hit</p>
                  </button>
                )}
              </div>

              {investorType === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Företagsdokument
                  </label>
                  <p className="text-sm text-aifm-charcoal/50 mb-3">Registreringsbevis, bolagsordning</p>
                  {formData.companyDocsUploaded ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-800">Företagsdokument uppladdade</span>
                      <button className="ml-auto text-sm text-green-600 hover:underline">Byt</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleFileUpload('CompanyDocs')}
                      className="w-full p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-aifm-gold transition-colors text-center"
                    >
                      <Upload className="w-8 h-8 text-aifm-charcoal/30 mx-auto mb-2" />
                      <p className="text-sm text-aifm-charcoal/60">Klicka eller dra fil hit</p>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Risk Assessment */}
          {currentStep === 3 && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Risktolerans *
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {['Låg', 'Medel', 'Hög'].map((level) => (
                    <button
                      key={level}
                      onClick={() => handleInputChange('riskTolerance', level)}
                      className={`p-4 border-2 rounded-xl transition-all ${
                        formData.riskTolerance === level 
                          ? 'border-aifm-gold bg-aifm-gold/5' 
                          : 'border-gray-200 hover:border-aifm-gold/50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Investeringserfarenhet *
                </label>
                <select
                  value={formData.investmentExperience}
                  onChange={(e) => handleInputChange('investmentExperience', e.target.value)}
                  className="input w-full"
                >
                  <option value="">Välj...</option>
                  <option value="none">Ingen erfarenhet</option>
                  <option value="some">Viss erfarenhet (1-5 år)</option>
                  <option value="experienced">Erfaren (5-10 år)</option>
                  <option value="professional">Professionell (&gt;10 år)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Kapitalkälla *
                </label>
                <select
                  value={formData.sourceOfFunds}
                  onChange={(e) => handleInputChange('sourceOfFunds', e.target.value)}
                  className="input w-full"
                >
                  <option value="">Välj...</option>
                  <option value="salary">Lön/Pension</option>
                  <option value="business">Företagsvinst</option>
                  <option value="inheritance">Arv</option>
                  <option value="investment">Tidigare investeringar</option>
                  <option value="other">Annat</option>
                </select>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPEP}
                    onChange={(e) => handleInputChange('isPEP', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                  <div>
                    <p className="font-medium text-amber-800">Politiskt Exponerad Person (PEP)</p>
                    <p className="text-sm text-amber-700">Markera om du är eller är närstående till en person med politiskt utsatt ställning</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Bank Information */}
          {currentStep === 4 && (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Utbetalningskonto</p>
                  <p className="text-sm text-blue-700">Detta konto används för utdelningar och kapitalåterbäringar</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Banknamn *
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  className="input w-full"
                  placeholder="SEB, Swedbank, Nordea..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  IBAN *
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => handleInputChange('iban', e.target.value)}
                  className="input w-full font-mono"
                  placeholder="SE00 0000 0000 0000 0000 0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  BIC/SWIFT
                </label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => handleInputChange('bic', e.target.value)}
                  className="input w-full font-mono"
                  placeholder="ESSESESS"
                />
              </div>
            </div>
          )}

          {/* Step 5: Signing */}
          {currentStep === 5 && (
            <div className="p-6 space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Nästan klart!</p>
                  <p className="text-sm text-green-700">Granska villkoren och signera digitalt för att slutföra din ansökan</p>
                </div>
              </div>

              {/* Documents to sign */}
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-aifm-charcoal/40" />
                    <div>
                      <p className="font-medium text-aifm-charcoal">Limited Partnership Agreement</p>
                      <p className="text-sm text-aifm-charcoal/50">PDF • 45 sidor</p>
                    </div>
                  </div>
                  <button className="btn-outline py-1.5 px-3 text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Visa
                  </button>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-aifm-charcoal/40" />
                    <div>
                      <p className="font-medium text-aifm-charcoal">Subscription Agreement</p>
                      <p className="text-sm text-aifm-charcoal/50">PDF • 12 sidor</p>
                    </div>
                  </div>
                  <button className="btn-outline py-1.5 px-3 text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Visa
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreementAccepted}
                    onChange={(e) => handleInputChange('agreementAccepted', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                  <div>
                    <p className="font-medium text-aifm-charcoal">Jag har läst och godkänner avtalen *</p>
                    <p className="text-sm text-aifm-charcoal/60">Inklusive LPA och teckningsavtal</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) => handleInputChange('termsAccepted', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                  <div>
                    <p className="font-medium text-aifm-charcoal">Jag godkänner behandling av personuppgifter *</p>
                    <p className="text-sm text-aifm-charcoal/60">Enligt vår <Link href="/privacy" className="text-aifm-gold hover:underline">integritetspolicy</Link></p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="btn-outline py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Tillbaka
            </button>

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
                disabled={!canProceed()}
                className="btn-primary py-2 px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fortsätt
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => alert('Ansökan skickad! Vi granskar dina uppgifter och återkommer inom 2-3 arbetsdagar. (Demo)')}
                disabled={!canProceed()}
                className="btn-primary py-2 px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenTool className="w-4 h-4" />
                Signera med BankID
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-aifm-charcoal/60 mb-2">Behöver du hjälp?</p>
          <div className="flex items-center justify-center gap-4">
            <a href="mailto:onboarding@aifm.se" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
              <Mail className="w-4 h-4" />
              onboarding@aifm.se
            </a>
            <a href="tel:+4687001000" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
              <Phone className="w-4 h-4" />
              +46 8 700 10 00
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

