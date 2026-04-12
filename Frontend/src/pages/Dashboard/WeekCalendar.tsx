import { useState, useEffect } from "react";

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
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateWeek(-1)}
          className="hover:bg-gray-100 rounded-lg transition-colors"
        >
          ←
        </button>
        <h2 className="font-bold text-lg">
          {monthNames[midWeek.getMonth()]} {midWeek.getFullYear()}
        </h2>
        <button
          onClick={() => navigateWeek(1)}
          className="hover:bg-gray-100 rounded-lg transition-colors"
        >
          →
        </button>
      </div>

      {/* Week view */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((date, index) => (
          <div key={index} className="flex flex-col items-center space-y-1">
            {/* Day name */}
            <div className="text-xs font-medium text-gray-500 h-4">
              {dayNames[index]}
            </div>

            {/* Date button */}
            <button
              onClick={() => handleDateClick(date)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-sm font-medium ${isToday(date)
                ? 'bg-[#0A3035] text-white'
                : isSelected(date) && !isToday(date)
                  ? 'bg-green-500 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
                }`}
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
