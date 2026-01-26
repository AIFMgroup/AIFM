'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { DealKanban } from '@/components/crm/DealKanban';
import { Plus, X, Save, Building2, User, Calendar, DollarSign, Tag, Globe } from 'lucide-react';
import type { Deal, DealStage, CrmCompany, Contact } from '@/lib/crm/types';
import { DEFAULT_PIPELINE_STAGES } from '@/lib/crm/types';

function PipelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formStage, setFormStage] = useState<DealStage>('lead');

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setSelectedDeal(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const [dealsRes, companiesRes, contactsRes] = await Promise.all([
          fetch('/api/crm/deals'),
          fetch('/api/crm/companies'),
          fetch('/api/crm/contacts'),
        ]);

        if (dealsRes.ok) setDeals(await dealsRes.json());
        if (companiesRes.ok) setCompanies(await companiesRes.json());
        if (contactsRes.ok) setContacts(await contactsRes.json());
      } catch (error) {
        console.error('Failed to load pipeline:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d));

    try {
      const res = await fetch('/api/crm/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      });

      if (!res.ok) {
        // Revert on error
        const revertRes = await fetch('/api/crm/deals');
        if (revertRes.ok) setDeals(await revertRes.json());
      }
    } catch (error) {
      console.error('Failed to update deal stage:', error);
    }
  };

  const handleCreateDeal = (stage: DealStage) => {
    setFormStage(stage);
    setSelectedDeal(null);
    setShowForm(true);
  };

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowForm(true);
  };

  const handleSave = async (data: Partial<Deal>) => {
    try {
      if (selectedDeal) {
        const res = await fetch('/api/crm/deals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: selectedDeal.id }),
        });
        if (res.ok) {
          const updated = await res.json();
          setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
        }
      } else {
        const res = await fetch('/api/crm/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, stage: formStage }),
        });
        if (res.ok) {
          const created = await res.json();
          setDeals(prev => [created, ...prev]);
        }
      }
      setShowForm(false);
      setSelectedDeal(null);
      router.replace('/crm/pipeline');
    } catch (error) {
      console.error('Failed to save deal:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedDeal) return;

    try {
      const res = await fetch(`/api/crm/deals?id=${selectedDeal.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeals(prev => prev.filter(d => d.id !== selectedDeal.id));
        setShowForm(false);
        setSelectedDeal(null);
      }
    } catch (error) {
      console.error('Failed to delete deal:', error);
    }
  };

  const pipelineValue = deals.filter(d => d.status === 'open').reduce((sum, d) => sum + (d.value || 0), 0);
  const wonValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <CrmLayout>
      <div className="py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pipeline</h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-1 text-sm">
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{pipelineValue.toLocaleString('sv-SE')}</span> SEK
              </span>
              <span className="text-gray-500">
                <span className="font-semibold text-emerald-600">{wonValue.toLocaleString('sv-SE')}</span> SEK vunna
              </span>
            </div>
          </div>
          <button
            onClick={() => handleCreateDeal('lead')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2d2a26] text-white text-sm font-medium rounded-lg hover:bg-[#3d3a36] transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Ny affär
          </button>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DealKanban
            deals={deals}
            onStageChange={handleStageChange}
            onDealClick={handleDealClick}
            onCreateDeal={handleCreateDeal}
          />
        )}

        {/* Deal Form Sidebar */}
        {showForm && (
          <>
            {/* Mobile backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => { setShowForm(false); setSelectedDeal(null); router.replace('/crm/pipeline'); }} />
          <div className="fixed inset-x-0 bottom-0 top-16 md:inset-y-0 md:left-auto md:right-0 w-full md:max-w-lg bg-white shadow-2xl z-50 overflow-y-auto rounded-t-2xl md:rounded-none">
            <DealForm
              deal={selectedDeal}
              stage={formStage}
              companies={companies}
              contacts={contacts}
              onSave={handleSave}
              onDelete={selectedDeal ? handleDelete : undefined}
              onCancel={() => {
                setShowForm(false);
                setSelectedDeal(null);
                router.replace('/crm/pipeline');
              }}
            />
          </div>
          </>
        )}
      </div>
    </CrmLayout>
  );
}

// Deal Form Component
interface DealFormProps {
  deal?: Deal | null;
  stage: DealStage;
  companies: CrmCompany[];
  contacts: Contact[];
  onSave: (data: Partial<Deal>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

function DealForm({ deal, stage, companies, contacts, onSave, onDelete, onCancel }: DealFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: deal?.name || '',
    description: deal?.description || '',
    crmCompanyId: deal?.crmCompanyId || '',
    primaryContactId: deal?.primaryContactId || '',
    value: deal?.value?.toString() || '',
    currency: deal?.currency || 'SEK',
    expectedCloseDate: deal?.expectedCloseDate || '',
    priority: deal?.priority || 'medium',
    tags: deal?.tags?.join(', ') || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const company = companies.find(c => c.id === formData.crmCompanyId);
      const contact = contacts.find(c => c.id === formData.primaryContactId);
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      await onSave({
        name: formData.name,
        description: formData.description || undefined,
        crmCompanyId: formData.crmCompanyId || undefined,
        crmCompanyName: company?.name,
        primaryContactId: formData.primaryContactId || undefined,
        primaryContactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
        value: formData.value ? parseFloat(formData.value) : undefined,
        currency: formData.currency,
        expectedCloseDate: formData.expectedCloseDate || undefined,
        priority: formData.priority as Deal['priority'],
        tags: tags.length > 0 ? tags : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentStage = DEFAULT_PIPELINE_STAGES.find(s => s.id === (deal?.stage || stage));

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {deal ? 'Redigera affär' : 'Ny affär'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentStage?.color }}
            />
            <span className="text-sm text-gray-500">{currentStage?.name}</span>
          </div>
        </div>
        <button 
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Affärsnamn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            placeholder="T.ex. Implementation hos Företag AB"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Företag
            </label>
            <select
              value={formData.crmCompanyId}
              onChange={(e) => setFormData({ ...formData, crmCompanyId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            >
              <option value="">Välj företag...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Kontakt
            </label>
            <select
              value={formData.primaryContactId}
              onChange={(e) => setFormData({ ...formData, primaryContactId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            >
              <option value="">Välj kontakt...</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Värde
            </label>
            <div className="flex">
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
                placeholder="0"
              />
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent bg-gray-50"
              >
                <option value="SEK">SEK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Förväntat avslut
            </label>
            <input
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioritet</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFormData({ ...formData, priority: p })}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                  formData.priority === p
                    ? p === 'high' ? 'bg-red-50 border-red-300 text-red-700' :
                      p === 'medium' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                      'bg-gray-100 border-gray-300 text-gray-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p === 'high' ? 'Hög' : p === 'medium' ? 'Medium' : 'Låg'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Tag className="w-4 h-4 inline mr-1" />
            Taggar
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            placeholder="Kommaseparerade taggar"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            Ta bort
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {deal ? 'Spara' : 'Skapa'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
        </div>
      </CrmLayout>
    }>
      <PipelineContent />
    </Suspense>
  );
}

