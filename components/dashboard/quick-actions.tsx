import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, FolderOpen } from "lucide-react";

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-10">
      <Link
        href="/capital-calls"
        className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
      >
        <ArrowUpRight className="w-4 h-4" />
        <span className="hidden sm:inline">Nytt kapitalanrop</span>
        <span className="sm:hidden">Kapitalanrop</span>
      </Link>
      <Link
        href="/distributions"
        className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
      >
        <ArrowDownRight className="w-4 h-4" />
        <span className="hidden sm:inline">Ny utdelning</span>
        <span className="sm:hidden">Utdelning</span>
      </Link>
      <Link
        href="/data-rooms"
        className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="hidden sm:inline">Öppna datarum</span>
        <span className="sm:hidden">Datarum</span>
      </Link>
    </div>
  );
}

