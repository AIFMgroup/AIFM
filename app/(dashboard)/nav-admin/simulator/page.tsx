'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calculator, TrendingUp, TrendingDown, DollarSign,
  Percent, RefreshCw, Play, RotateCcw, AlertTriangle, Info,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  fxChanges: Record<string, number>;
  priceChanges: Record<string, number>;
  cashChange: number;
  redemptions: number;
  subscriptions: number;
}

interface SimulationResult {
  fundId: string;
  fundName: string;
  shareClassId: string;
  shareClassName: string;
  currentNav: number;
  simulatedNav: number;
  change: number;
  changePercent: number;
  impactBreakdown: {
    fxImpact: number;
    priceImpact: number;
    flowImpact: number;
  };
}

// ============================================================================
// Mock Data
// ============================================================================

const mockCurrentNAV = [
  { fundId: 'f1', fundName: 'AUAG Essential Metals', shareClassId: 'sc1a', shareClassName: 'A', currentNav: 142.42, aum: 2460000000, currency: 'SEK' },
  { fundId: 'f2', fundName: 'AuAg Gold Rush', shareClassId: 'sc2a', shareClassName: 'A', currentNav: 208.71, aum: 2424000000, currency: 'SEK' },
  { fundId: 'f3', fundName: 'AuAg Precious Green', shareClassId: 'sc3a', shareClassName: 'A', currentNav: 198.87, aum: 1651000000, currency: 'SEK' },
  { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClassId: 'sc4a', shareClassName: 'A', currentNav: 378.33, aum: 8911000000, currency: 'SEK' },
];

const presetScenarios: SimulationScenario[] = [
  {
    id: 's1',
    name: 'SEK försvagas 5%',
    description: 'Svenska kronan försvagas 5% mot USD och EUR',
    fxChanges: { 'USD/SEK': 5, 'EUR/SEK': 5 },
    priceChanges: {},
    cashChange: 0,
    redemptions: 0,
    subscriptions: 0,
  },
  {
    id: 's2',
    name: 'Guldpris +10%',
    description: 'Guldpriset stiger 10%',
    fxChanges: {},
    priceChanges: { 'XAU': 10 },
    cashChange: 0,
    redemptions: 0,
    subscriptions: 0,
  },
  {
    id: 's3',
    name: 'Silverpris -15%',
    description: 'Silverpriset faller 15%',
    fxChanges: {},
    priceChanges: { 'XAG': -15 },
    cashChange: 0,
    redemptions: 0,
    subscriptions: 0,
  },
  {
    id: 's4',
    name: 'Stor inlösen',
    description: '100 Mkr i inlösen',
    fxChanges: {},
    priceChanges: {},
    cashChange: 0,
    redemptions: 100000000,
    subscriptions: 0,
  },
  {
    id: 's5',
    name: 'Marknadskrasch',
    description: 'Alla tillgångar -20%, SEK stärks 10%',
    fxChanges: { 'USD/SEK': -10, 'EUR/SEK': -10 },
    priceChanges: { 'ALL': -20 },
    cashChange: 0,
    redemptions: 50000000,
    subscriptions: 0,
  },
];

// ============================================================================
// Components
// ============================================================================

function SliderInput({ 
  label, 
  value, 
  onChange, 
  min = -50, 
  max = 50, 
  unit = '%',
  helpText 
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  min?: number; 
  max?: number; 
  unit?: string;
  helpText?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold"
          />
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-aifm-gold"
      />
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
  );
}

function ResultCard({ result }: { result: SimulationResult }) {
  const isPositive = result.changePercent > 0;
  const isNegative = result.changePercent < 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:border-aifm-gold/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-aifm-charcoal">{result.fundName}</div>
          <div className="text-sm text-gray-500">Klass {result.shareClassName}</div>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
          isPositive ? 'bg-emerald-50 text-emerald-700' :
          isNegative ? 'bg-red-50 text-red-700' :
          'bg-gray-50 text-gray-700'
        }`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> :
           isNegative ? <ArrowDownRight className="w-4 h-4" /> :
           <Minus className="w-4 h-4" />}
          {isPositive ? '+' : ''}{result.changePercent.toFixed(2)}%
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Nuvarande NAV</div>
          <div className="text-lg font-semibold text-gray-900">{result.currentNav.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Simulerad NAV</div>
          <div className={`text-lg font-semibold ${
            isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-900'
          }`}>
            {result.simulatedNav.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Impact Breakdown */}
      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500 mb-2">Påverkan</div>
        <div className="flex gap-2">
          {result.impactBreakdown.fxImpact !== 0 && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              result.impactBreakdown.fxImpact > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              FX: {result.impactBreakdown.fxImpact > 0 ? '+' : ''}{result.impactBreakdown.fxImpact.toFixed(1)}%
            </span>
          )}
          {result.impactBreakdown.priceImpact !== 0 && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              result.impactBreakdown.priceImpact > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              Pris: {result.impactBreakdown.priceImpact > 0 ? '+' : ''}{result.impactBreakdown.priceImpact.toFixed(1)}%
            </span>
          )}
          {result.impactBreakdown.flowImpact !== 0 && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              result.impactBreakdown.flowImpact > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              Flöde: {result.impactBreakdown.flowImpact > 0 ? '+' : ''}{result.impactBreakdown.flowImpact.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function SimulatorPage() {
  // FX Changes
  const [usdSekChange, setUsdSekChange] = useState(0);
  const [eurSekChange, setEurSekChange] = useState(0);
  const [nokSekChange, setNokSekChange] = useState(0);

  // Price Changes
  const [goldChange, setGoldChange] = useState(0);
  const [silverChange, setSilverChange] = useState(0);
  const [equityChange, setEquityChange] = useState(0);

  // Flows
  const [subscriptions, setSubscriptions] = useState(0);
  const [redemptions, setRedemptions] = useState(0);

  // Results
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Run simulation
  const runSimulation = async () => {
    setIsCalculating(true);
    
    // Simulate calculation delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Calculate simulated results
    const simulatedResults: SimulationResult[] = mockCurrentNAV.map(nav => {
      // Simple simulation logic
      const fxImpact = (usdSekChange * 0.6 + eurSekChange * 0.3 + nokSekChange * 0.1) / 100;
      const priceImpact = (goldChange * 0.4 + silverChange * 0.4 + equityChange * 0.2) / 100;
      const flowImpact = ((subscriptions - redemptions) / nav.aum) * 0.01;

      const totalImpact = fxImpact + priceImpact + flowImpact;
      const simulatedNav = nav.currentNav * (1 + totalImpact);

      return {
        fundId: nav.fundId,
        fundName: nav.fundName,
        shareClassId: nav.shareClassId,
        shareClassName: nav.shareClassName,
        currentNav: nav.currentNav,
        simulatedNav,
        change: simulatedNav - nav.currentNav,
        changePercent: totalImpact * 100,
        impactBreakdown: {
          fxImpact: fxImpact * 100,
          priceImpact: priceImpact * 100,
          flowImpact: flowImpact * 100,
        },
      };
    });

    setResults(simulatedResults);
    setIsCalculating(false);
  };

  // Apply preset scenario
  const applyScenario = (scenario: SimulationScenario) => {
    setUsdSekChange(scenario.fxChanges['USD/SEK'] || 0);
    setEurSekChange(scenario.fxChanges['EUR/SEK'] || 0);
    setNokSekChange(scenario.fxChanges['NOK/SEK'] || 0);
    setGoldChange(scenario.priceChanges['XAU'] || scenario.priceChanges['ALL'] || 0);
    setSilverChange(scenario.priceChanges['XAG'] || scenario.priceChanges['ALL'] || 0);
    setEquityChange(scenario.priceChanges['ALL'] || 0);
    setSubscriptions(scenario.subscriptions);
    setRedemptions(scenario.redemptions);
  };

  // Reset all
  const resetAll = () => {
    setUsdSekChange(0);
    setEurSekChange(0);
    setNokSekChange(0);
    setGoldChange(0);
    setSilverChange(0);
    setEquityChange(0);
    setSubscriptions(0);
    setRedemptions(0);
    setResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">NAV-simulator</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Simulera hur marknadsförändringar påverkar NAV
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">Återställ</span>
          </button>
          <button
            onClick={runSimulation}
            disabled={isCalculating}
            className="flex items-center gap-2 px-6 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
          >
            {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="font-medium">Kör simulering</span>
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-blue-800">What-if analys</div>
          <div className="text-sm text-blue-700 mt-1">
            Använd denna simulator för att se hur potentiella marknadsförändringar kan påverka fondernas NAV. 
            Välj ett fördefinierat scenario eller justera parametrarna manuellt.
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Preset Scenarios */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="font-semibold text-aifm-charcoal mb-3">Scenarion</h3>
            <div className="space-y-2">
              {presetScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => applyScenario(scenario)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-aifm-gold/5 hover:border-aifm-gold/30 border border-transparent rounded-lg transition-colors text-left"
                >
                  <div>
                    <div className="font-medium text-sm text-aifm-charcoal">{scenario.name}</div>
                    <div className="text-xs text-gray-500">{scenario.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* FX Changes */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-aifm-gold" />
              <h3 className="font-semibold text-aifm-charcoal">Valutakurser</h3>
            </div>
            <div className="space-y-4">
              <SliderInput
                label="USD/SEK"
                value={usdSekChange}
                onChange={setUsdSekChange}
                helpText="Positiv = SEK försvagas"
              />
              <SliderInput
                label="EUR/SEK"
                value={eurSekChange}
                onChange={setEurSekChange}
              />
              <SliderInput
                label="NOK/SEK"
                value={nokSekChange}
                onChange={setNokSekChange}
              />
            </div>
          </div>

          {/* Price Changes */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-aifm-gold" />
              <h3 className="font-semibold text-aifm-charcoal">Tillgångspriser</h3>
            </div>
            <div className="space-y-4">
              <SliderInput
                label="Guld (XAU)"
                value={goldChange}
                onChange={setGoldChange}
              />
              <SliderInput
                label="Silver (XAG)"
                value={silverChange}
                onChange={setSilverChange}
              />
              <SliderInput
                label="Aktier"
                value={equityChange}
                onChange={setEquityChange}
              />
            </div>
          </div>

          {/* Flows */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="w-5 h-5 text-aifm-gold" />
              <h3 className="font-semibold text-aifm-charcoal">Kapitalflöden</h3>
            </div>
            <div className="space-y-4">
              <SliderInput
                label="Teckningar"
                value={subscriptions / 1000000}
                onChange={(v) => setSubscriptions(v * 1000000)}
                min={0}
                max={500}
                unit="Mkr"
              />
              <SliderInput
                label="Inlösen"
                value={redemptions / 1000000}
                onChange={(v) => setRedemptions(v * 1000000)}
                min={0}
                max={500}
                unit="Mkr"
              />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {results.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Kör en simulering</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Justera parametrarna till vänster och klicka på "Kör simulering" för att se hur NAV påverkas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gradient-to-br from-aifm-charcoal to-gray-800 rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Simuleringsresultat</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-white/60 text-sm mb-1">Genomsnittlig påverkan</div>
                    <div className="text-2xl font-bold">
                      {results.length > 0 
                        ? `${(results.reduce((s, r) => s + r.changePercent, 0) / results.length) > 0 ? '+' : ''}${(results.reduce((s, r) => s + r.changePercent, 0) / results.length).toFixed(2)}%`
                        : '0%'}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-1">Bästa</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      +{Math.max(...results.map(r => r.changePercent)).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-1">Sämsta</div>
                    <div className="text-2xl font-bold text-red-400">
                      {Math.min(...results.map(r => r.changePercent)).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Result Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {results.map((result) => (
                  <ResultCard key={`${result.fundId}-${result.shareClassId}`} result={result} />
                ))}
              </div>

              {/* Warning if large change */}
              {results.some(r => Math.abs(r.changePercent) > 5) && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-800">Stor förändring</div>
                    <div className="text-sm text-amber-700 mt-1">
                      En eller flera fonder visar en NAV-förändring över 5%. 
                      I verkligheten skulle detta trigga ytterligare validering och manuell granskning.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
