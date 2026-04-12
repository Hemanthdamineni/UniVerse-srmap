import React from 'react';
import { cn } from '../../lib/utils';

interface TypeBadgeProps {
  type: 'job' | 'internship' | 'hackathon' | 'competition' | 'fellowship' | 'workshop';
  className?: string;
}

const typeStyles = {
  job: 'bg-blue-100 text-blue-800 border-blue-200',
  internship: 'bg-green-100 text-green-800 border-green-200',
  hackathon: 'bg-purple-100 text-purple-800 border-purple-200',
  competition: 'bg-orange-100 text-orange-800 border-orange-200',
  fellowship: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  workshop: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className }) => {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
      typeStyles[type] || 'bg-gray-100 text-gray-800 border-gray-200',
      className
    )}>
      {type}
    </span>
  );
};

export default TypeBadge;
