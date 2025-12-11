"use client";

import { useState } from "react";
import { PieChart, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";

type PortfolioItem = {
  name: string;
  percentage: number;
  value: string;
  color: string;
};

const portfolioData: PortfolioItem[] = [
  { name: "SaaS", percentage: 35, value: "45.0M SEK", color: "#c0a280" },
  { name: "DeepTech", percentage: 25, value: "32.0M SEK", color: "#615c59" },
  { name: "AI", percentage: 20, value: "26.0M SEK", color: "#94a3b8" },
  { name: "FinTech", percentage: 20, value: "25.5M SEK", color: "#cbd5e1" },
];

export function PortfolioChart() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const totalValue = "128.5M SEK";

  // Calculate SVG circle segments
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
            <PieChart className="w-4 h-4 text-aifm-charcoal/60" />
          </div>
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
            Portföljfördelning
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portfolio"
            className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Detaljer
            <ChevronRight className="w-3 h-3" />
          </Link>
          <ChevronDown
            className={`w-5 h-5 text-aifm-charcoal/40 transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Pie Chart */}
            <div className="relative w-48 h-48 lg:w-56 lg:h-56 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {portfolioData.map((item, index) => {
                  const dashLength = (item.percentage / 100) * circumference;
                  const offset = -cumulativeOffset;
                  cumulativeOffset += dashLength;

                  return (
                    <circle
                      key={item.name}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={hoveredIndex === index ? 12 : 10}
                      strokeDasharray={`${dashLength} ${circumference}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{
                        filter:
                          hoveredIndex === index
                            ? "drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                            : "none",
                      }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-semibold text-aifm-charcoal">
                    {totalValue}
                  </p>
                  <p className="text-xs text-aifm-charcoal/50 mt-0.5">Totalt</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full space-y-2">
              {portfolioData.map((item, index) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-300 ${
                    hoveredIndex === index ? "bg-gray-100" : "hover:bg-gray-50/50"
                  }`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full transition-transform duration-300"
                      style={{
                        backgroundColor: item.color,
                        transform:
                          hoveredIndex === index ? "scale(1.3)" : "scale(1)",
                      }}
                    />
                    <span className="text-sm font-medium text-aifm-charcoal">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-aifm-charcoal">
                      {item.percentage}%
                    </span>
                    <span className="text-xs text-aifm-charcoal/40 ml-2">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

