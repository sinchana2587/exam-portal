/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface DualModeDobInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Generates an array of years suitable for student DOB (e.g., 1990 to 2012)
const YEARS = Array.from({ length: 23 }, (_, i) => 1990 + i);

export const DualModeDobInput: React.FC<DualModeDobInputProps> = ({
  id = 'student-dob',
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  hasError = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing valid date if present, or default to June 2005
  const initialDate = (() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      if (y >= 1990 && y <= 2026 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { year: y, month: m - 1, day: d };
      }
    }
    return { year: 2005, month: 5, day: 15 };
  })();

  const [currentYear, setCurrentYear] = useState<number>(initialDate.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.month);

  // Sync calendar view if a valid YYYY-MM-DD is typed
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      if (y >= 1990 && y <= 2026 && m >= 1 && m <= 12) {
        setCurrentYear(y);
        setCurrentMonth(m - 1);
      }
    }
  }, [value]);

  // Handle outside clicks to close picker
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => Math.max(1990, y - 1));
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => Math.min(2020, y + 1));
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const formatted = `${currentYear}-${mm}-${dd}`;
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Dual-Mode Input Field: Supports direct manual text typing AND calendar picker */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`h-[43px] w-full pl-3.5 pr-10 rounded-[6px] border text-sm font-mono bg-white text-[#243247] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2463B5] focus:border-[#2463B5] transition-colors duration-150 ${
            hasError ? 'border-[#B42318]' : 'border-[#CBD5E1]'
          }`}
        />

        {/* Calendar Trigger Icon Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
          title="Open Date Picker Calendar"
          className="absolute right-2.5 p-1 rounded-[6px] text-[#64748B] hover:text-[#2463B5] hover:bg-[#F7F9FC] transition-colors duration-150 cursor-pointer"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Custom Date Picker Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-[100] w-full max-w-[300px] bg-white rounded-[10px] shadow-[0_16px_36px_rgba(16,42,67,0.22)] border border-[#CBD5E1] p-3.5 text-[#243247] animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month & Year Selectors */}
          <div className="flex items-center justify-between gap-1 pb-3 border-b border-[#DCE3EC]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-[6px] hover:bg-[#F7F9FC] text-[#64748B] transition-colors duration-150 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-[#102A43]">
              {/* Month Dropdown */}
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="bg-[#F7F9FC] border border-[#CBD5E1] rounded-[6px] px-1.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#2463B5]"
              >
                {MONTHS.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="bg-[#F7F9FC] border border-[#CBD5E1] rounded-[6px] px-1.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#2463B5]"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-[6px] hover:bg-[#F7F9FC] text-[#64748B] transition-colors duration-150 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 ml-1 text-[#64748B] hover:text-[#102A43] cursor-pointer"
                title="Close Calendar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center text-[11px] font-bold text-[#64748B]">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid Days */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const formattedMatch = `${currentYear}-${String(
                currentMonth + 1
              ).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === formattedMatch;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto rounded-[6px] flex items-center justify-center font-medium transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#2463B5] text-white font-bold'
                      : 'hover:bg-[#F7F9FC] text-[#243247]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer quick helper */}
          <div className="pt-3 mt-2 border-t border-[#DCE3EC] flex items-center justify-between text-[11px] text-[#64748B]">
            <span>Click date to select</span>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-[#2463B5] hover:underline cursor-pointer font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

