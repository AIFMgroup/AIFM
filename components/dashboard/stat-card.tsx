"use client";

import { TrendingUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  isPrimary?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  trendPositive = true,
  isPrimary = false,
}: StatCardProps) {
  if (isPrimary) {
    return (
      <div
        className="relative group rounded-xl sm:rounded-2xl p-4 sm:p-6 
          transition-all duration-700 ease-out hover:-translate-y-1
          bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 
          text-white shadow-xl shadow-aifm-charcoal/20"
      >
        <div className="relative">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors duration-300 bg-white/10">
              {icon}
            </div>
          </div>
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-1 sm:mb-2 text-white/50">
            {title}
          </p>
          <p className="text-lg sm:text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group rounded-xl sm:rounded-2xl p-4 sm:p-6 
        transition-all duration-700 ease-out hover:-translate-y-1
        bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20"
    >
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors duration-300 bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10">
            {icon}
          </div>
          {trend && (
            <div
              className={`hidden sm:flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                trendPositive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              {trend}
            </div>
          )}
        </div>
        <p className="text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-1 sm:mb-2 text-aifm-charcoal/50">
          {title}
        </p>
        <p className="text-lg sm:text-2xl font-semibold tracking-tight text-aifm-charcoal">
          {value}
        </p>
      </div>
    </div>
  );
}






