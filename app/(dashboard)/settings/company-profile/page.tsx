'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Building2,
  FileText,
  Palette,
  Mail,
  BookOpen,
  Shield,
  Target,
  Scale,
  Users,
  MessageSquare,
  Loader2,
  Save,
  Upload,
  Trash2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

type CompanyProfileState = {
  companyId: string;
  companyName: string;
  legalName: string;
  orgNumber: string;
  brandVoice: string;
  brandColors: string;
  documentStyle: string;
  letterTemplate: string;
  reportTemplate: string;
  exclusionPolicy: string;
  investmentPhilosophy: string;
  regulatoryContext: string;
  keyClients: string;
  customInstructions: string;
  autoLearnedFacts: string[];
};

const defaultState: CompanyProfileState = {
  companyId: 'default',
  companyName: '',
  legalName: '',
  orgNumber: '',
  brandVoice: '',
  brandColors: '',
  documentStyle: '',
  letterTemplate: '',
  reportTemplate: '',
  exclusionPolicy: '',
  investmentPhilosophy: '',
  regulatoryContext: '',
  keyClients: '',
  customInstructions: '',
  autoLearnedFacts: [],
};

export default function CompanyProfilePage() {
  const [form, setForm] = useState<CompanyProfileState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandbookUploading, setBrandbookUploading] = useState(false);
  const [brandbookExtract, setBrandbookExtract] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/company-profile');
        if (!res.ok) throw new Error('Kunde inte ladda profilen');
        const data = await res.json();
        if (cancelled) return;
        if (data.notFound) {
          setForm({ ...defaultState, companyId: data.companyId ?? 'default' });
        } else {
          setForm({
            companyId: data.companyId ?? 'default',
            companyName: data.companyName ?? '',
            legalName: data.legalName ?? '',
            orgNumber: data.orgNumber ?? '',
            brandVoice: data.brandVoice ?? '',
            brandColors: data.brandColors ?? '',
            documentStyle: data.documentStyle ?? '',
            letterTemplate: data.letterTemplate ?? '',
            reportTemplate: data.reportTemplate ?? '',
            exclusionPolicy: data.exclusionPolicy ?? '',
            investmentPhilosophy: data.investmentPhilosophy ?? '',
            regulatoryContext: data.regulatoryContext ?? '',
            keyClients: data.keyClients ?? '',
            customInstructions: data.customInstructions ?? '',
            autoLearnedFacts: Array.isArray(data.autoLearnedFacts) ? data.autoLearnedFacts : [],
          });
        }
      } catch {
        if (!cancelled) setForm(defaultState);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (updates: Partial<CompanyProfileState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: form.companyId,
          companyName: form.companyName,
          legalName: form.legalName,
          orgNumber: form.orgNumber,
          brandVoice: form.brandVoice,
          brandColors: form.brandColors,
          documentStyle: form.documentStyle,
          letterTemplate: form.letterTemplate,
          reportTemplate: form.reportTemplate,
          exclusionPolicy: form.exclusionPolicy,
          investmentPhilosophy: form.investmentPhilosophy,
          regulatoryContext: form.regulatoryContext,
          keyClients: form.keyClients,
          customInstructions: form.customInstructions,
          autoLearnedFacts: form.autoLearnedFacts,
        }),
      });
      if (!res.ok) throw new Error('Kunde inte spara');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kunde inte spara');
    } finally {
      setSaving(false);
    }
  };

  const handleBrandbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandbookUploading(true);
    setBrandbookExtract(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ai/parse-file', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Kunde inte läsa filen');
      const data = await res.json();
      const text = typeof data.text === 'string' ? data.text : data.content ?? '';
      setBrandbookExtract(text.slice(0, 30000));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kunde inte läsa filen');
    } finally {
      setBrandbookUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyBrandbookToDocumentStyle = () => {
    if (brandbookExtract) update({ documentStyle: brandbookExtract.slice(0, 8000) });
  };

  const addAutoFact = () => {
    update({ autoLearnedFacts: [...form.autoLearnedFacts, ''] });
  };

  const setAutoFact = (index: number, value: string) => {
    const next = [...form.autoLearnedFacts];
    next[index] = value;
    update({ autoLearnedFacts: next });
  };

  const removeAutoFact = (index: number) => {
    update({ autoLearnedFacts: form.autoLearnedFacts.filter((_, i) => i !== index) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-aifm-charcoal flex items-center gap-2">
          <Building2 className="w-7 h-7" />
          Företagsprofil
        </h1>
        <p className="text-sm text-aifm-charcoal/60 mt-1">
          Styr hur AIFM Agenten pratar och skriver så att det matchar ert företag, era mallar och er brandbook.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Företagsuppgifter
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
              Företagsnamn
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update({ companyName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
              placeholder="t.ex. AIFM Group AB"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
              Juridiskt namn
            </label>
            <input
              type="text"
              value={form.legalName}
              onChange={(e) => update({ legalName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
              placeholder="Samma eller annat juridiskt namn"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
              Org.nummer
            </label>
            <input
              type="text"
              value={form.orgNumber}
              onChange={(e) => update({ orgNumber: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
              placeholder="XXXXXX-XXXX"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Varumärke och ton
        </h2>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Brand voice (ton och stil)
          </label>
          <textarea
            value={form.brandVoice}
            onChange={(e) => update({ brandVoice: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="t.ex. Formell men varm, professionell, svenska företag"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Färger (hex)
          </label>
          <input
            type="text"
            value={form.brandColors}
            onChange={(e) => update({ brandColors: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="t.ex. #1a1a1a, #c9a227"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Dokumentstil
        </h2>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Rubriker, typsnitt, sidhuvud/sidfot
          </label>
          <textarea
            value={form.documentStyle}
            onChange={(e) => update({ documentStyle: e.target.value })}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="Beskriv hur era rapporter och dokument ska se ut..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Brevmallar (hälsning, avslutning, signatur)
          </label>
          <textarea
            value={form.letterTemplate}
            onChange={(e) => update({ letterTemplate: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="t.ex. Vi hälsar med 'Hej', avslutar med 'Med vänliga hälsningar'..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Rapportmallar
          </label>
          <textarea
            value={form.reportTemplate}
            onChange={(e) => update({ reportTemplate: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="Struktur och stil för rapporter..."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Brandbook (PDF/Word)
        </h2>
        <p className="text-sm text-aifm-charcoal/60">
          Ladda upp er brandbook så att vi kan använda innehållet för dokumentstil och mallar.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          onChange={handleBrandbookUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={brandbookUploading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-aifm-charcoal disabled:opacity-50"
        >
          {brandbookUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {brandbookUploading ? 'Laddar upp...' : 'Välj brandbook'}
        </button>
        {brandbookExtract && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
            <p className="text-xs font-medium text-aifm-charcoal/60 mb-2">Utdrag från dokumentet:</p>
            <pre className="text-xs text-aifm-charcoal whitespace-pre-wrap font-sans">
              {brandbookExtract.slice(0, 2000)}
              {brandbookExtract.length > 2000 ? '…' : ''}
            </pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyBrandbookToDocumentStyle}
                className="text-sm text-aifm-gold hover:underline"
              >
                Använd till dokumentstil
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/company-profile/parse-brandbook', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: brandbookExtract, applyToProfile: true }),
                    });
                    if (!res.ok) throw new Error('Kunde inte parsa');
                    const data = await res.json();
                    if (data.parsed) {
                      update({ ...data.parsed });
                      setBrandbookExtract(null);
                    }
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Kunde inte parsa brandbook');
                  }
                }}
                className="text-sm font-medium text-aifm-charcoal hover:underline"
              >
                Fyll i hela profilen från brandbook
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Policy och regelverk
        </h2>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Exkluderingspolicy
          </label>
          <textarea
            value={form.exclusionPolicy}
            onChange={(e) => update({ exclusionPolicy: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="Kort sammanfattning av exkluderingskriterier..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Investeringsfilosofi
          </label>
          <textarea
            value={form.investmentPhilosophy}
            onChange={(e) => update({ investmentPhilosophy: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="Kort beskrivning..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Regulatorisk kontext (AIFMD, SFDR, etc.)
          </label>
          <textarea
            value={form.regulatoryContext}
            onChange={(e) => update({ regulatoryContext: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="Vi lyder under..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-1">
            Typ av klienter (anonymiserat)
          </label>
          <input
            type="text"
            value={form.keyClients}
            onChange={(e) => update({ keyClients: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
            placeholder="t.ex. institutionella investerare, familjeföretag"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Övriga instruktioner
        </h2>
        <textarea
          value={form.customInstructions}
          onChange={(e) => update({ customInstructions: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
          placeholder="t.ex. Vi hälsar alltid med... Använd aldrig..."
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-aifm-charcoal flex items-center gap-2">
          <Target className="w-5 h-5" />
          Automatiskt inlärd kunskap
        </h2>
        <p className="text-sm text-aifm-charcoal/60">
          Fakta som AI har extraherat från chattar. Du kan redigera eller ta bort.
        </p>
        {form.autoLearnedFacts.map((fact, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="text"
              value={fact}
              onChange={(e) => setAutoFact(i, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
              placeholder="En inlärd fakta"
            />
            <button
              type="button"
              onClick={() => removeAutoFact(i)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              aria-label="Ta bort"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAutoFact}
          className="text-sm text-aifm-gold hover:underline"
        >
          + Lägg till rad
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-aifm-charcoal text-white rounded-lg font-medium hover:bg-aifm-charcoal/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Spara
        </button>
        <a
          href="/aifm-agent"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-aifm-charcoal hover:bg-gray-50"
        >
          <ExternalLink className="w-4 h-4" />
          Testa i AIFM Agent (t.ex. &quot;Skriv ett kort provbrev enligt vår stil&quot;)
        </a>
        <a
          href="/settings/knowledge-review"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-aifm-charcoal hover:bg-gray-50"
        >
          <BookOpen className="w-4 h-4" />
          Granska inlärd kunskap
        </a>
      </div>
    </div>
  );
}
