"use client";

import { useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";

type Transaction = {
  id: string;
  title: string;
  type: string;
  amount: string;
  isPositive: boolean;
};

const transactions: Transaction[] = [
  {
    id: "1",
    title: "Såddfinansiering NyVenture",
    type: "Investering",
    amount: "1.3M EUR",
    isPositive: false,
  },
  {
    id: "2",
    title: "Tech Summit 2025",
    type: "Utgift",
    amount: "150K SEK",
    isPositive: false,
  },
  {
    id: "3",
    title: "Q3 Utdelning",
    type: "Utdelning",
    amount: "2.5M SEK",
    isPositive: true,
  },
];

export function TransactionsSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
            <Wallet className="w-4 h-4 text-aifm-charcoal/60" />
          </div>
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
            Transaktioner
          </h2>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-aifm-charcoal/40 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="divide-y divide-gray-50">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      transaction.isPositive
                        ? "bg-emerald-500"
                        : "bg-aifm-charcoal/30"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-aifm-charcoal truncate max-w-[140px]">
                      {transaction.title}
                    </p>
                    <p className="text-xs text-aifm-charcoal/40">
                      {transaction.type}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    transaction.isPositive
                      ? "text-emerald-600"
                      : "text-aifm-charcoal"
                  }`}
                >
                  {transaction.isPositive ? "+" : "-"}
                  {transaction.amount}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

