import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekCalendarProps {
  onDateSelect?: (date: Date) => void;
}

function WeekCalendar({ onDateSelect }: WeekCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));

  // Initialize with today's date
  useEffect(() => {
    onDateSelect?.(new Date());
  }, [onDateSelect]);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday is 0
    return new Date(d.setDate(diff));
  }

  function getWeekDays(weekStart: Date): Date[] {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }

  const navigateWeek = (direction: number) => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    setCurrentWeekStart(newWeekStart);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const weekDays = getWeekDays(currentWeekStart);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Get the month and year for display (use the middle of the week)
  const midWeek = new Date(currentWeekStart);
  midWeek.setDate(currentWeekStart.getDate() + 3);

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateWeek(-1)}
          className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="card-title font-semibold">
          {monthNames[midWeek.getMonth()]} {midWeek.getFullYear()}
        </h2>
        <button
          onClick={() => navigateWeek(1)}
          className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Week view */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((date, index) => (
          <div key={index} className="flex flex-col items-center space-y-1">
            {/* Day name */}
            <div className="label-text">
              {dayNames[index]}
            </div>

            {/* Date button */}
            <button
              onClick={() => handleDateClick(date)}
              className={`flex h-10 w-full max-w-11 items-center justify-center rounded-lg text-sm font-medium ${isToday(date)
                ? 'text-white'
                : isSelected(date) && !isToday(date)
                  ? 'text-white'
                  : ''
                }`}
              style={{
                background: isToday(date) ? 'var(--comp-accent)' : isSelected(date) ? 'var(--success)' : undefined,
                color: isToday(date) ? 'var(--on-accent)' : isSelected(date) ? 'var(--on-success)' : 'var(--comp-text-primary)',
                transition: `all var(--transition-fast)`,
              }}
            >
              {date.getDate()}
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default WeekCalendar;
