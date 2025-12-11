"use client";

import Image from "next/image";

export function ChatButton() {
  return (
    <button className="fixed bottom-6 right-6 z-50 group">
      <div className="absolute inset-0 bg-white/40 rounded-full animate-ping" />
      <div
        className="absolute inset-0 bg-white/30 rounded-full animate-pulse"
        style={{ animationDelay: "0.5s" }}
      />
      <div className="relative w-16 h-16 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-full shadow-2xl shadow-aifm-charcoal/30 flex items-center justify-center group-hover:scale-110 group-hover:shadow-aifm-gold/20 transition-all duration-300 border-2 border-white/10">
        <Image
          alt="AIFM Assistant"
          width={40}
          height={40}
          className="rounded-full object-cover"
          src="/Maskots/maskot7.png"
        />
      </div>
      <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="bg-aifm-charcoal text-white text-sm px-4 py-2 rounded-xl shadow-xl whitespace-nowrap">
          Behöver du hjälp?
          <div className="absolute top-full right-6 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-aifm-charcoal" />
        </div>
      </div>
    </button>
  );
}

