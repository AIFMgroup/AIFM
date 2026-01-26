'use client';

import { useState, useMemo } from 'react';
import { 
  Shield, Users, CheckCircle2, XCircle, Eye, Edit, 
  Trash2, Settings, FileText, BarChart3, Lock, Unlock,
  ChevronDown, Search, Plus, Info, AlertTriangle, X,
  Save, UserPlus, UserMinus, Building2, Scale, Briefcase,
  Clock, Globe, Database, Mail, Key, Activity
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'accounting' | 'compliance' | 'dataroom' | 'admin' | 'reporting' | 'crm' | 'security';
}

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  userCount: number;
  permissions: string[];
  isSystem: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  avatar?: string;
}

// ============================================================================
// Data - 30+ permissions grouped by category
// ============================================================================

const permissions: Permission[] = [
  // Accounting (7)
  { id: 'accounting.view', name: 'Visa bokföring', description: 'Visa verifikationer och kontoplan', category: 'accounting' },
  { id: 'accounting.edit', name: 'Redigera klassificering', description: 'Ändra AI-klassificering av fakturor', category: 'accounting' },
  { id: 'accounting.approve', name: 'Godkänna transaktioner', description: 'Godkänna bokföringsposter', category: 'accounting' },
  { id: 'accounting.send', name: 'Skicka till Fortnox', description: 'Överföra godkända poster till Fortnox', category: 'accounting' },
  { id: 'accounting.delete', name: 'Radera transaktioner', description: 'Ta bort bokföringsposter', category: 'accounting' },
  { id: 'accounting.reconcile', name: 'Bankavstemning', description: 'Genomföra bankavstemningar', category: 'accounting' },
  { id: 'accounting.close', name: 'Periodstängning', description: 'Stänga bokföringsperioder', category: 'accounting' },
  
  // Compliance (6)
  { id: 'compliance.view', name: 'Visa compliance', description: 'Visa compliance-status och rapporter', category: 'compliance' },
  { id: 'compliance.manage', name: 'Hantera policies', description: 'Skapa och redigera compliance-policies', category: 'compliance' },
  { id: 'compliance.audit', name: 'Genomföra granskning', description: 'Utföra compliance-granskningar', category: 'compliance' },
  { id: 'compliance.kyc', name: 'KYC-hantering', description: 'Verifiera och godkänna KYC-dokumentation', category: 'compliance' },
  { id: 'compliance.aml', name: 'AML-övervakning', description: 'Övervaka misstänkta transaktioner', category: 'compliance' },
  { id: 'compliance.report', name: 'Myndighetsrapporter', description: 'Skapa och skicka rapporter till FI', category: 'compliance' },
  
  // Data Room (6)
  { id: 'dataroom.view', name: 'Visa datarum', description: 'Se filer och mappar i datarum', category: 'dataroom' },
  { id: 'dataroom.upload', name: 'Ladda upp filer', description: 'Ladda upp dokument till datarum', category: 'dataroom' },
  { id: 'dataroom.download', name: 'Ladda ner filer', description: 'Hämta dokument från datarum', category: 'dataroom' },
  { id: 'dataroom.manage', name: 'Hantera datarum', description: 'Skapa och konfigurera datarum', category: 'dataroom' },
  { id: 'dataroom.share', name: 'Dela externt', description: 'Skapa delade länkar till externa parter', category: 'dataroom' },
  { id: 'dataroom.watermark', name: 'Vattenmärkning', description: 'Konfigurera dokumentvattenmärkning', category: 'dataroom' },
  
  // Reporting (5)
  { id: 'reporting.view', name: 'Visa rapporter', description: 'Se genererade rapporter', category: 'reporting' },
  { id: 'reporting.generate', name: 'Generera rapporter', description: 'Skapa nya rapporter', category: 'reporting' },
  { id: 'reporting.export', name: 'Exportera data', description: 'Exportera rapportdata till Excel/PDF', category: 'reporting' },
  { id: 'reporting.nav', name: 'NAV-beräkning', description: 'Beräkna och publicera NAV', category: 'reporting' },
  { id: 'reporting.schedule', name: 'Schemalägg rapporter', description: 'Ställa in automatiska rapporter', category: 'reporting' },
  
  // CRM (5)
  { id: 'crm.view', name: 'Visa CRM', description: 'Se kundregister och aktiviteter', category: 'crm' },
  { id: 'crm.edit', name: 'Redigera kunder', description: 'Uppdatera kundinformation', category: 'crm' },
  { id: 'crm.communicate', name: 'Kundkommunikation', description: 'Skicka meddelanden till kunder', category: 'crm' },
  { id: 'crm.deals', name: 'Hantera affärer', description: 'Skapa och hantera affärsmöjligheter', category: 'crm' },
  { id: 'crm.pipeline', name: 'Pipeline-översikt', description: 'Se hela säljpipelinen', category: 'crm' },
  
  // Admin (6)
  { id: 'admin.users', name: 'Hantera användare', description: 'Skapa och redigera användarkonton', category: 'admin' },
  { id: 'admin.roles', name: 'Hantera roller', description: 'Skapa och tilldela roller', category: 'admin' },
  { id: 'admin.settings', name: 'Systeminställningar', description: 'Konfigurera systemövergripande inställningar', category: 'admin' },
  { id: 'admin.audit', name: 'Visa audit-loggar', description: 'Granska alla systemhändelser', category: 'admin' },
  { id: 'admin.integrations', name: 'Hantera integrationer', description: 'Konfigurera externa integrationer', category: 'admin' },
  { id: 'admin.billing', name: 'Fakturering', description: 'Hantera prenumerationer och betalningar', category: 'admin' },
  
  // Security (5)
  { id: 'security.mfa', name: 'MFA-hantering', description: 'Konfigurera tvåfaktorsautentisering', category: 'security' },
  { id: 'security.sessions', name: 'Sessionshantering', description: 'Övervaka och avsluta sessioner', category: 'security' },
  { id: 'security.policies', name: 'Säkerhetspolicies', description: 'Konfigurera lösenordspolicies', category: 'security' },
  { id: 'security.ip', name: 'IP-vitlistning', description: 'Hantera tillåtna IP-adresser', category: 'security' },
  { id: 'security.sso', name: 'SSO-konfiguration', description: 'Konfigurera single sign-on', category: 'security' },
];

const defaultRoles: Role[] = [
  { 
    id: 'admin', 
    name: 'Administratör', 
    description: 'Full åtkomst till alla funktioner', 
    color: 'bg-purple-500',
    userCount: 2,
    permissions: permissions.map(p => p.id),
    isSystem: true
  },
  { 
    id: 'executive', 
    name: 'Ledning (CFO/VD)', 
    description: 'Strategisk överblick och godkännande', 
    color: 'bg-aifm-gold',
    userCount: 3,
    permissions: [
      'accounting.view', 'accounting.approve', 'accounting.send', 'accounting.close',
      'compliance.view', 'compliance.audit', 'compliance.report',
      'dataroom.view', 'dataroom.download',
      'reporting.view', 'reporting.generate', 'reporting.export', 'reporting.nav',
      'crm.view', 'crm.pipeline',
      'admin.audit'
    ],
    isSystem: true
  },
  { 
    id: 'manager', 
    name: 'Chef/Manager', 
    description: 'Operativ ledning och daglig drift', 
    color: 'bg-blue-500',
    userCount: 5,
    permissions: [
      'accounting.view', 'accounting.edit', 'accounting.approve', 'accounting.reconcile',
      'compliance.view', 'compliance.kyc',
      'dataroom.view', 'dataroom.upload', 'dataroom.download', 'dataroom.share',
      'reporting.view', 'reporting.generate', 'reporting.export', 'reporting.nav',
      'crm.view', 'crm.edit', 'crm.communicate', 'crm.deals'
    ],
    isSystem: true
  },
  { 
    id: 'accountant', 
    name: 'Redovisningsekonom', 
    description: 'Daglig bokföring och rapportering', 
    color: 'bg-emerald-500',
    userCount: 8,
    permissions: [
      'accounting.view', 'accounting.edit', 'accounting.approve', 'accounting.send', 'accounting.reconcile',
      'compliance.view',
      'dataroom.view', 'dataroom.upload', 'dataroom.download',
      'reporting.view', 'reporting.generate', 'reporting.nav'
    ],
    isSystem: true
  },
  { 
    id: 'compliance_officer', 
    name: 'Compliance Officer', 
    description: 'Regelefterlevnad och riskhantering', 
    color: 'bg-rose-500',
    userCount: 2,
    permissions: [
      'accounting.view',
      'compliance.view', 'compliance.manage', 'compliance.audit', 'compliance.kyc', 'compliance.aml', 'compliance.report',
      'dataroom.view', 'dataroom.download',
      'reporting.view', 'reporting.generate',
      'admin.audit'
    ],
    isSystem: true
  },
  { 
    id: 'auditor', 
    name: 'Revisor (extern)', 
    description: 'Endast läsrättigheter för revision', 
    color: 'bg-gray-500',
    userCount: 2,
    permissions: [
      'accounting.view',
      'compliance.view', 'compliance.audit',
      'dataroom.view', 'dataroom.download',
      'reporting.view',
      'admin.audit'
    ],
    isSystem: true
  },
  { 
    id: 'customer', 
    name: 'Kund/Investerare', 
    description: 'Begränsad åtkomst till eget innehåll', 
    color: 'bg-amber-500',
    userCount: 45,
    permissions: [
      'dataroom.view', 'dataroom.download',
      'reporting.view'
    ],
    isSystem: true
  },
];

const mockUsers: User[] = [
  { id: 'u1', name: 'Erik Johansson', email: 'erik@aifmgroup.se', roles: ['admin'] },
  { id: 'u2', name: 'Anna Svensson', email: 'anna@aifmgroup.se', roles: ['executive', 'manager'] },
  { id: 'u3', name: 'Johan Lindberg', email: 'johan@aifmgroup.se', roles: ['accountant'] },
  { id: 'u4', name: 'Maria Karlsson', email: 'maria@aifmgroup.se', roles: ['compliance_officer'] },
  { id: 'u5', name: 'Per Olsson', email: 'per@aifmgroup.se', roles: ['accountant'] },
  { id: 'u6', name: 'Lisa Andersson', email: 'lisa@external.se', roles: ['auditor'] },
];

// ============================================================================
// Helper Components
// ============================================================================

const categoryIcons: Record<string, typeof Shield> = {
  accounting: FileText,
  compliance: Scale,
  dataroom: Lock,
  reporting: BarChart3,
  admin: Settings,
  crm: Building2,
  security: Key,
};

const categoryLabels: Record<string, string> = {
  accounting: 'Bokföring',
  compliance: 'Compliance',
  dataroom: 'Datarum',
  reporting: 'Rapportering',
  admin: 'Administration',
  crm: 'CRM & Kunder',
  security: 'Säkerhet',
};

function PermissionCheck({ hasPermission, onClick }: { hasPermission: boolean; onClick?: () => void }) {
  if (hasPermission) {
    return (
      <button 
        onClick={onClick}
        className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center hover:bg-emerald-200 transition-colors"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      </button>
    );
  }
  return (
    <button 
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
    >
      <XCircle className="w-4 h-4 text-gray-300" />
    </button>
  );
}

function RoleHeader({ role }: { role: Role }) {
  return (
    <div className="text-center px-2">
      <div className={`w-10 h-10 ${role.color} rounded-xl mx-auto mb-2 flex items-center justify-center`}>
        <Users className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs font-semibold text-aifm-charcoal truncate">{role.name}</p>
      <p className="text-[10px] text-aifm-charcoal/40">{role.userCount} användare</p>
    </div>
  );
}

// ============================================================================
// Modal Components
// ============================================================================

function CreateRoleModal({ 
  isOpen, 
  onClose, 
  onSave,
  allPermissions 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (role: Omit<Role, 'id' | 'userCount'>) => void;
  allPermissions: Permission[];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-rose-500', 
    'bg-amber-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-pink-500'
  ];

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name,
      description,
      color,
      permissions: selectedPermissions,
      isSystem: false
    });
    setName('');
    setDescription('');
    setSelectedPermissions([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aifm-charcoal">Skapa ny roll</h2>
              <p className="text-sm text-aifm-charcoal/50">Definiera behörigheter för rollen</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-aifm-charcoal/50" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Rollnamn</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Fund Manager"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:border-aifm-gold/50 focus:ring-2 focus:ring-aifm-gold/10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Beskrivning</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kort beskrivning av rollens ansvar"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:border-aifm-gold/50 focus:ring-2 focus:ring-aifm-gold/10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">Färg</label>
              <div className="flex gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg ${c} ${color === c ? 'ring-2 ring-offset-2 ring-aifm-charcoal' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-3">Behörigheter</label>
            <div className="space-y-4">
              {Object.entries(categoryLabels).map(([category, label]) => {
                const categoryPerms = allPermissions.filter(p => p.category === category);
                const Icon = categoryIcons[category];
                const selectedCount = categoryPerms.filter(p => selectedPermissions.includes(p.id)).length;

                return (
                  <div key={category} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-aifm-charcoal/50" />
                        <span className="text-sm font-semibold text-aifm-charcoal">{label}</span>
                      </div>
                      <button
                        onClick={() => {
                          const allIds = categoryPerms.map(p => p.id);
                          if (selectedCount === categoryPerms.length) {
                            setSelectedPermissions(prev => prev.filter(id => !allIds.includes(id)));
                          } else {
                            setSelectedPermissions(prev => [...new Set([...prev, ...allIds])]);
                          }
                        }}
                        className="text-xs text-aifm-gold hover:underline"
                      >
                        {selectedCount === categoryPerms.length ? 'Avmarkera alla' : 'Välj alla'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryPerms.map((perm) => (
                        <label 
                          key={perm.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions(prev => [...prev, perm.id]);
                              } else {
                                setSelectedPermissions(prev => prev.filter(id => id !== perm.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                          />
                          <span className="text-sm text-aifm-charcoal">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl
                       text-sm font-medium hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Skapa roll
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageUserRolesModal({
  isOpen,
  onClose,
  users,
  roles,
  onUpdateUser
}: {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  roles: Role[];
  onUpdateUser: (userId: string, roles: string[]) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-charcoal rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aifm-charcoal">Hantera användarroller</h2>
              <p className="text-sm text-aifm-charcoal/50">Tilldela och ta bort roller från användare</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-aifm-charcoal/50" />
          </button>
        </div>

        <div className="flex h-[500px]">
          {/* Users List */}
          <div className="w-1/2 border-r border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
                <input
                  type="text"
                  placeholder="Sök användare..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors
                             ${selectedUser?.id === user.id ? 'bg-aifm-gold/5 border-l-2 border-l-aifm-gold' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/70 
                                  flex items-center justify-center text-white font-semibold text-sm">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-aifm-charcoal truncate">{user.name}</p>
                      <p className="text-xs text-aifm-charcoal/50 truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-aifm-charcoal/40 bg-gray-100 px-2 py-1 rounded-full">
                      {user.roles.length} roller
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Role Assignment */}
          <div className="w-1/2 overflow-y-auto p-6">
            {selectedUser ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/70 
                                flex items-center justify-center text-white font-semibold">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-aifm-charcoal">{selectedUser.name}</p>
                    <p className="text-sm text-aifm-charcoal/50">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">
                    Tilldelade roller
                  </p>
                  {roles.map((role) => {
                    const hasRole = selectedUser.roles.includes(role.id);
                    return (
                      <div 
                        key={role.id}
                        className={`p-4 rounded-xl border transition-all ${
                          hasRole 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${role.color} rounded-lg flex items-center justify-center`}>
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-aifm-charcoal">{role.name}</p>
                              <p className="text-xs text-aifm-charcoal/40">{role.permissions.length} behörigheter</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newRoles = hasRole
                                ? selectedUser.roles.filter(r => r !== role.id)
                                : [...selectedUser.roles, role.id];
                              onUpdateUser(selectedUser.id, newRoles);
                              setSelectedUser({ ...selectedUser, roles: newRoles });
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              hasRole
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            }`}
                          >
                            {hasRole ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-aifm-charcoal/50">Välj en användare</p>
                  <p className="text-sm text-aifm-charcoal/30">för att hantera roller</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Role Card (for mobile/cards view)
// ============================================================================

function RoleCard({ role, permissions: allPermissions, onEdit }: { 
  role: Role; 
  permissions: Permission[];
  onEdit: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const permissionCount = role.permissions.length;
  const totalPermissions = allPermissions.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${role.color} rounded-xl flex items-center justify-center`}>
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-aifm-charcoal">{role.name}</p>
              {role.isSystem && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">SYSTEM</span>
              )}
            </div>
            <p className="text-xs text-aifm-charcoal/50">{role.description}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-aifm-charcoal/40">
              <span>{role.userCount} användare</span>
              <span>•</span>
              <span>{permissionCount}/{totalPermissions} behörigheter</span>
            </div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-aifm-charcoal/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="pt-4 space-y-3">
            {Object.keys(categoryLabels).map(category => {
              const categoryPermissions = allPermissions.filter(p => p.category === category);
              const enabledCount = categoryPermissions.filter(p => role.permissions.includes(p.id)).length;
              const Icon = categoryIcons[category];
              
              return (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-aifm-charcoal/50" />
                    <span className="text-sm text-aifm-charcoal">{categoryLabels[category]}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    enabledCount === categoryPermissions.length 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : enabledCount > 0 
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {enabledCount}/{categoryPermissions.length}
                  </span>
                </div>
              );
            })}
          </div>
          {!role.isSystem && (
            <div className="mt-4 flex gap-2">
              <button 
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 
                          text-aifm-charcoal rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Redigera
              </button>
              <button 
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 
                          text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserRolesModal, setShowUserRolesModal] = useState(false);

  const filteredPermissions = searchQuery 
    ? permissions.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : permissions;

  const groupedPermissions = useMemo(() => {
    return filteredPermissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [filteredPermissions]);

  const handleCreateRole = (roleData: Omit<Role, 'id' | 'userCount'>) => {
    const newRole: Role = {
      ...roleData,
      id: `custom-${Date.now()}`,
      userCount: 0
    };
    setRoles(prev => [...prev, newRole]);
  };

  const handleUpdateUserRoles = (userId: string, newRoles: string[]) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles } : u));
    // Update user counts
    setRoles(prev => prev.map(role => ({
      ...role,
      userCount: users.filter(u => 
        u.id === userId ? newRoles.includes(role.id) : u.roles.includes(role.id)
      ).length
    })));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Behörighetsmatris</h1>
            <p className="text-sm text-aifm-charcoal/50">
              {roles.length} roller • {permissions.length} behörigheter
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'matrix' ? 'bg-white text-aifm-charcoal shadow-sm' : 'text-aifm-charcoal/50'
              }`}
            >
              Matris
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'cards' ? 'bg-white text-aifm-charcoal shadow-sm' : 'text-aifm-charcoal/50'
              }`}
            >
              Kort
            </button>
          </div>
          <button
            onClick={() => setShowUserRolesModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-aifm-charcoal rounded-xl
                       text-sm font-medium hover:bg-gray-50 transition-all"
          >
            <Users className="w-4 h-4" />
            Användare
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                       text-sm font-medium hover:bg-aifm-charcoal/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Ny roll
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Roller:</p>
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${role.color}`} />
              <span className="text-sm text-aifm-charcoal">{role.name}</span>
              <span className="text-xs text-aifm-charcoal/40">({role.userCount})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
        <input
          type="text"
          placeholder="Sök behörigheter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:border-aifm-gold/50 focus:ring-2 focus:ring-aifm-gold/10
                     placeholder:text-aifm-charcoal/40 transition-all"
        />
      </div>

      {/* Matrix View */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 bg-gray-50/80 sticky left-0 z-10 min-w-[280px]">
                    <span className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                      Behörighet
                    </span>
                  </th>
                  {roles.map(role => (
                    <th key={role.id} className="px-4 py-4 bg-gray-50/80 min-w-[100px]">
                      <RoleHeader role={role} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                  const Icon = categoryIcons[category];
                  return (
                    <>
                      {/* Category Header */}
                      <tr key={`cat-${category}`} className="bg-gray-50/50">
                        <td colSpan={roles.length + 1} className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-aifm-charcoal/50" />
                            <span className="text-sm font-semibold text-aifm-charcoal">
                              {categoryLabels[category]}
                            </span>
                            <span className="text-xs text-aifm-charcoal/30">
                              ({categoryPermissions.length})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Permissions */}
                      {categoryPermissions.map(permission => (
                        <tr key={permission.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-3 sticky left-0 bg-white">
                            <div>
                              <p className="text-sm font-medium text-aifm-charcoal">{permission.name}</p>
                              <p className="text-xs text-aifm-charcoal/40">{permission.description}</p>
                            </div>
                          </td>
                          {roles.map(role => (
                            <td key={`${permission.id}-${role.id}`} className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <PermissionCheck 
                                  hasPermission={role.permissions.includes(permission.id)} 
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <RoleCard 
              key={role.id} 
              role={role} 
              permissions={permissions} 
              onEdit={() => {/* TODO: Edit modal */}} 
            />
          ))}
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-aifm-charcoal mb-1">Om behörigheter</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-3">
              Behörigheter tilldelas via roller. En användare kan ha flera roller och får då kombinationen av alla behörigheter.
              Systemroller kan inte raderas men kan justeras. Egna roller kan skapas för specifika behov.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <a href="/admin/users" className="text-aifm-gold hover:underline flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Hantera användare
              </a>
              <a href="/admin/security" className="text-aifm-gold hover:underline flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                Säkerhetsinställningar
              </a>
              <a href="/audit/logs" className="text-aifm-gold hover:underline flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                Granskningslogg
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateRoleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateRole}
        allPermissions={permissions}
      />

      <ManageUserRolesModal
        isOpen={showUserRolesModal}
        onClose={() => setShowUserRolesModal(false)}
        users={users}
        roles={roles}
        onUpdateUser={handleUpdateUserRoles}
      />
    </div>
  );
}
