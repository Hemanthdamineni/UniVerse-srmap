// Resume Builder: split-layout form (left) and preview (right) with CRUD for projects, skills, experience.
import React, { useState, useEffect } from 'react';
import { PageContainer } from '../../components/layout/PageLayouts';
import { SectionCard } from '../../components/ui/SectionCard';
import { Input } from '../../components/input';
import { Button } from '../../components/button';
import { Textarea } from '../../components/textarea';
import { useSession } from '../../hooks/useSession';
import { cn } from '../../lib/core/utils';
import { Plus, X, Edit3, Trash2, Download, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonalInfo {
  name: string;
  department: string;
  regNo: string;
  cgpa: number;
  email: string;
  phone: string;
  address: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string;
  link: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

interface WorkExperience {
  id: string;
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface ResumeData {
  personalInfo: PersonalInfo;
  projects: Project[];
  skills: Skill[];
  workExperience: WorkExperience[];
}

type SectionTab = 'personal' | 'projects' | 'skills' | 'experience';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generateId = () => Math.random().toString(36).substring(2, 10);

const DEFAULT_PERSONAL: PersonalInfo = {
  name: '',
  department: '',
  regNo: '',
  cgpa: 0,
  email: '',
  phone: '',
  address: '',
};

const emptyResume = (): ResumeData => ({
  personalInfo: { ...DEFAULT_PERSONAL },
  projects: [],
  skills: [],
  workExperience: [],
});

const PROFICIENCY_LEVELS: Skill['proficiency'][] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

const SECTION_TABS: { key: SectionTab; label: string }[] = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'projects', label: 'Projects' },
  { key: 'skills', label: 'Skills' },
  { key: 'experience', label: 'Experience' },
];

// ---------------------------------------------------------------------------
// Personal Info Panel
// ---------------------------------------------------------------------------

function PersonalPanel({
  info,
  onChange,
}: {
  info: PersonalInfo;
  onChange: <K extends keyof PersonalInfo>(field: K, value: PersonalInfo[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Full Name</label>
        <Input
          value={info.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Your full name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Department</label>
        <Input
          value={info.department}
          onChange={(e) => onChange('department', e.target.value)}
          placeholder="e.g. Computer Science"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Registration No.</label>
        <Input
          value={info.regNo}
          onChange={(e) => onChange('regNo', e.target.value)}
          placeholder="e.g. AP21110010001"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">CGPA</label>
        <Input
          type="number"
          value={info.cgpa || ''}
          onChange={(e) => onChange('cgpa', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          step="0.01"
          min="0"
          max="10"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Email</label>
        <Input
          type="email"
          value={info.email}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="you@university.edu.in"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Phone</label>
        <Input
          value={info.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="+91 98765 43210"
        />
      </div>
      <div className="md:col-span-2 space-y-2">
        <label className="text-sm font-medium text-[var(--comp-text-primary)]">Address</label>
        <Textarea
          value={info.address}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder="Your address"
          rows={2}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Form & List
// ---------------------------------------------------------------------------

const emptyProject = (): Project => ({
  id: generateId(),
  name: '',
  description: '',
  techStack: '',
  link: '',
});

function ProjectsPanel({
  projects,
  onUpdate,
}: {
  projects: Project[];
  onUpdate: (updated: Project[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project>(emptyProject());

  const startCreate = () => {
    const fresh = emptyProject();
    setDraft(fresh);
    setEditingId(fresh.id);
  };

  const startEdit = (p: Project) => {
    setDraft({ ...p });
    setEditingId(p.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyProject());
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const exists = projects.find((p) => p.id === draft.id);
    onUpdate(exists ? projects.map((p) => (p.id === draft.id ? draft : p)) : [...projects, draft]);
    cancelEdit();
  };

  const remove = (id: string) => onUpdate(projects.filter((p) => p.id !== id));

  return (
    <div className="space-y-4">
      {/* Active editor */}
      {editingId && (
        <div className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">
            {projects.find((p) => p.id === editingId) ? 'Edit Project' : 'New Project'}
          </h4>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Project name"
          />
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Brief description of the project"
            rows={2}
          />
          <Input
            value={draft.techStack}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, techStack: e.target.value })}
            placeholder="Tech stack (comma separated)"
          />
          <Input
            value={draft.link}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, link: e.target.value })}
            placeholder="Project link (GitHub / live demo)"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={!draft.name.trim()}>
              {projects.find((p) => p.id === editingId) ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {/* Existing projects */}
      {projects.length === 0 && !editingId ? (
        <div className="text-center py-8 text-sm text-[var(--comp-text-muted)]">
          No projects yet. Click "Add Project" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between rounded-lg border border-[var(--comp-border)] p-4"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[var(--comp-text-primary)] truncate">{p.name}</h4>
                {p.description && (
                  <p className="text-xs text-[var(--comp-text-secondary)] line-clamp-2">{p.description}</p>
                )}
                {p.techStack && (
                  <p className="text-xs text-[var(--comp-text-muted)]">
                    <span className="font-medium">Stack:</span> {p.techStack}
                  </p>
                )}
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--comp-accent)] hover:underline inline-block"
                  >
                    {p.link}
                  </a>
                )}
              </div>
              <div className="flex gap-1 ml-3 shrink-0">
                <button
                  onClick={() => startEdit(p)}
                  className="p-1.5 rounded-md text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)] hover:bg-[var(--comp-surface-hover)] transition-colors"
                  aria-label="Edit project"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="p-1.5 rounded-md text-[var(--comp-text-muted)] hover:text-[var(--error)] hover:bg-[var(--comp-surface-hover)] transition-colors"
                  aria-label="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!editingId && (
        <Button variant="outline" size="sm" onClick={startCreate} className="w-full">
          <Plus size={14} className="mr-1" /> Add Project
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills Panel
// ---------------------------------------------------------------------------

const emptySkill = (): Skill => ({
  id: generateId(),
  name: '',
  category: 'technical',
  proficiency: 'Intermediate',
});

function SkillsPanel({
  skills,
  onUpdate,
}: {
  skills: Skill[];
  onUpdate: (updated: Skill[]) => void;
}) {
  const [draft, setDraft] = useState<Skill>(emptySkill());
  const [editingId, setEditingId] = useState<string | null>(null);

  const startCreate = () => {
    const fresh = emptySkill();
    setDraft(fresh);
    setEditingId(fresh.id);
  };

  const startEdit = (s: Skill) => {
    setDraft({ ...s });
    setEditingId(s.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptySkill());
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const exists = skills.find((s) => s.id === draft.id);
    onUpdate(exists ? skills.map((s) => (s.id === draft.id ? draft : s)) : [...skills, draft]);
    cancelEdit();
  };

  const remove = (id: string) => onUpdate(skills.filter((s) => s.id !== id));

  const profColor = (level: Skill['proficiency']) => {
    switch (level) {
      case 'Beginner':
        return 'bg-[color-mix(in_srgb,var(--comp-accent)_12%,transparent)] text-[var(--comp-accent)]';
      case 'Intermediate':
        return 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]';
      case 'Advanced':
        return 'bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]';
      case 'Expert':
        return 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]';
    }
  };

  return (
    <div className="space-y-4">
      {editingId && (
        <div className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">
            {skills.find((s) => s.id === editingId) ? 'Edit Skill' : 'Add Skill'}
          </h4>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Skill name"
          />
          <Input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="Category (e.g. Frontend, Backend, Design)"
          />
          <div>
            <label className="text-xs font-medium text-[var(--comp-text-secondary)] mb-1 block">
              Proficiency
            </label>
            <div className="flex flex-wrap gap-2">
              {PROFICIENCY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setDraft({ ...draft, proficiency: level })}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    draft.proficiency === level
                      ? 'border-[var(--comp-accent)] bg-[var(--comp-accent)]/10 text-[var(--comp-accent)]'
                      : 'border-[var(--comp-border)] text-[var(--comp-text-muted)] hover:border-[var(--comp-accent)]'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={!draft.name.trim()}>
              {skills.find((s) => s.id === editingId) ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {skills.length === 0 && !editingId ? (
        <div className="text-center py-8 text-sm text-[var(--comp-text-muted)]">
          No skills added yet. Click "Add Skill" to get started.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <div
              key={s.id}
              className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--comp-border)] text-sm text-[var(--comp-text-primary)] hover:border-[var(--comp-accent)] transition-colors"
            >
              <span>{s.name}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', profColor(s.proficiency))}>
                {s.proficiency}
              </span>
              <button
                onClick={() => startEdit(s)}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)]"
                aria-label="Edit skill"
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={() => remove(s.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[var(--comp-text-muted)] hover:text-[var(--error)]"
                aria-label="Remove skill"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!editingId && (
        <Button variant="outline" size="sm" onClick={startCreate} className="w-full">
          <Plus size={14} className="mr-1" /> Add Skill
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work Experience Panel
// ---------------------------------------------------------------------------

const emptyExperience = (): WorkExperience => ({
  id: generateId(),
  company: '',
  role: '',
  duration: '',
  description: '',
});

function ExperiencePanel({
  experiences,
  onUpdate,
}: {
  experiences: WorkExperience[];
  onUpdate: (updated: WorkExperience[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkExperience>(emptyExperience());

  const startCreate = () => {
    const fresh = emptyExperience();
    setDraft(fresh);
    setEditingId(fresh.id);
  };

  const startEdit = (e: WorkExperience) => {
    setDraft({ ...e });
    setEditingId(e.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyExperience());
  };

  const saveDraft = () => {
    if (!draft.company.trim() || !draft.role.trim()) return;
    const exists = experiences.find((e) => e.id === draft.id);
    onUpdate(exists ? experiences.map((e) => (e.id === draft.id ? draft : e)) : [...experiences, draft]);
    cancelEdit();
  };

  const remove = (id: string) => onUpdate(experiences.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      {editingId && (
        <div className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">
            {experiences.find((e) => e.id === editingId) ? 'Edit Experience' : 'Add Experience'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              placeholder="Company / Organization"
            />
            <Input
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              placeholder="Role / Position"
            />
          </div>
          <Input
            value={draft.duration}
            onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
            placeholder="Duration (e.g. Jun 2024 - Aug 2024)"
          />
          <Textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe your responsibilities and achievements"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={!draft.company.trim() || !draft.role.trim()}>
              {experiences.find((e) => e.id === editingId) ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {experiences.length === 0 && !editingId ? (
        <div className="text-center py-8 text-sm text-[var(--comp-text-muted)]">
          No work experience yet. Click "Add Experience" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="flex items-start justify-between rounded-lg border border-[var(--comp-border)] p-4"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">{exp.role}</h4>
                  <span className="text-xs text-[var(--comp-text-muted)]">at {exp.company}</span>
                </div>
                {exp.duration && (
                  <p className="text-xs text-[var(--comp-text-muted)]">{exp.duration}</p>
                )}
                {exp.description && (
                  <p className="text-xs text-[var(--comp-text-secondary)] line-clamp-2">{exp.description}</p>
                )}
              </div>
              <div className="flex gap-1 ml-3 shrink-0">
                <button
                  onClick={() => startEdit(exp)}
                  className="p-1.5 rounded-md text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)] hover:bg-[var(--comp-surface-hover)] transition-colors"
                  aria-label="Edit experience"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => remove(exp.id)}
                  className="p-1.5 rounded-md text-[var(--comp-text-muted)] hover:text-[var(--error)] hover:bg-[var(--comp-surface-hover)] transition-colors"
                  aria-label="Delete experience"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!editingId && (
        <Button variant="outline" size="sm" onClick={startCreate} className="w-full">
          <Plus size={14} className="mr-1" /> Add Experience
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume Preview
// ---------------------------------------------------------------------------

function ResumePreview({ data }: { data: ResumeData }) {
  const { personalInfo, projects, skills, workExperience } = data;

  // Count entries for rating bar
  const filled = [personalInfo.name, personalInfo.email].filter(Boolean).length;
  const projectCount = Math.min(projects.length, 5);
  const skillCount = Math.min(skills.length, 10);
  const expCount = Math.min(workExperience.length, 5);
  const totalScore = Math.round(((filled + projectCount + skillCount + expCount) / 25) * 100);

  return (
    <div className="space-y-4">
      {/* Completion bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--comp-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--comp-accent)] transition-all duration-500"
            style={{ width: `${totalScore}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--comp-text-muted)] shrink-0">
          {totalScore}% complete
        </span>
      </div>

      {/* Header */}
      <div className="text-center pb-4 border-b border-[var(--comp-border)]">
        <h2 className="text-xl font-bold text-[var(--comp-text-primary)]">
          {personalInfo.name || 'Your Full Name'}
        </h2>
        <p className="text-sm text-[var(--comp-text-secondary)] mt-1">
          {personalInfo.department || 'Department'}
          {personalInfo.regNo && ` | ${personalInfo.regNo}`}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-[var(--comp-text-muted)]">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
        </div>
        {personalInfo.cgpa > 0 && (
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-medium bg-[color-mix(in_srgb,var(--comp-accent)_12%,transparent)] text-[var(--comp-accent)]">
            CGPA: {personalInfo.cgpa.toFixed(2)}
          </span>
        )}
      </div>

      {/* Projects Section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)] mb-2 flex items-center gap-1">
          <ChevronRight size={14} /> Projects
        </h3>
        {projects.length === 0 ? (
          <p className="text-xs text-[var(--comp-text-muted)] italic">No projects added</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id}>
                <h4 className="text-sm font-medium text-[var(--comp-text-primary)]">{p.name}</h4>
                {p.description && (
                  <p className="text-xs text-[var(--comp-text-secondary)] mt-0.5">{p.description}</p>
                )}
                {p.techStack && (
                  <p className="text-xs text-[var(--comp-text-muted)] mt-0.5">
                    <span className="font-medium">Tech:</span> {p.techStack}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)] mb-2 flex items-center gap-1">
          <ChevronRight size={14} /> Skills
        </h3>
        {skills.length === 0 ? (
          <p className="text-xs text-[var(--comp-text-muted)] italic">No skills added</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s.id}
                className="px-2 py-0.5 rounded text-xs border border-[var(--comp-border)] text-[var(--comp-text-secondary)]"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Experience Section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)] mb-2 flex items-center gap-1">
          <ChevronRight size={14} /> Experience
        </h3>
        {workExperience.length === 0 ? (
          <p className="text-xs text-[var(--comp-text-muted)] italic">No experience added</p>
        ) : (
          <div className="space-y-3">
            {workExperience.map((exp) => (
              <div key={exp.id}>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-sm font-medium text-[var(--comp-text-primary)]">{exp.role}</h4>
                  <span className="text-xs text-[var(--comp-text-muted)]">at {exp.company}</span>
                </div>
                {exp.duration && (
                  <p className="text-xs text-[var(--comp-text-muted)]">{exp.duration}</p>
                )}
                {exp.description && (
                  <p className="text-xs text-[var(--comp-text-secondary)] mt-0.5">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Education block */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)] mb-1 flex items-center gap-1">
          <ChevronRight size={14} /> Education
        </h3>
        <div className="text-xs space-y-0.5 text-[var(--comp-text-secondary)]">
          <p className="font-medium">{personalInfo.name || 'Student'} — {personalInfo.department || 'Department'}</p>
          {personalInfo.regNo && <p>Reg No: {personalInfo.regNo}</p>}
          {personalInfo.cgpa > 0 && <p>CGPA: {personalInfo.cgpa.toFixed(2)} / 10.00</p>}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Page Component
// ===========================================================================

const ResumeBuilder: React.FC = () => {
  const { profile: erpProfile } = useSession();
  const [resumeData, setResumeData] = useState<ResumeData>(emptyResume);
  const [activeTab, setActiveTab] = useState<SectionTab>('personal');
  const [isExporting, setIsExporting] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-fill from ERP profile on mount
  useEffect(() => {
    if (erpProfile) {
      setResumeData((prev) => ({
        ...prev,
        personalInfo: {
          ...prev.personalInfo,
          name: erpProfile.name || '',
          department: erpProfile.department || '',
          email: erpProfile.email || '',
          cgpa: erpProfile.cgpa || 0,
        },
      }));
    }
  }, [erpProfile]);

  // Persist to localStorage on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('resumeBuilderData', JSON.stringify(resumeData));
      } catch {
        // quota exceeded — silently ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [resumeData]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('resumeBuilderData');
      if (raw) {
        const parsed = JSON.parse(raw) as ResumeData;
        setResumeData(parsed);
      }
    } catch {
      // corrupted data — ignore
    }
  }, []);

  const handlePersonalChange = <K extends keyof PersonalInfo>(field: K, value: PersonalInfo[K]) => {
    setResumeData((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value },
    }));
  };

  const handleExport = () => {
    setIsExporting(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    try {
      const blob = new Blob([JSON.stringify(resumeData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume-${resumeData.personalInfo.name || 'untitled'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Resume Builder</h1>
          <p className="text-sm text-[var(--comp-text-muted)] mt-1">
            Fill in your details and see a live preview. Data is saved locally.
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} className="shrink-0">
          <Download size={16} className="mr-1.5" />
          {isExporting ? 'Exporting…' : saved ? 'Saved!' : 'Export JSON'}
        </Button>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- Left Sidebar (tabs & nav) ---- */}
        <div className="lg:col-span-1 space-y-4">
          <SectionCard title="Sections" description="Jump to a resume section">
            <nav className="space-y-1">
              {SECTION_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    activeTab === key
                      ? 'bg-[var(--comp-accent)]/10 text-[var(--comp-accent)]'
                      : 'text-[var(--comp-text-secondary)] hover:bg-[var(--comp-surface-hover)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          </SectionCard>

          <SectionCard title="Stats" description="Your resume at a glance">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--comp-text-muted)]">Projects</span>
                <span className="font-medium text-[var(--comp-text-primary)]">{resumeData.projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--comp-text-muted)]">Skills</span>
                <span className="font-medium text-[var(--comp-text-primary)]">{resumeData.skills.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--comp-text-muted)]">Experience</span>
                <span className="font-medium text-[var(--comp-text-primary)]">{resumeData.workExperience.length}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ---- Right Content (active section + preview) ---- */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'personal' && (
            <SectionCard title="Personal Information" description="Auto-filled from your profile. Edit freely.">
              <PersonalPanel info={resumeData.personalInfo} onChange={handlePersonalChange} />
            </SectionCard>
          )}

          {activeTab === 'projects' && (
            <SectionCard title="Projects" description="Add your academic and personal projects.">
              <ProjectsPanel
                projects={resumeData.projects}
                onUpdate={(updated) => setResumeData((prev) => ({ ...prev, projects: updated }))}
              />
            </SectionCard>
          )}

          {activeTab === 'skills' && (
            <SectionCard title="Skills" description="List your technical and professional skills.">
              <SkillsPanel
                skills={resumeData.skills}
                onUpdate={(updated) => setResumeData((prev) => ({ ...prev, skills: updated }))}
              />
            </SectionCard>
          )}

          {activeTab === 'experience' && (
            <SectionCard title="Work Experience" description="Include internships, jobs, and volunteer work.">
              <ExperiencePanel
                experiences={resumeData.workExperience}
                onUpdate={(updated) => setResumeData((prev) => ({ ...prev, workExperience: updated }))}
              />
            </SectionCard>
          )}

          <SectionCard title="Resume Preview" description="Live preview of your resume as you build it.">
            <ResumePreview data={resumeData} />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default ResumeBuilder;
