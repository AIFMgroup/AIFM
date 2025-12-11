"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, ChevronDown } from "lucide-react";

type Task = {
  id: string;
  title: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed";
};

const tasks: Task[] = [
  {
    id: "1",
    title: "Förbered Q4 styrelsemöte",
    dueDate: "2024-12-10",
    status: "in_progress",
  },
  {
    id: "2",
    title: "Utkast årsredovisning",
    dueDate: "2024-12-20",
    status: "pending",
  },
  {
    id: "3",
    title: "LP-möte uppföljning",
    dueDate: "2024-11-30",
    status: "completed",
  },
];

export function TasksSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "in_progress":
        return (
          <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-amber-500">
            <Clock className="w-3 h-3 text-white" />
          </div>
        );
      case "completed":
        return (
          <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return (
          <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-gray-200">
            <AlertCircle className="w-3 h-3 text-gray-400" />
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-aifm-charcoal/60" />
          </div>
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
            Uppgifter
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
        <div className="p-4 space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-xl transition-all duration-300 ${
                task.status === "completed"
                  ? "bg-gray-50/50"
                  : "bg-gray-50 hover:bg-gray-100/50"
              }`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(task.status)}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      task.status === "completed"
                        ? "text-aifm-charcoal/40 line-through"
                        : "text-aifm-charcoal"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-aifm-charcoal/40 mt-1">
                    {task.dueDate}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

