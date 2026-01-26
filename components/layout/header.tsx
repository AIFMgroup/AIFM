"use client";

import { useState } from "react";
import { Bell, Building2, ChevronDown, Menu, X } from "lucide-react";

type Company = {
  name: string;
  orgNumber: string;
  color: string;
};

const companies: Company[] = [
  { name: "Nordic Ventures I", orgNumber: "559123-4567", color: "#c0a280" },
  { name: "Nordic Ventures II", orgNumber: "559234-5678", color: "#6f1823" },
];

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [selectedCompany, setSelectedCompany] = useState(companies[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="px-3 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-aifm-charcoal/70 hover:text-aifm-charcoal hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Spacer for desktop */}
          <div className="hidden lg:block w-10" />

          {/* Company Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/50 hover:shadow-lg hover:shadow-aifm-gold/10 transition-all duration-300 group"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${selectedCompany.color}15` }}
              >
                <Building2
                  className="w-4 h-4"
                  style={{ color: selectedCompany.color }}
                />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-aifm-charcoal">
                  {selectedCompany.name}
                </p>
                <p className="text-xs text-aifm-charcoal/50">
                  {selectedCompany.orgNumber}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-aifm-gold animate-bounce" />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                {companies.map((company) => (
                  <button
                    key={company.orgNumber}
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedCompany.orgNumber === company.orgNumber
                        ? "bg-aifm-gold/5"
                        : ""
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${company.color}15` }}
                    >
                      <Building2
                        className="w-4 h-4"
                        style={{ color: company.color }}
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-aifm-charcoal">
                        {company.name}
                      </p>
                      <p className="text-xs text-aifm-charcoal/50">
                        {company.orgNumber}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl transition-all duration-200 text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/5"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}






