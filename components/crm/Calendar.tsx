'use client';

import { useState, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, 
  User, Building2, Video, Phone as PhoneIcon
} from 'lucide-react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isSameDay, 
  isToday, addMonths, subMonths, addWeeks, subWeeks,
  startOfDay, addDays, parseISO, differenceInMinutes
} from 'date-fns';
import { sv } from 'date-fns/locale';
import type { Activity, Task, CalendarEvent } from '@/lib/crm/types';

type CalendarView = 'month' | 'week' | 'day';

interface CrmCalendarProps {
  activities: Activity[];
  tasks: Task[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateActivity: (date: Date, startTime?: string) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => Promise<void>;
}

export function CrmCalendar({ 
  activities, 
  tasks, 
  onEventClick, 
  onCreateActivity,
  onEventDrop 
}: CrmCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  // Convert activities and tasks to calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    const eventList: CalendarEvent[] = [];

    // Add activities
    for (const activity of activities) {
      if (!activity.startTime) continue;
      
      const start = parseISO(activity.startTime);
      const end = activity.endTime 
        ? parseISO(activity.endTime) 
        : addDays(start, activity.isAllDay ? 1 : 0);

      eventList.push({
        id: activity.id,
        title: activity.title,
        start,
        end,
        allDay: activity.isAllDay,
        color: activity.color || getActivityColor(activity.type),
        type: 'activity',
        entityId: activity.id,
        description: activity.description,
        location: activity.location,
        contactName: activity.contactName,
        crmCompanyName: activity.crmCompanyName,
        dealName: activity.dealName,
        status: activity.status,
      });
    }

    // Add tasks with due dates
    for (const task of tasks) {
      if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') continue;
      
      const dueDate = parseISO(task.dueDate);
      const start = task.dueTime 
        ? parseISO(`${task.dueDate}T${task.dueTime}`)
        : startOfDay(dueDate);

      eventList.push({
        id: task.id,
        title: `📋 ${task.title}`,
        start,
        end: start,
        allDay: !task.dueTime,
        color: getTaskPriorityColor(task.priority),
        type: 'task',
        entityId: task.id,
        description: task.description,
        contactName: task.contactName,
        crmCompanyName: task.crmCompanyName,
        dealName: task.dealName,
        status: task.status,
      });
    }

    return eventList;
  }, [activities, tasks]);

  // Navigation
  const navigate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? addDays(currentDate, -1) : addDays(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour?: number) => {
    e.preventDefault();
    if (!draggedEvent) return;

    let newStart = date;
    if (hour !== undefined) {
      newStart = new Date(date);
      newStart.setHours(hour, 0, 0, 0);
    }

    const duration = differenceInMinutes(draggedEvent.end, draggedEvent.start);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    await onEventDrop(draggedEvent.id, newStart, newEnd);
    setDraggedEvent(null);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
          <h2 className="text-base sm:text-xl font-semibold text-gray-900">
            {format(currentDate, view === 'day' ? 'd MMMM yyyy' : 'MMMM yyyy', { locale: sv })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('prev')}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Idag
            </button>
            <button
              onClick={() => navigate('next')}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  view === v 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'month' ? 'M' : v === 'week' ? 'V' : 'D'}
                <span className="hidden sm:inline">{v === 'month' ? 'ånad' : v === 'week' ? 'ecka' : 'ag'}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => onCreateActivity(currentDate)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#2d2a26] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#3d3a36] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Ny aktivitet</span>
            <span className="sm:hidden">Ny</span>
          </button>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="flex-1 overflow-auto">
        {view === 'month' && (
          <MonthView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={onEventClick}
            onCreateActivity={onCreateActivity}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        )}
        {view === 'week' && (
          <WeekView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={onEventClick}
            onCreateActivity={onCreateActivity}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        )}
        {view === 'day' && (
          <DayView 
            currentDate={currentDate} 
            events={events} 
            onEventClick={onEventClick}
            onCreateActivity={onCreateActivity}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        )}
      </div>
    </div>
  );
}

// Month View Component
function MonthView({ 
  currentDate, 
  events, 
  onEventClick,
  onCreateActivity,
  onDragStart,
  onDrop
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateActivity: (date: Date) => void;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(e.start, day));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day, idx) => (
          <div key={day} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-medium text-gray-500">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const inCurrentMonth = isSameMonth(day, currentDate);
          
          return (
            <div
              key={idx}
              className={`min-h-[60px] sm:min-h-[120px] border-b border-r border-gray-100 p-1 sm:p-2 ${
                !inCurrentMonth ? 'bg-gray-50/50' : ''
              } ${isToday(day) ? 'bg-[#c0a280]/5' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, day)}
              onDoubleClick={() => onCreateActivity(day)}
            >
              {/* Day number */}
              <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${
                !inCurrentMonth ? 'text-gray-300' : 
                isToday(day) ? 'text-[#c0a280]' : 'text-gray-700'
              }`}>
                {format(day, 'd')}
              </div>

              {/* Events - show fewer on mobile */}
              <div className="space-y-0.5 sm:space-y-1">
                {dayEvents.slice(0, 3).map((event, index) => (
                  <div
                    key={event.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, event)}
                    onClick={() => onEventClick(event)}
                    className={[
                      'text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity',
                      index === 2 ? 'hidden sm:block' : '',
                    ].join(' ')}
                    style={{ 
                      backgroundColor: `${event.color}20`,
                      color: event.color,
                      borderLeft: `2px solid ${event.color}`
                    }}
                  >
                    <span className="hidden sm:inline">{!event.allDay && format(event.start, 'HH:mm')} </span>
                    {event.title}
                  </div>
                ))}
                {/* Overflow indicators: different thresholds for mobile vs desktop */}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] sm:hidden text-gray-400 px-1">
                    +{dayEvents.length - 2}
                  </div>
                )}
                {dayEvents.length > 3 && (
                  <div className="hidden sm:block text-xs text-gray-400 px-2">
                    +{dayEvents.length - 3} till
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week View Component
function WeekView({ 
  currentDate, 
  events, 
  onEventClick,
  onCreateActivity,
  onDragStart,
  onDrop
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateActivity: (date: Date, startTime?: string) => void;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter(e => {
      if (e.allDay) return false;
      return isSameDay(e.start, day) && e.start.getHours() === hour;
    });
  };

  const getAllDayEventsForDay = (day: Date) => {
    return events.filter(e => e.allDay && isSameDay(e.start, day));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="w-10 sm:w-16 flex-shrink-0" />
        {weekDays.map((day) => (
          <div 
            key={day.toISOString()} 
            className={`flex-1 py-2 sm:py-3 text-center border-l border-gray-100 ${
              isToday(day) ? 'bg-[#c0a280]/5' : ''
            }`}
          >
            <div className="text-xs sm:text-sm text-gray-500">
              <span className="hidden sm:inline">{format(day, 'EEE', { locale: sv })}</span>
              <span className="sm:hidden">{format(day, 'EEEEE', { locale: sv })}</span>
            </div>
            <div className={`text-sm sm:text-lg font-semibold ${isToday(day) ? 'text-[#c0a280]' : 'text-gray-900'}`}>
              {format(day, 'd')}
            </div>
            {/* All-day events */}
            <div className="px-1 space-y-1 mt-1">
              {getAllDayEventsForDay(day).map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="text-xs px-2 py-0.5 rounded truncate cursor-pointer"
                  style={{ backgroundColor: event.color, color: 'white' }}
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="flex h-12 sm:h-14 border-b border-gray-50">
              <div className="w-10 sm:w-16 flex-shrink-0 text-[10px] sm:text-xs text-gray-400 text-right pr-1 sm:pr-2 pt-1">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day) => {
                const hourEvents = getEventsForDayAndHour(day, hour);
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="flex-1 border-l border-gray-100 relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, day, hour)}
                    onDoubleClick={() => onCreateActivity(day, `${hour.toString().padStart(2, '0')}:00`)}
                  >
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, event)}
                        onClick={() => onEventClick(event)}
                        className="absolute left-0 right-0 mx-1 px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 overflow-hidden"
                        style={{ 
                          backgroundColor: event.color,
                          color: 'white',
                          top: `${(event.start.getMinutes() / 60) * 100}%`,
                          height: `${Math.max(((event.end.getTime() - event.start.getTime()) / 3600000) * 100, 25)}%`,
                          minHeight: '24px'
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="opacity-80">{format(event.start, 'HH:mm')}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Day View Component
function DayView({ 
  currentDate, 
  events, 
  onEventClick,
  onCreateActivity,
  onDragStart,
  onDrop
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateActivity: (date: Date, startTime?: string) => void;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = events.filter(e => isSameDay(e.start, currentDate));
  const allDayEvents = dayEvents.filter(e => e.allDay);
  const timedEvents = dayEvents.filter(e => !e.allDay);

  return (
    <div className="flex flex-col h-full">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-gray-200 p-3">
          <div className="text-xs font-medium text-gray-500 mb-2">Heldagshändelser</div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="px-3 py-1 rounded-full text-sm cursor-pointer"
                style={{ backgroundColor: event.color, color: 'white' }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        {hours.map((hour) => {
          const hourEvents = timedEvents.filter(e => e.start.getHours() === hour);
          
          return (
            <div 
              key={hour} 
              className="flex h-14 sm:h-16 border-b border-gray-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, currentDate, hour)}
              onDoubleClick={() => onCreateActivity(currentDate, `${hour.toString().padStart(2, '0')}:00`)}
            >
              <div className="w-12 sm:w-20 flex-shrink-0 text-xs sm:text-sm text-gray-400 text-right pr-2 sm:pr-4 pt-2">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 relative border-l border-gray-100">
                {hourEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, event)}
                    onClick={() => onEventClick(event)}
                    className="absolute px-2 sm:px-3 py-1 sm:py-2 rounded-lg cursor-pointer hover:opacity-90 shadow-sm overflow-hidden"
                    style={{
                      backgroundColor: event.color,
                      color: 'white',
                      left: `${idx * 10}%`,
                      right: '4px',
                      top: `${(event.start.getMinutes() / 60) * 100}%`,
                      height: `${Math.max(((event.end.getTime() - event.start.getTime()) / 3600000) * 56, 28)}px`,
                    }}
                  >
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="font-medium">{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                    </div>
                    <div className="font-semibold text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{event.title}</div>
                    {event.location && (
                      <div className="hidden sm:flex items-center gap-1 text-xs opacity-80 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper functions
function getActivityColor(type: Activity['type']): string {
  const colors = {
    meeting: '#3b82f6',
    call: '#22c55e',
    email: '#f59e0b',
    note: '#8b5cf6',
    task_completed: '#10b981',
  };
  return colors[type] || '#6b7280';
}

function getTaskPriorityColor(priority: Task['priority']): string {
  const colors = {
    low: '#94a3b8',
    medium: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
  };
  return colors[priority] || '#6b7280';
}

