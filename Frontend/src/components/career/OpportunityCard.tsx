import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';
import type { CareerOpportunity } from '../../lib/careerApi';
import TypeBadge from './TypeBadge';
import DeadlineCountdown from './DeadlineCountdown';
import StipendChip from './StipendChip';
import ModeChip from './ModeChip';
import SourceBadge from './SourceBadge';
import { Bookmark, ExternalLink, Zap } from 'lucide-react';
import { Button } from '../button';
import { Link } from 'react-router-dom';

interface OpportunityCardProps {
  opportunity: CareerOpportunity;
  onBookmarkToggle?: (id: string) => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, onBookmarkToggle }) => {
  const {
    id, title, company, organizer, shortDescription, type, deadline,
    stipend, prize, isFree, mode, source, isBookmarked, skills,
    personalizedScore, skillMatch
  } = opportunity;

  return (
    <Card className="h-full flex flex-col transition-shadow relative overflow-hidden">
      {personalizedScore !== undefined && personalizedScore >= 70 && (
        <div className="absolute top-0 right-0 bg-[var(--comp-accent)] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1 z-10">
          <Zap className="h-3 w-3 fill-current" /> {personalizedScore}% Match
        </div>
      )}
      
      <CardHeader className="flex-row justify-between items-start pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={type} />
            <SourceBadge source={source} />
          </div>
          <Link to={`/career/opportunities/${id}`}>
            <CardTitle className="hover:text-[var(--comp-accent)] transition-colors line-clamp-2">
              {title}
            </CardTitle>
          </Link>
          <CardDescription className="font-medium">
            {company || organizer || 'University Opportunity'}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={isBookmarked ? 'text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--warning)_20%,transparent)]' : 'text-[var(--comp-text-muted)] hover:text-[var(--text-primary)]'}
          onClick={() => onBookmarkToggle?.(id)}
        >
          <Bookmark className={isBookmarked ? "h-5 w-5 fill-current" : "h-5 w-5"} />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        <p className="body-text line-clamp-3 mb-3">
          {shortDescription || 'No description provided.'}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {skills.slice(0, 3).map(skill => {
            const isMatched = skillMatch?.matched.some(s => s.toLowerCase() === skill.toLowerCase());
            return (
              <span 
                key={skill} 
                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                  isMatched 
                    ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_24%,transparent)] font-medium' 
                    : 'bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] border-[var(--comp-border)]'
                }`}
              >
                {skill}
              </span>
            );
          })}
          {skills.length > 3 && (
            <span className="text-[10px] text-[var(--comp-text-muted)] self-center">
              +{skills.length - 3} more
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DeadlineCountdown deadline={deadline} />
          <ModeChip mode={mode} />
          <StipendChip stipend={stipend} prize={prize} isFree={isFree} />
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t mt-auto flex justify-between gap-2">
        <Link to={`/career/opportunities/${id}`} className="flex-1">
          <Button variant="outline" className="w-full h-8 text-xs">
            Details
          </Button>
        </Link>
        <a 
          href={opportunity.applyUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button className="w-full h-8 text-xs">
            Apply <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
};

export default OpportunityCard;
