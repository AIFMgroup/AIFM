'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { ContactForm } from '@/components/crm/ContactForm';
import { 
  Plus, Mail, Phone, Building2, 
  User, Edit2, Trash2, X, ChevronRight, Loader2, Globe
} from 'lucide-react';
import type { Contact, CrmCompany } from '@/lib/crm/types';
import { 
  Select, SearchInput, Button, IconButton, StatusPill, 
  Avatar, Card, EmptyState, Modal, ModalActions 
} from '@/components/crm/ui';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alla status' },
  { value: 'active', label: 'Aktiva', color: '#22c55e' },
  { value: 'inactive', label: 'Inaktiva', color: '#9ca3af' },
  { value: 'archived', label: 'Arkiverade', color: '#f59e0b' },
];

function ContactsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Contact | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setSelectedContact(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const [contactsRes, companiesRes] = await Promise.all([
          fetch('/api/crm/contacts'),
          fetch('/api/crm/companies'),
        ]);

        if (contactsRes.ok) setContacts(await contactsRes.json());
        if (companiesRes.ok) setCompanies(await companiesRes.json());
      } catch (error) {
        console.error('Failed to load contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      !searchQuery ||
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSave = async (data: Partial<Contact>) => {
    try {
      if (selectedContact) {
        const res = await fetch('/api/crm/contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: selectedContact.id }),
        });
        if (res.ok) {
          const updated = await res.json();
          setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
      } else {
        const res = await fetch('/api/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          setContacts(prev => [created, ...prev]);
        }
      }
      setShowForm(false);
      setSelectedContact(null);
      router.replace('/crm/contacts');
    } catch (error) {
      console.error('Failed to save contact:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      const res = await fetch(`/api/crm/contacts?id=${showDeleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== showDeleteConfirm.id));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const getCompanyName = (crmCompanyId?: string) => {
    if (!crmCompanyId) return null;
    return companies.find(c => c.id === crmCompanyId)?.name;
  };

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#2d2a26] tracking-tight">Kontakter</h1>
            <p className="text-sm text-aifm-charcoal/40 mt-1">
              {loading ? '...' : `${contacts.length} kontakter totalt`}
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedContact(null);
              setShowForm(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Ny kontakt
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Sök kontakter..."
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
          {/* Contact List */}
          <div className={showForm ? 'lg:col-span-2' : 'lg:col-span-3'}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={<User className="w-8 h-8" />}
                  title={searchQuery ? 'Inga träffar' : 'Inga kontakter ännu'}
                  description={searchQuery 
                    ? 'Inga kontakter matchar din sökning' 
                    : 'Börja med att lägga till din första kontakt'
                  }
                  action={!searchQuery ? {
                    label: 'Lägg till kontakt',
                    onClick: () => setShowForm(true),
                    icon: <Plus className="w-4 h-4" />,
                  } : undefined}
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <Card
                    key={contact.id}
                    interactive
                    onClick={() => router.push(`/crm/contacts/${contact.id}`)}
                    className="p-4 group"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar 
                        name={`${contact.firstName} ${contact.lastName}`} 
                        size="lg"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-0.5">
                          <h3 className="font-medium text-aifm-charcoal truncate">
                            {contact.firstName} {contact.lastName}
                          </h3>
                          <StatusPill status={contact.status} size="sm" />
                        </div>
                        
                        {contact.title && (
                          <p className="text-sm text-aifm-charcoal/40 truncate">{contact.title}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                          {getCompanyName(contact.crmCompanyId) && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-aifm-charcoal/40">
                              <Building2 className="w-3.5 h-3.5" />
                              <span className="truncate">{getCompanyName(contact.crmCompanyId)}</span>
                            </span>
                          )}
                          {contact.email && (
                            <a 
                              href={`mailto:${contact.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm text-aifm-charcoal/40 hover:text-aifm-gold transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[180px]">{contact.email}</span>
                            </a>
                          )}
                          {contact.phone && (
                            <a 
                              href={`tel:${contact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm text-aifm-charcoal/40 hover:text-aifm-gold transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {contact.phone}
                            </a>
                          )}
                        </div>
                        
                        {/* Linked managed companies (bolag) */}
                        {contact.linkedManagedCompanyNames && contact.linkedManagedCompanyNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {contact.linkedManagedCompanyNames.map((name, i) => (
                              <span 
                                key={i}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-aifm-gold/15 text-aifm-charcoal"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContact(contact);
                            setShowForm(true);
                          }}
                          tooltip="Redigera"
                        >
                          <Edit2 className="w-4 h-4" />
                        </IconButton>
                        <IconButton
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(contact);
                          }}
                          tooltip="Ta bort"
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Form Sidebar */}
          {showForm && (
            <div className="fixed inset-0 z-50 lg:static lg:z-auto">
              {/* Mobile backdrop */}
              <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm lg:hidden" 
                onClick={() => { 
                  setShowForm(false); 
                  setSelectedContact(null); 
                  router.replace('/crm/contacts'); 
                }} 
              />
              <div className="absolute inset-x-0 bottom-0 top-20 lg:static bg-white rounded-t-3xl lg:rounded-2xl border border-gray-100 overflow-hidden lg:sticky lg:top-4 shadow-xl lg:shadow-none">
                <div className="h-full overflow-y-auto p-6">
                  <ContactForm
                    contact={selectedContact}
                    companies={companies}
                    onSave={handleSave}
                    onCancel={() => {
                      setShowForm(false);
                      setSelectedContact(null);
                      router.replace('/crm/contacts');
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <Modal
          open={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Ta bort kontakt?"
          description={`Är du säker på att du vill ta bort ${showDeleteConfirm?.firstName} ${showDeleteConfirm?.lastName}? Åtgärden kan inte ångras.`}
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

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
        </div>
      </CrmLayout>
    }>
      <ContactsContent />
    </Suspense>
  );
}
