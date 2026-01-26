'use client';

import { useState, useCallback } from 'react';
import { 
  MoreHorizontal, Plus, Building2, User, Calendar as CalendarIcon, 
  DollarSign, ChevronRight, GripVertical 
} from 'lucide-react';
import type { Deal, DealStage, PipelineStageConfig } from '@/lib/crm/types';
import { DEFAULT_PIPELINE_STAGES } from '@/lib/crm/types';

interface DealKanbanProps {
  deals: Deal[];
  onStageChange: (dealId: string, newStage: DealStage) => Promise<void>;
  onDealClick: (deal: Deal) => void;
  onCreateDeal: (stage: DealStage) => void;
}

export function DealKanban({ deals, onStageChange, onDealClick, onCreateDeal }: DealKanbanProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  const dealsByStage = DEFAULT_PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(d => d.stage === stage.id);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  const getStageValue = (stage: DealStage) => {
    return dealsByStage[stage].reduce((sum, d) => sum + (d.value || 0), 0);
  };

  const handleDragStart = useCallback((e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', deal.id);
    
    // Add drag styling
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedDeal(null);
    setDragOverStage(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (!draggedDeal || draggedDeal.stage === stage) return;
    
    await onStageChange(draggedDeal.id, stage);
    setDraggedDeal(null);
  }, [draggedDeal, onStageChange]);

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 px-4 sm:px-6 lg:px-8 snap-x snap-mandatory md:snap-none -mx-4 sm:mx-0">
      {DEFAULT_PIPELINE_STAGES.map((stage) => (
        <div
          key={stage.id}
          className={`flex-shrink-0 w-[280px] sm:w-[300px] md:w-[320px] bg-gray-100/80 rounded-xl flex flex-col transition-all snap-start ${
            dragOverStage === stage.id 
              ? 'ring-2 ring-[#c0a280] bg-[#c0a280]/5' 
              : ''
          }`}
          onDragOver={(e) => handleDragOver(e, stage.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          {/* Stage Header */}
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">
                  {dealsByStage[stage.id].length}
                </span>
              </div>
              <button
                onClick={() => onCreateDeal(stage.id)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-gray-600">
              {getStageValue(stage.id).toLocaleString('sv-SE')} SEK
            </div>
          </div>

          {/* Deals */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh] sm:max-h-[calc(100vh-320px)]">
            {dealsByStage[stage.id].map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                stage={stage}
                onClick={() => onDealClick(deal)}
                onDragStart={(e) => handleDragStart(e, deal)}
                onDragEnd={handleDragEnd}
              />
            ))}
            
            {dealsByStage[stage.id].length === 0 && (
              <div className="py-8 px-4 text-center text-sm text-gray-400">
                Inga affärer
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface DealCardProps {
  deal: Deal;
  stage: PipelineStageConfig;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

function DealCard({ deal, stage, onClick, onDragStart, onDragEnd }: DealCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group"
    >
      {/* Drag Handle + Title */}
      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate text-sm">
            {deal.name}
          </h4>
          {deal.crmCompanyName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{deal.crmCompanyName}</span>
            </div>
          )}
        </div>
        <button className="p-1 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Value */}
      {deal.value && (
        <div className="flex items-center gap-1 text-sm font-semibold mb-2" style={{ color: stage.color }}>
          <DollarSign className="w-3.5 h-3.5" />
          {deal.value.toLocaleString('sv-SE')} {deal.currency || 'SEK'}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {deal.primaryContactName && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{deal.primaryContactName}</span>
            </div>
          )}
        </div>
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <CalendarIcon className="w-3 h-3" />
            {new Date(deal.expectedCloseDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>

      {/* Priority indicator */}
      {deal.priority === 'high' && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-bl-lg rounded-tr-lg" />
      )}
    </div>
  );
}

