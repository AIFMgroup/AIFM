'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { CrmCalendar } from '@/components/crm/Calendar';
import { X, Save, Clock, MapPin, User, Building2, Briefcase, Tag, Video, Phone, Globe } from 'lucide-react';
import type { Activity, Task, CalendarEvent, CrmCompany, Contact, Deal } from '@/lib/crm/types';
import { format, parseISO, addHours } from 'date-fns';

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formTime, setFormTime] = useState<string>('09:00');

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setSelectedActivity(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const [activitiesRes, tasksRes, companiesRes, contactsRes, dealsRes] = await Promise.all([
          fetch('/api/crm/activities'),
          fetch('/api/crm/tasks'),
          fetch('/api/crm/companies'),
          fetch('/api/crm/contacts'),
          fetch('/api/crm/deals'),
        ]);

        if (activitiesRes.ok) setActivities(await activitiesRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (companiesRes.ok) setCompanies(await companiesRes.json());
        if (contactsRes.ok) setContacts(await contactsRes.json());
        if (dealsRes.ok) setDeals(await dealsRes.json());
      } catch (error) {
        console.error('Failed to load calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'activity') {
      const activity = activities.find(a => a.id === event.entityId);
      if (activity) {
        setSelectedActivity(activity);
        setShowForm(true);
      }
    }
    // Tasks click could open task details
  };

  const handleCreateActivity = (date: Date, startTime?: string) => {
    setFormDate(date);
    setFormTime(startTime || '09:00');
    setSelectedActivity(null);
    setShowForm(true);
  };

  const handleEventDrop = async (eventId: string, newStart: Date, newEnd: Date) => {
    // Only handle activity drops
    const activity = activities.find(a => a.id === eventId);
    if (!activity) return;

    // Optimistic update
    setActivities(prev => prev.map(a => 
      a.id === eventId 
        ? { ...a, startTime: newStart.toISOString(), endTime: newEnd.toISOString() }
        : a
    ));

    try {
      const res = await fetch('/api/crm/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventId,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });

      if (!res.ok) {
        // Revert on error
        const revertRes = await fetch('/api/crm/activities');
        if (revertRes.ok) setActivities(await revertRes.json());
      }
    } catch (error) {
      console.error('Failed to update activity time:', error);
    }
  };

  const handleSave = async (data: Partial<Activity>) => {
    try {
      if (selectedActivity) {
        const res = await fetch('/api/crm/activities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: selectedActivity.id }),
        });
        if (res.ok) {
          const updated = await res.json();
          setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
        }
      } else {
        const res = await fetch('/api/crm/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          setActivities(prev => [created, ...prev]);
        }
      }
      setShowForm(false);
      setSelectedActivity(null);
      router.replace('/crm/calendar');
    } catch (error) {
      console.error('Failed to save activity:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedActivity) return;

    try {
      const res = await fetch(`/api/crm/activities?id=${selectedActivity.id}`, { method: 'DELETE' });
      if (res.ok) {
        setActivities(prev => prev.filter(a => a.id !== selectedActivity.id));
        setShowForm(false);
        setSelectedActivity(null);
      }
    } catch (error) {
      console.error('Failed to delete activity:', error);
    }
  };

  return (
    <CrmLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-120px)]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CrmCalendar
            activities={activities}
            tasks={tasks}
            onEventClick={handleEventClick}
            onCreateActivity={handleCreateActivity}
            onEventDrop={handleEventDrop}
          />
        )}

        {/* Activity Form Sidebar */}
        {showForm && (
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
            <ActivityForm
              activity={selectedActivity}
              defaultDate={formDate}
              defaultTime={formTime}
              companies={companies}
              contacts={contacts}
              deals={deals}
              onSave={handleSave}
              onDelete={selectedActivity ? handleDelete : undefined}
              onCancel={() => {
                setShowForm(false);
                setSelectedActivity(null);
                router.replace('/crm/calendar');
              }}
            />
          </div>
        )}
      </div>
    </CrmLayout>
  );
}

// Activity Form Component
interface ActivityFormProps {
  activity?: Activity | null;
  defaultDate: Date;
  defaultTime: string;
  companies: CrmCompany[];
  contacts: Contact[];
  deals: Deal[];
  onSave: (data: Partial<Activity>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

function ActivityForm({ 
  activity, 
  defaultDate, 
  defaultTime,
  companies, 
  contacts, 
  deals, 
  onSave, 
  onDelete, 
  onCancel 
}: ActivityFormProps) {
  const [loading, setLoading] = useState(false);
  
  const startTime = activity?.startTime 
    ? parseISO(activity.startTime) 
    : new Date(`${format(defaultDate, 'yyyy-MM-dd')}T${defaultTime}`);
  
  const endTime = activity?.endTime 
    ? parseISO(activity.endTime)
    : addHours(startTime, 1);

  const [formData, setFormData] = useState({
    type: activity?.type || 'meeting',
    title: activity?.title || '',
    description: activity?.description || '',
    date: format(startTime, 'yyyy-MM-dd'),
    startTime: format(startTime, 'HH:mm'),
    endTime: format(endTime, 'HH:mm'),
    isAllDay: activity?.isAllDay || false,
    location: activity?.location || '',
    contactId: activity?.contactId || '',
    crmCompanyId: activity?.crmCompanyId || '',
    dealId: activity?.dealId || '',
    status: activity?.status || 'scheduled',
    outcome: activity?.outcome || '',
    nextSteps: activity?.nextSteps || '',
    color: activity?.color || '#3b82f6',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contact = contacts.find(c => c.id === formData.contactId);
      const company = companies.find(c => c.id === formData.crmCompanyId);
      const deal = deals.find(d => d.id === formData.dealId);

      const startDateTime = formData.isAllDay 
        ? `${formData.date}T00:00:00`
        : `${formData.date}T${formData.startTime}:00`;
      
      const endDateTime = formData.isAllDay
        ? `${formData.date}T23:59:59`
        : `${formData.date}T${formData.endTime}:00`;

      await onSave({
        type: formData.type as Activity['type'],
        title: formData.title,
        description: formData.description || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: formData.isAllDay,
        location: formData.location || undefined,
        contactId: formData.contactId || undefined,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
        crmCompanyId: formData.crmCompanyId || undefined,
        crmCompanyName: company?.name,
        dealId: formData.dealId || undefined,
        dealName: deal?.name,
        status: formData.status as Activity['status'],
        outcome: formData.outcome || undefined,
        nextSteps: formData.nextSteps || undefined,
        color: formData.color,
      });
    } finally {
      setLoading(false);
    }
  };

  const activityTypes = [
    { id: 'meeting', label: 'Möte', icon: Video, color: '#3b82f6' },
    { id: 'call', label: 'Samtal', icon: Phone, color: '#22c55e' },
    { id: 'email', label: 'E-post', icon: Tag, color: '#f59e0b' },
    { id: 'note', label: 'Anteckning', icon: Tag, color: '#8b5cf6' },
  ];

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {activity ? 'Redigera aktivitet' : 'Ny aktivitet'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(parseISO(formData.date), 'd MMMM yyyy')}
          </p>
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
        {/* Activity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Typ</label>
          <div className="grid grid-cols-4 gap-2">
            {activityTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData({ ...formData, type: type.id as Activity['type'], color: type.color })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                  formData.type === type.id
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <type.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titel <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            placeholder="T.ex. Möte med kund"
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
            placeholder="Lägg till detaljer..."
          />
        </div>

        {/* Date & Time */}
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isAllDay}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="w-4 h-4 text-[#c0a280] rounded focus:ring-[#c0a280]"
            />
            <span className="text-sm text-gray-700">Heldag</span>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
              />
            </div>
            {!formData.isAllDay && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starttid</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sluttid</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MapPin className="w-4 h-4 inline mr-1" />
            Plats
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            placeholder="T.ex. Kontoret, Teams-möte"
          />
        </div>

        {/* Linked entities */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Kontakt
            </label>
            <select
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
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
              <Briefcase className="w-4 h-4 inline mr-1" />
              Affär
            </label>
            <select
              value={formData.dealId}
              onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            >
              <option value="">Välj affär...</option>
              {deals.filter(d => d.status === 'open').map((deal) => (
                <option key={deal.id} value={deal.id}>{deal.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status (for editing) */}
        {activity && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Activity['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
            >
              <option value="scheduled">Planerad</option>
              <option value="completed">Genomförd</option>
              <option value="cancelled">Avbokad</option>
              <option value="no_show">Utebliven</option>
            </select>
          </div>
        )}

        {/* Outcome & Next Steps */}
        {(activity?.status === 'completed' || formData.status === 'completed') && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resultat</label>
              <textarea
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
                placeholder="Vad blev resultatet?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nästa steg</label>
              <textarea
                value={formData.nextSteps}
                onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
                placeholder="Vad är nästa steg?"
              />
            </div>
          </>
        )}
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
            disabled={loading || !formData.title}
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
                {activity ? 'Spara' : 'Skapa'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
        </div>
      </CrmLayout>
    }>
      <CalendarContent />
    </Suspense>
  );
}

