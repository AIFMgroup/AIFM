'use client';

import { useState } from 'react';
import { X, Save, User, Mail, Phone, Building2, MapPin, Tag, Briefcase, Linkedin, Link2, Check } from 'lucide-react';
import type { Contact, CrmCompany } from '@/lib/crm/types';
import { Input, Textarea, Select, Button, Avatar } from './ui';
import { mockCompanies, Company } from '@/lib/companyData';

interface ContactFormProps {
  contact?: Contact | null;
  companies?: CrmCompany[];
  onSave: (data: Partial<Contact>) => Promise<void>;
  onCancel: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktiv', color: '#22c55e' },
  { value: 'inactive', label: 'Inaktiv', color: '#9ca3af' },
  { value: 'archived', label: 'Arkiverad', color: '#f59e0b' },
];

export function ContactForm({ contact, companies = [], onSave, onCancel }: ContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    title: contact?.title || '',
    department: contact?.department || '',
    linkedIn: contact?.linkedIn || '',
    crmCompanyId: contact?.crmCompanyId || '',
    status: contact?.status || 'active',
    notes: contact?.notes || '',
    tags: contact?.tags?.join(', ') || '',
    street: contact?.address?.street || '',
    city: contact?.address?.city || '',
    postalCode: contact?.address?.postalCode || '',
    country: contact?.address?.country || '',
    linkedManagedCompanyIds: contact?.linkedManagedCompanyIds || [] as string[],
  });

  const companyOptions = [
    { value: '', label: 'Välj företag...' },
    ...companies.map(c => ({ value: c.id, label: c.name })),
  ];

  const toggleManagedCompany = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedManagedCompanyIds: prev.linkedManagedCompanyIds.includes(companyId)
        ? prev.linkedManagedCompanyIds.filter(id => id !== companyId)
        : [...prev.linkedManagedCompanyIds, companyId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const tags = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      // Get names for linked companies
      const linkedNames = formData.linkedManagedCompanyIds
        .map(id => mockCompanies.find(c => c.id === id)?.name)
        .filter((name): name is string => !!name);

      await onSave({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        mobile: formData.mobile || undefined,
        title: formData.title || undefined,
        department: formData.department || undefined,
        linkedIn: formData.linkedIn || undefined,
        crmCompanyId: formData.crmCompanyId || undefined,
        status: formData.status as Contact['status'],
        notes: formData.notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        linkedManagedCompanyIds: formData.linkedManagedCompanyIds.length > 0 ? formData.linkedManagedCompanyIds : undefined,
        linkedManagedCompanyNames: linkedNames.length > 0 ? linkedNames : undefined,
        address: (formData.street || formData.city || formData.postalCode || formData.country) ? {
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

  const fullName = `${formData.firstName || 'Ny'} ${formData.lastName || 'Kontakt'}`.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-[#2d2a26]">
              {contact ? 'Redigera kontakt' : 'Ny kontakt'}
            </h2>
            <p className="text-sm text-gray-500">
              {contact ? fullName : 'Lägg till en ny kontaktperson'}
            </p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <User className="w-4 h-4 text-[#c0a280]" />
          Grunduppgifter
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Förnamn"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
            placeholder="Anna"
          />
          <Input
            label="Efternamn"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
            placeholder="Andersson"
          />
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Mail className="w-4 h-4 text-[#c0a280]" />
          Kontaktuppgifter
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="E-post"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="anna@foretag.se"
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
          <Input
            label="Mobil"
            type="tel"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            placeholder="07x-xxx xx xx"
          />
          <Input
            label="LinkedIn"
            type="url"
            value={formData.linkedIn}
            onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
            placeholder="linkedin.com/in/..."
            icon={<Linkedin className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Company & Role */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Briefcase className="w-4 h-4 text-[#c0a280]" />
          Företag & Roll
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Företag</label>
            <Select
              value={formData.crmCompanyId}
              onChange={(val) => setFormData({ ...formData, crmCompanyId: val })}
              options={companyOptions}
              showSearch={companies.length > 5}
              placeholder="Välj företag..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Titel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="VD, CFO, etc."
            />
            <Input
              label="Avdelning"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="Ekonomi, IT, etc."
            />
          </div>
        </div>
      </div>

      {/* Linked Managed Companies */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Link2 className="w-4 h-4 text-[#c0a280]" />
          Kopplade bolag (investeringar/relationer)
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Välj vilka förvaltade bolag denna kontakt är kopplad till
        </p>
        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-3">
          {mockCompanies.map((company) => (
            <label
              key={company.id}
              className={`
                flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                ${formData.linkedManagedCompanyIds.includes(company.id)
                  ? 'bg-[#c0a280]/10 border border-[#c0a280]/30'
                  : 'hover:bg-gray-50 border border-transparent'
                }
              `}
            >
              <input
                type="checkbox"
                checked={formData.linkedManagedCompanyIds.includes(company.id)}
                onChange={() => toggleManagedCompany(company.id)}
                className="sr-only"
              />
              <div
                className={`
                  w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                  ${formData.linkedManagedCompanyIds.includes(company.id)
                    ? 'bg-[#c0a280] border-[#c0a280]'
                    : 'border-gray-300'
                  }
                `}
              >
                {formData.linkedManagedCompanyIds.includes(company.id) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{company.name}</p>
                <p className="text-xs text-gray-500">{company.type} · {company.orgNumber}</p>
              </div>
            </label>
          ))}
        </div>
        {formData.linkedManagedCompanyIds.length > 0 && (
          <p className="text-xs text-[#c0a280]">
            {formData.linkedManagedCompanyIds.length} bolag valda
          </p>
        )}
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MapPin className="w-4 h-4 text-[#c0a280]" />
          Adress
        </div>
        <div className="space-y-3">
          <Input
            label="Gatuadress"
            value={formData.street}
            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            placeholder="Storgatan 1"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Postnummer"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="111 22"
            />
            <Input
              label="Ort"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Stockholm"
            />
          </div>
        </div>
      </div>

      {/* Status & Tags */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Tag className="w-4 h-4 text-[#c0a280]" />
          Status & Taggar
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <Select
              value={formData.status}
              onChange={(val) => setFormData({ ...formData, status: val as Contact['status'] })}
              options={STATUS_OPTIONS}
            />
          </div>
          <Input
            label="Taggar"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="VIP, Partner"
            helper="Kommaseparerat"
          />
        </div>
      </div>

      {/* Notes */}
      <Textarea
        label="Anteckningar"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        rows={3}
        placeholder="Interna anteckningar om kontakten..."
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          type="submit"
          disabled={!formData.firstName || !formData.lastName}
          loading={loading}
          icon={<Save className="w-4 h-4" />}
        >
          {contact ? 'Spara ändringar' : 'Skapa kontakt'}
        </Button>
      </div>
    </form>
  );
}
