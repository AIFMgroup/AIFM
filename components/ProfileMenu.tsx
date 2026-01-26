'use client';

import { useState, useRef, useEffect } from 'react';
import { useUserProfile } from './UserProfileContext';

export function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { profile, avatarSrc } = useUserProfile();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-white border border-gray-100 
                   hover:border-aifm-gold/30 hover:shadow-lg hover:shadow-aifm-gold/10 transition-all duration-300"
      >
        <span className="text-sm font-medium text-aifm-charcoal hidden sm:inline">
          {profile?.title ? `${profile.title}` : 'Profil'}
        </span>
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-aifm-gold/20 bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-semibold text-sm">
              {(profile?.displayName || profile?.email || 'A').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-32px)] bg-white rounded-2xl border border-gray-100 
                        shadow-2xl shadow-black/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Profile Header */}
          <a href="/settings?tab=profile" className="block p-4 border-b border-gray-100 bg-gradient-to-r from-aifm-gold/5 to-transparent hover:from-aifm-gold/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-semibold">
                    {(profile?.displayName || profile?.email || 'A').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-aifm-charcoal">{profile?.displayName || 'Min profil'}</p>
                <p className="text-xs text-aifm-charcoal/50">{profile?.title ? `${profile.title} • ` : ''}{profile?.email || ''}</p>
              </div>
            </div>
          </a>
          
          {/* Menu Items */}
          <div className="p-2">
            <a href="/settings?tab=profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Min profil</p>
                <p className="text-xs text-aifm-charcoal/40">Redigera bild och info</p>
              </div>
            </a>
            
            <a href="/settings?tab=account" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Inställningar</p>
                <p className="text-xs text-aifm-charcoal/40">Konto och säkerhet</p>
              </div>
            </a>
            
            <a href="/settings?tab=security" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-aifm-charcoal/70 hover:bg-gray-50 hover:text-aifm-charcoal transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-aifm-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Byt lösenord</p>
                <p className="text-xs text-aifm-charcoal/40">Uppdatera lösenord</p>
              </div>
            </a>
          </div>
          
          {/* Logout */}
          <div className="p-2 border-t border-gray-100">
            <a href="/auth/logout" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <p className="font-medium">Logga ut</p>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

