'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  Plus, Globe, Phone, Mail, Building2, 
  Edit2, Trash2, X, Save, Users, DollarSign, 
  ChevronRight, Loader2, MapPin, Briefcase, Hash
} from 'lucide-react';
import type { CrmCompany } from '@/lib/crm/types';
import { 
  Select, SearchInput, Button, IconButton, StatusPill, 
  Card, EmptyState, Modal, ModalActions, Input, Textarea
} from '@/components/crm/ui';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alla status' },
  { value: 'lead', label: 'Leads', color: '#9ca3af' },
  { value: 'prospect', label: 'Prospekt', color: '#3b82f6' },
  { value: 'customer', label: 'Kunder', color: '#22c55e' },
  { value: 'partner', label: 'Partners', color: '#8b5cf6' },
  { value: 'inactive', label: 'Inaktiva', color: '#f59e0b' },
];

const COMPANY_STATUS_OPTIONS = STATUS_OPTIONS.filter(o => o.value !== 'all');

function CompaniesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCrmCompany, setSelectedCrmCompany] = useState<CrmCompany | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CrmCompany | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setSelectedCrmCompany(null);
    }
    const editId = searchParams.get('edit');
    if (editId) {
      const company = companies.find(c => c.id === editId);
      if (company) {
        setSelectedCrmCompany(company);
        setShowForm(true);
      }
    }
  }, [searchParams, companies]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const res = await fetch('/api/crm/companies');
        if (res.ok) setCompanies(await res.json());
      } catch (error) {
        console.error('Failed to load companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      !searchQuery ||
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.orgNumber?.includes(searchQuery) ||
      company.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSave = async (data: Partial<CrmCompany>) => {
    try {
      if (selectedCrmCompany) {
        const res = await fetch('/api/crm/companies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: selectedCrmCompany.id }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
      } else {
        const res = await fetch('/api/crm/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          setCompanies(prev => [created, ...prev]);
        }
      }
      setShowForm(false);
      setSelectedCrmCompany(null);
      router.replace('/crm/companies');
    } catch (error) {
      console.error('Failed to save company:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      const res = await fetch(`/api/crm/companies?id=${showDeleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== showDeleteConfirm.id));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#2d2a26] tracking-tight">Företag</h1>
            <p className="text-sm text-aifm-charcoal/40 mt-1">
              {loading ? '...' : `${companies.length} företag totalt`}
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedCrmCompany(null);
              setShowForm(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Nytt företag
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Sök företag..."
            className="flex-1"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className="w-full sm:w-48"
          />
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company List */}
          <div className={showForm ? 'lg:col-span-2' : 'lg:col-span-3'}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={<Building2 className="w-8 h-8" />}
                  title={searchQuery ? 'Inga träffar' : 'Inga företag ännu'}
                  description={searchQuery 
                    ? 'Inga företag matchar din sökning' 
                    : 'Börja med att lägga till ditt första företag'
                  }
                  action={!searchQuery ? {
                    label: 'Lägg till företag',
                    onClick: () => setShowForm(true),
                    icon: <Plus className="w-4 h-4" />,
                  } : undefined}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredCompanies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/crm/companies/${company.id}`}
                  >
                    <Card
                      interactive
                      className="h-full p-5 group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#c0a280]/20 to-[#2d2a26]/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[#c0a280]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-aifm-charcoal truncate group-hover:text-aifm-gold transition-colors">
                              {company.name}
                            </h3>
                            {company.industry && (
                              <p className="text-sm text-aifm-charcoal/40 truncate">{company.industry}</p>
                            )}
                          </div>
                        </div>
                        <StatusPill status={company.status} size="sm" />
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        {company.website && (
                          <div className="flex items-center gap-2 text-aifm-charcoal/50">
                            <Globe className="w-4 h-4 text-aifm-charcoal/30 flex-shrink-0" />
                            <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                          </div>
                        )}
                        {company.email && (
                          <div className="flex items-center gap-2 text-aifm-charcoal/50">
                            <Mail className="w-4 h-4 text-aifm-charcoal/30 flex-shrink-0" />
                            <span className="truncate">{company.email}</span>
                          </div>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-2 text-aifm-charcoal/50">
                            <Phone className="w-4 h-4 text-aifm-charcoal/30 flex-shrink-0" />
                            {company.phone}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-4">
                          {company.employeeCount && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-aifm-charcoal/40">
                              <Users className="w-3.5 h-3.5" />
                              {company.employeeCount}
                            </span>
                          )}
                          {company.annualRevenue && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-aifm-charcoal/40">
                              <DollarSign className="w-3.5 h-3.5" />
                              {(company.annualRevenue / 1000000).toFixed(1)}M
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedCrmCompany(company);
                              setShowForm(true);
                            }}
                            tooltip="Redigera"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowDeleteConfirm(company);
                            }}
                            tooltip="Ta bort"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                          <ChevronRight className="w-5 h-5 text-gray-300 ml-1 group-hover:text-aifm-gold transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Form Sidebar */}
          {showForm && (
            <div className="fixed inset-0 z-50 lg:static lg:z-auto">
              <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm lg:hidden" 
                onClick={() => { 
                  setShowForm(false); 
                  setSelectedCrmCompany(null); 
                  router.replace('/crm/companies'); 
                }} 
              />
              <div className="absolute inset-x-0 bottom-0 top-20 lg:static bg-white rounded-t-3xl lg:rounded-2xl border border-gray-100 overflow-hidden lg:sticky lg:top-4 shadow-xl lg:shadow-none">
                <div className="h-full overflow-y-auto p-6">
                  <CompanyForm
                    company={selectedCrmCompany}
                    onSave={handleSave}
                    onCancel={() => {
                      setShowForm(false);
                      setSelectedCrmCompany(null);
                      router.replace('/crm/companies');
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Modal */}
        <Modal
          open={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Ta bort företag?"
          description={`Är du säker på att du vill ta bort ${showDeleteConfirm?.name}? Åtgärden kan inte ångras.`}
          size="sm"
        >
          <ModalActions>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
              Avbryt
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Ta bort
            </Button>
          </ModalActions>
        </Modal>
      </div>
    </CrmLayout>
  );
}

// Company Form Component
function CompanyForm({ 
  company, 
  onSave, 
  onCancel 
}: { 
  company?: CrmCompany | null;
  onSave: (data: Partial<CrmCompany>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: company?.name || '',
    orgNumber: company?.orgNumber || '',
    website: company?.website || '',
    industry: company?.industry || '',
    email: company?.email || '',
    phone: company?.phone || '',
    employeeCount: company?.employeeCount?.toString() || '',
    annualRevenue: company?.annualRevenue?.toString() || '',
    description: company?.description || '',
    status: company?.status || 'lead',
    tags: company?.tags?.join(', ') || '',
    street: company?.address?.street || '',
    city: company?.address?.city || '',
    postalCode: company?.address?.postalCode || '',
    country: company?.address?.country || 'Sverige',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      await onSave({
        name: formData.name,
        orgNumber: formData.orgNumber || undefined,
        website: formData.website || undefined,
        industry: formData.industry || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
        annualRevenue: formData.annualRevenue ? parseFloat(formData.annualRevenue) : undefined,
        description: formData.description || undefined,
        status: formData.status as CrmCompany['status'],
        tags: tags.length > 0 ? tags : undefined,
        address: (formData.street || formData.city || formData.postalCode) ? {
          street: formData.street || undefined,
          city: formData.city || undefined,
          postalCode: formData.postalCode || undefined,
          country: formData.country || undefined,
        } : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c0a280]/20 to-[#2d2a26]/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#c0a280]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#2d2a26]">
              {company ? 'Redigera företag' : 'Nytt företag'}
            </h2>
            <p className="text-sm text-aifm-charcoal/40">
              {company ? company.name : 'Lägg till ett nytt företag'}
            </p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-aifm-charcoal/30 hover:text-aifm-charcoal hover:bg-aifm-charcoal/5 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-aifm-charcoal">
          <Building2 className="w-4 h-4 text-aifm-gold" />
          Företagsinformation
        </div>
        <Input
          label="Företagsnamn"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="AB Exempel"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Org.nummer"
            value={formData.orgNumber}
            onChange={(e) => setFormData({ ...formData, orgNumber: e.target.value })}
            placeholder="XXXXXX-XXXX"
            icon={<Hash className="w-4 h-4" />}
          />
          <Input
            label="Bransch"
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            placeholder="Tech, Finans..."
          />
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-aifm-charcoal">
          <Mail className="w-4 h-4 text-aifm-gold" />
          Kontaktuppgifter
        </div>
        <Input
          label="Webbplats"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          placeholder="https://foretag.se"
          icon={<Globe className="w-4 h-4" />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="E-post"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="info@foretag.se"
            icon={<Mail className="w-4 h-4" />}
          />
          <Input
            label="Telefon"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="08-xxx xx xx"
            icon={<Phone className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Business Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-aifm-charcoal">
          <Briefcase className="w-4 h-4 text-aifm-gold" />
          Affärsinformation
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Anställda"
            type="number"
            value={formData.employeeCount}
            onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
            placeholder="50"
            icon={<Users className="w-4 h-4" />}
          />
          <Input
            label="Årsomsättning"
            type="number"
            value={formData.annualRevenue}
            onChange={(e) => setFormData({ ...formData, annualRevenue: e.target.value })}
            placeholder="10000000"
            helper="SEK"
            icon={<DollarSign className="w-4 h-4" />}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <Select
            value={formData.status}
            onChange={(val) => setFormData({ ...formData, status: val as CrmCompany['status'] })}
            options={COMPANY_STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-aifm-charcoal">
          <MapPin className="w-4 h-4 text-aifm-gold" />
          Adress
        </div>
        <Input
          label="Gatuadress"
          value={formData.street}
          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
          placeholder="Kungsgatan 1"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Postnummer"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            placeholder="111 43"
          />
          <Input
            label="Ort"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Stockholm"
          />
        </div>
      </div>

      {/* Description */}
      <Textarea
        label="Beskrivning"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        rows={3}
        placeholder="Kort beskrivning av företaget..."
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          type="submit"
          disabled={!formData.name}
          loading={loading}
          icon={<Save className="w-4 h-4" />}
        >
          {company ? 'Spara ändringar' : 'Skapa företag'}
        </Button>
      </div>
    </form>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
        </div>
      </CrmLayout>
    }>
      <CompaniesContent />
    </Suspense>
  );
}
