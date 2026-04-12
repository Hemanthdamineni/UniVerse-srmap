import React from 'react';
import { cn } from '../../lib/utils';

interface DeadlineCountdownProps {
  deadline?: string;
  className?: string;
}

const DeadlineCountdown: React.FC<DeadlineCountdownProps> = ({ deadline, className }) => {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let display = '';
  let colorClass = '';

  if (diffDays < 0) {
    display = 'Expired';
    colorClass = 'text-gray-500 bg-gray-100 border-gray-200';
  } else if (diffDays === 0) {
    display = '⚡ Today! Closes tonight';
    colorClass = 'text-red-800 bg-red-100 border-red-200 font-bold';
  } else if (diffDays < 3) {
    display = `⚡ ${diffDays} day${diffDays > 1 ? 's' : ''} left`;
    colorClass = 'text-red-700 bg-red-50 border-red-100 font-bold';
  } else if (diffDays < 7) {
    display = `Deadline in ${diffDays} days`;
    colorClass = 'text-orange-700 bg-orange-50 border-orange-100';
  } else if (diffDays < 14) {
    display = `Deadline in ${diffDays} days`;
    colorClass = 'text-yellow-700 bg-yellow-50 border-yellow-100';
  } else {
    display = `Deadline: ${deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    colorClass = 'text-gray-600 bg-gray-50 border-gray-100';
  }

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-[10px] sm:text-xs border whitespace-nowrap',
      colorClass,
      className
    )}>
      {display}
    </span>
  );
};

export default DeadlineCountdown;
