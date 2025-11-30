'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, X, Check, Clock, AlertCircle, CheckCircle2, 
  DollarSign, FileText, Shield, Calendar,
  ArrowRight, Trash2, CheckCheck
} from 'lucide-react';
import { useCompany } from './CompanyContext';

// Notification types
type NotificationType = 'approval' | 'capital_call' | 'distribution' | 'compliance' | 'task' | 'document' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  priority?: 'high' | 'medium' | 'low';
  fundId?: string;
}

// Mock notifications data per fund
const mockNotificationsPerFund: Record<string, Notification[]> = {
  'company-1': [
    {
      id: 'n1',
      type: 'approval',
      title: 'Godkännande krävs',
      message: 'Utdelning på 2.5 MSEK väntar på ditt godkännande',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
      read: false,
      link: '/approvals',
      priority: 'high',
    },
    {
      id: 'n2',
      type: 'capital_call',
      title: 'Kapitalanrop skickat',
      message: 'Kapitalanrop #2024-Q4 har skickats till 12 investerare',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      read: false,
      link: '/capital-calls',
      priority: 'medium',
    },
    {
      id: 'n3',
      type: 'compliance',
      title: 'KYC-uppdatering',
      message: 'Investerare "Pension Fund AB" behöver uppdaterad KYC',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: true,
      link: '/investors',
      priority: 'high',
    },
    {
      id: 'n4',
      type: 'task',
      title: 'Ny uppgift tilldelad',
      message: 'Förbered Q4 styrelsemöte - deadline 10 dec',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      read: true,
      link: '/tasks',
    },
    {
      id: 'n5',
      type: 'document',
      title: 'Dokument laddat upp',
      message: 'Kvartalsrapport Q3 har laddats upp till datarummet',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: true,
      link: '/data-rooms',
    },
  ],
  'company-2': [
    {
      id: 'n6',
      type: 'distribution',
      title: 'Utdelning godkänd',
      message: 'Exit-utdelning på 8.5 MEUR har godkänts av alla parter',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      read: false,
      link: '/distributions',
      priority: 'medium',
    },
    {
      id: 'n7',
      type: 'compliance',
      title: 'Due Diligence-påminnelse',
      message: 'CloudTech DD ska slutföras senast 5 december',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      read: false,
      link: '/tasks',
      priority: 'high',
    },
  ],
  'company-3': [
    {
      id: 'n8',
      type: 'capital_call',
      title: 'Delbetalning mottagen',
      message: '15 MSEK mottaget från Malmö Kommun Pension',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      read: false,
      link: '/capital-calls',
    },
    {
      id: 'n9',
      type: 'document',
      title: 'Fastighetsvärdering klar',
      message: 'Nya värderingar för 4 fastigheter har laddats upp',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      read: true,
      link: '/data-rooms',
    },
  ],
  'company-4': [
    {
      id: 'n10',
      type: 'approval',
      title: 'Investering väntar',
      message: 'Serie A i GreenPower (5 MEUR) väntar på godkännande',
      timestamp: new Date(Date.now() - 1000 * 60 * 10),
      read: false,
      link: '/approvals',
      priority: 'high',
    },
    {
      id: 'n11',
      type: 'task',
      title: 'Impact-rapport',
      message: 'Kvartalsvis påverkansrapport ska lämnas in',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      read: false,
      link: '/tasks',
      priority: 'medium',
    },
  ],
  'company-5': [
    {
      id: 'n12',
      type: 'compliance',
      title: 'PEP-flagga',
      message: 'Ny investerare flaggad som PEP - kräver extra granskning',
      timestamp: new Date(Date.now() - 1000 * 60 * 20),
      read: false,
      link: '/investors',
      priority: 'high',
    },
    {
      id: 'n13',
      type: 'system',
      title: 'LP-uppdatering skickad',
      message: 'Kvartalsuppdatering har skickats till alla LPs',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
      read: true,
    },
  ],
};

// Icon mapping
const typeIcons: Record<NotificationType, typeof Bell> = {
  approval: CheckCircle2,
  capital_call: DollarSign,
  distribution: DollarSign,
  compliance: Shield,
  task: Calendar,
  document: FileText,
  system: Bell,
};

const typeColors: Record<NotificationType, string> = {
  approval: 'text-green-600 bg-green-50',
  capital_call: 'text-blue-600 bg-blue-50',
  distribution: 'text-purple-600 bg-purple-50',
  compliance: 'text-amber-600 bg-amber-50',
  task: 'text-indigo-600 bg-indigo-50',
  document: 'text-gray-600 bg-gray-50',
  system: 'text-gray-600 bg-gray-50',
};

// Time formatting
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'Just nu';
  if (diffMin < 60) return `${diffMin} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays === 1) return 'Igår';
  return `${diffDays} dagar sedan`;
}

export function NotificationPanel() {
  const { selectedCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load notifications for selected company
  useEffect(() => {
    const fundNotifications = mockNotificationsPerFund[selectedCompany.id] || [];
    setNotifications(fundNotifications);
  }, [selectedCompany.id]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200
          ${isOpen 
            ? 'bg-aifm-gold/10 text-aifm-gold' 
            : 'text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/5'}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-aifm-gold text-white 
                         text-[10px] font-semibold rounded-full flex items-center justify-center 
                         animate-pulse shadow-lg shadow-aifm-gold/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[380px] max-w-[calc(100vw-32px)] bg-white rounded-2xl 
                        border border-gray-100 shadow-2xl shadow-black/10 overflow-hidden z-50
                        animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-aifm-charcoal/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-aifm-charcoal/50" />
                <h3 className="font-medium text-aifm-charcoal text-sm">Notifikationer</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-aifm-gold/10 text-aifm-gold text-xs font-medium rounded-full">
                    {unreadCount} nya
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/10 
                             rounded-lg transition-colors"
                    title="Markera alla som lästa"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 text-aifm-charcoal/40 hover:text-red-500 hover:bg-red-50 
                             rounded-lg transition-colors"
                    title="Rensa alla"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-aifm-charcoal/40 hover:text-aifm-charcoal hover:bg-gray-100 
                           rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-aifm-charcoal/50">Inga notifikationer</p>
                <p className="text-xs text-aifm-charcoal/30 mt-1">Du är helt uppdaterad!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type];
                  const colorClass = typeColors[notification.type];
                  
                  return (
                    <div 
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50/50 transition-colors relative group
                        ${!notification.read ? 'bg-aifm-gold/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium truncate ${!notification.read ? 'text-aifm-charcoal' : 'text-aifm-charcoal/70'}`}>
                                  {notification.title}
                                </p>
                                {notification.priority === 'high' && (
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-aifm-charcoal/50 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Clock className="w-3 h-3 text-aifm-charcoal/30" />
                                <span className="text-[10px] text-aifm-charcoal/40">
                                  {formatTimeAgo(notification.timestamp)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 text-aifm-charcoal/30 hover:text-aifm-gold hover:bg-aifm-gold/10 
                                           rounded transition-colors"
                                  title="Markera som läst"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="p-1 text-aifm-charcoal/30 hover:text-red-500 hover:bg-red-50 
                                         rounded transition-colors"
                                title="Ta bort"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Link */}
                          {notification.link && (
                            <Link
                              href={notification.link}
                              onClick={() => {
                                markAsRead(notification.id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 mt-2 text-xs text-aifm-gold 
                                       hover:text-aifm-gold/80 font-medium"
                            >
                              Visa mer
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>

                        {/* Unread indicator */}
                        {!notification.read && (
                          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 
                                        bg-aifm-gold rounded-full" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <Link
                href="/tasks"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 text-xs text-aifm-charcoal/50 
                         hover:text-aifm-gold transition-colors"
              >
                Se alla uppgifter och notifikationer
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

