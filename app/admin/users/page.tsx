'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, MoreHorizontal, Shield, Mail, 
  CheckCircle2, XCircle, Clock, Trash2, Edit, Key,
  UserPlus, UserMinus, RefreshCw, AlertTriangle, Eye, EyeOff
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface User {
  username: string;
  email?: string;
  name?: string;
  phone?: string;
  status: string;
  enabled: boolean;
  created?: string;
  modified?: string;
  groups: string[];
}

interface Group {
  name: string;
  description?: string;
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" />
        Inaktiverad
      </span>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    CONFIRMED: { label: 'Aktiv', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    FORCE_CHANGE_PASSWORD: { label: 'Nytt lösenord krävs', color: 'bg-amber-100 text-amber-700', icon: Key },
    UNCONFIRMED: { label: 'Ej bekräftad', color: 'bg-gray-100 text-gray-600', icon: Clock },
    RESET_REQUIRED: { label: 'Återställning krävs', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  };

  const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ============================================================================
// Role Badges
// ============================================================================

function RoleBadges({ groups }: { groups: string[] }) {
  if (groups.length === 0) {
    return <span className="text-xs text-gray-400">Inga roller</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((group) => (
        <span 
          key={group}
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            group === 'admin' 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {group}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Create User Modal
// ============================================================================

interface CreateUserModalProps {
  groups: Group[];
  onClose: () => void;
  onCreate: (data: { email: string; name?: string; tempPassword?: string; groups: string[]; sendInvite: boolean }) => Promise<void>;
}

function CreateUserModal({ groups, onClose, onCreate }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sendInvite, setSendInvite] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('E-post krävs');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onCreate({
        email,
        name: name || undefined,
        tempPassword: tempPassword || undefined,
        groups: selectedGroups,
        sendInvite,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kunde inte skapa användare');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(password);
    setShowPassword(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Lägg till användare</h2>
          <p className="text-sm text-gray-500">Skapa en ny användare i systemet</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-postadress <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@foretag.se"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namn
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Förnamn Efternamn"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tillfälligt lösenord
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Lämna tomt för auto-genererat"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="px-3 py-2 text-sm text-[#c0a280] border border-[#c0a280] rounded-lg hover:bg-[#c0a280]/5"
              >
                Generera
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roller
            </label>
            <div className="space-y-2">
              {groups.map((group) => (
                <label key={group.name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.name!)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroups([...selectedGroups, group.name!]);
                      } else {
                        setSelectedGroups(selectedGroups.filter(g => g !== group.name));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                  />
                  <span className="text-sm text-gray-700">{group.name}</span>
                  {group.description && (
                    <span className="text-xs text-gray-400">({group.description})</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Skicka inbjudan via e-post</p>
              <p className="text-xs text-gray-500">Användaren får ett e-postmeddelande med inloggningsuppgifter</p>
            </div>
            <button
              type="button"
              onClick={() => setSendInvite(!sendInvite)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                sendInvite ? 'bg-[#c0a280]' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  sendInvite ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Skapa användare
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Edit User Modal
// ============================================================================

interface EditUserModalProps {
  user: User;
  groups: Group[];
  onClose: () => void;
  onUpdate: (username: string, action: string, data?: any) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
}

function EditUserModal({ user, groups, onClose, onUpdate, onDelete }: EditUserModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(user.groups);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'roles' | 'security'>('info');

  const handleUpdateGroups = async () => {
    setIsLoading(true);
    try {
      await onUpdate(user.username, 'updateGroups', { groups: selectedGroups });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) return;
    setIsLoading(true);
    try {
      await onUpdate(user.username, 'resetPassword', { newPassword });
      setNewPassword('');
      alert('Lösenord återställt! Användaren måste byta lösenord vid nästa inloggning.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    setIsLoading(true);
    try {
      await onUpdate(user.username, user.enabled ? 'disable' : 'enable');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Är du säker på att du vill ta bort användaren ${user.email}? Detta kan inte ångras.`)) {
      return;
    }
    setIsLoading(true);
    try {
      await onDelete(user.username);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-600">
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{user.name || user.email}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'info', label: 'Information' },
            { id: 'roles', label: 'Roller' },
            { id: 'security', label: 'Säkerhet' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[#c0a280] border-b-2 border-[#c0a280]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Status</span>
                <StatusBadge status={user.status} enabled={user.enabled} />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Skapad</span>
                <span className="text-sm text-gray-900">
                  {user.created ? new Date(user.created).toLocaleDateString('sv-SE') : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Senast ändrad</span>
                <span className="text-sm text-gray-900">
                  {user.modified ? new Date(user.modified).toLocaleDateString('sv-SE') : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Roller</span>
                <RoleBadges groups={user.groups} />
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Välj vilka roller användaren ska ha:</p>
              <div className="space-y-2">
                {groups.map((group) => (
                  <label key={group.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.name!)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroups([...selectedGroups, group.name!]);
                        } else {
                          setSelectedGroups(selectedGroups.filter(g => g !== group.name));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{group.name}</span>
                      {group.description && (
                        <p className="text-xs text-gray-500">{group.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={handleUpdateGroups}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] disabled:opacity-50"
              >
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Spara roller
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* Toggle Enable/Disable */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Användarkonto</p>
                    <p className="text-xs text-gray-500">
                      {user.enabled ? 'Kontot är aktivt' : 'Kontot är inaktiverat'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleEnabled}
                    disabled={isLoading}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      user.enabled
                        ? 'text-red-600 bg-red-50 hover:bg-red-100'
                        : 'text-green-600 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    {user.enabled ? 'Inaktivera' : 'Aktivera'}
                  </button>
                </div>
              </div>

              {/* Reset Password */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Återställ lösenord</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nytt tillfälligt lösenord"
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={handleResetPassword}
                    disabled={!newPassword || isLoading}
                    className="px-3 py-2 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    Återställ
                  </button>
                </div>
              </div>

              {/* Delete User */}
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">Ta bort användare</p>
                    <p className="text-xs text-red-600">Detta kan inte ångras</p>
                  </div>
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Ta bort
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Kunde inte hämta användare');
      }
      const data = await response.json();
      setUsers(data.users);
      setGroups(data.groups);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (data: any) => {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Kunde inte skapa användare');
    }
    await fetchUsers();
  };

  const handleUpdateUser = async (username: string, action: string, data?: any) => {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action, ...data }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Kunde inte uppdatera användare');
    }
    await fetchUsers();
  };

  const handleDeleteUser = async (username: string) => {
    const response = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Kunde inte ta bort användare');
    }
    await fetchUsers();
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Användarhantering</h1>
          <p className="text-gray-500 mt-1">Hantera användare och behörigheter</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2d2a26] text-white rounded-lg hover:bg-[#3d3a36] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Lägg till användare
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Totalt</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Aktiva</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {users.filter(u => u.enabled && u.status === 'CONFIRMED').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Administratörer</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {users.filter(u => u.groups.includes('admin')).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Väntar aktivering</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {users.filter(u => u.status === 'FORCE_CHANGE_PASSWORD').length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök användare..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500">Laddar användare...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Inga användare hittades</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Användare</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roller</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Skapad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.username} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-600">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name || '-'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} enabled={user.enabled} />
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadges groups={user.groups} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.created ? new Date(user.created).toLocaleDateString('sv-SE') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          groups={groups}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
        />
      )}

      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          groups={groups}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleUpdateUser}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
}



