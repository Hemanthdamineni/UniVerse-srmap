import { useState, useEffect } from "react";

function Calendar({ onDateSelect }: { onDateSelect?: (date: Date) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const today = new Date();

  // Initialize with today's date
  useEffect(() => {
    onDateSelect?.(new Date());
  }, [onDateSelect]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="col-span-3 row-span-1 rounded-xl p-4" style={{ background: 'var(--comp-surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="btn-ghost min-h-0 p-1 rounded"
        >
          ←
        </button>
        <h2 className="card-title font-bold">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={() => navigateMonth(1)}
          className="btn-ghost min-h-0 p-1 rounded"
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day, index) => (
          <div key={index} className="text-center label-text p-1" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => (
          <div key={index} className="aspect-square">
            {date && (
              <button
                onClick={() => handleDateClick(date)}
                className={`w-full h-full text-xs rounded-lg flex flex-col items-center justify-center ${isToday(date)
                  ? 'font-bold ring-2'
                  : isSelected(date) && !isToday(date)
                    ? 'font-medium'
                    : 'cursor-pointer'
                  }`}
                style={{
                  background: isToday(date) ? 'var(--comp-accent)' : isSelected(date) ? 'var(--success)' : undefined,
                  color: (isToday(date) || isSelected(date)) ? '#fff' : 'var(--comp-text-primary)',
                  ringColor: isToday(date) ? 'var(--comp-surface)' : undefined,
                  transition: `all var(--transition-fast)`,
                }}
              >
                <span className="text-[10px] leading-none mb-0.5">
                  {dayNames[date.getDay()]}
                </span>
                <span className="text-sm font-medium leading-none">
                  {date.getDate()}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
