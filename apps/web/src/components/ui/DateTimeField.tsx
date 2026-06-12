import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  addDays, addWeeks, addMonths,
  roundToQuarter, getCalendarDays,
  formatDateShort, toDatetimeLocal, fromDatetimeLocal,
  isSameDay, DAY_NAMES_SHORT_FR, MONTH_NAMES_FR,
} from '../../lib/dateUtils';

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  showPresets?: boolean;
  showTime?: boolean;
  minDate?: string;
  disabled?: boolean;
}

export function DateTimeField({
  value,
  onChange,
  showPresets = true,
  showTime = true,
  minDate,
  disabled = false,
}: DateTimeFieldProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const currentDate = value ? fromDatetimeLocal(value) : null;
  const today = new Date();

  // Calendar navigation state
  const [viewYear, setViewYear] = useState(() => currentDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => currentDate?.getMonth() ?? today.getMonth());

  // Sync calendar view when value changes externally
  useEffect(() => {
    if (currentDate) {
      setViewYear(currentDate.getFullYear());
      setViewMonth(currentDate.getMonth());
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside to close calendar
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        calendarRef.current && !calendarRef.current.contains(e.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  const openCalendar = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCalendarPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsCalendarOpen(true);
  }, []);

  // Après rendu du calendrier : le repositionner vers le haut si débordement
  useLayoutEffect(() => {
    if (!isCalendarOpen || !calendarRef.current || !buttonRef.current) return;
    const cal = calendarRef.current.getBoundingClientRect();
    const btn = buttonRef.current.getBoundingClientRect();
    if (cal.bottom > window.innerHeight - 8) {
      setCalendarPos({ top: btn.top - cal.height - 4, left: btn.left });
    }
  }, [isCalendarOpen]);

  // --- Helpers ---

  const setDate = useCallback((date: Date) => {
    onChange(toDatetimeLocal(date));
  }, [onChange]);

  const setDateKeepTime = useCallback((newDate: Date) => {
    if (currentDate) {
      newDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
    }
    onChange(toDatetimeLocal(newDate));
    setIsCalendarOpen(false);
  }, [currentDate, onChange]);

  const clear = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleHourChange = useCallback((hour: number) => {
    const d = currentDate ? new Date(currentDate) : roundToQuarter(new Date());
    d.setHours(hour);
    onChange(toDatetimeLocal(d));
  }, [currentDate, onChange]);

  const handleMinuteChange = useCallback((minute: number) => {
    const d = currentDate ? new Date(currentDate) : roundToQuarter(new Date());
    d.setMinutes(minute, 0, 0);
    onChange(toDatetimeLocal(d));
  }, [currentDate, onChange]);

  // --- Presets ---

  const presets = [
    { label: "Aujourd'hui", getDate: () => showTime ? roundToQuarter(new Date()) : new Date() },
    { label: 'Demain', getDate: () => showTime ? roundToQuarter(addDays(new Date(), 1)) : addDays(new Date(), 1) },
    { label: '+1 sem.', getDate: () => showTime ? roundToQuarter(addWeeks(new Date(), 1)) : addWeeks(new Date(), 1) },
    { label: '+1 mois', getDate: () => showTime ? roundToQuarter(addMonths(new Date(), 1)) : addMonths(new Date(), 1) },
  ];

  // --- Calendar navigation ---

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const calendarDays = getCalendarDays(viewYear, viewMonth);
  const minDateObj = minDate ? fromDatetimeLocal(minDate) : null;

  const isDayDisabled = (day: Date): boolean => {
    if (!minDateObj) return false;
    // Compare date only (ignore time)
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const minStart = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());
    return dayStart < minStart;
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => setDate(preset.getDate())}
              className="px-2 py-1 text-xs rounded-md border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={clear}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              title="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Date + Time display */}
      <div className="flex items-center gap-2">
        {/* Date button */}
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => isCalendarOpen ? setIsCalendarOpen(false) : openCalendar()}
          className={`flex items-center gap-2 h-9 px-3 text-sm rounded-md border border-input bg-transparent shadow-sm transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed ${
            isCalendarOpen ? 'ring-1 ring-ring' : ''
          }`}
        >
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className={currentDate ? 'text-foreground' : 'text-muted-foreground'}>
            {currentDate ? formatDateShort(currentDate) : 'Choisir une date'}
          </span>
        </button>

        {/* Time selectors */}
        {showTime && currentDate && (
          <div className="flex items-center gap-1">
            <select
              value={currentDate.getHours()}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              disabled={disabled}
              className="h-9 px-2 text-sm rounded-md border border-input bg-transparent shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 appearance-none text-center w-14"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-muted-foreground font-medium">:</span>
            <select
              value={currentDate.getMinutes()}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              disabled={disabled}
              className="h-9 px-2 text-sm rounded-md border border-input bg-transparent shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 appearance-none text-center w-14"
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear button (when no presets shown) */}
        {!showPresets && value && (
          <button
            type="button"
            disabled={disabled}
            onClick={clear}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            title="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Calendar dropdown — portail pour échapper overflow/z-index de la modale */}
      {isCalendarOpen && createPortal(
        <div
          ref={calendarRef}
          style={{ top: calendarPos.top, left: calendarPos.left }}
          className="fixed z-[9999] p-3 bg-background border border-border rounded-lg shadow-lg w-[280px]"
        >
          {/* Header: month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium capitalize">
              {MONTH_NAMES_FR[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES_SHORT_FR.map((name, i) => (
              <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                {name}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isSelected = currentDate && isSameDay(day, currentDate);
              const isToday = isSameDay(day, today);
              const isDisabled = isDayDisabled(day);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setDateKeepTime(new Date(day))}
                  className={`w-9 h-9 text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : isToday
                        ? 'border border-primary text-primary font-medium'
                        : isCurrentMonth
                          ? 'hover:bg-muted text-foreground'
                          : 'text-muted-foreground/40 hover:bg-muted/50'
                  } ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
