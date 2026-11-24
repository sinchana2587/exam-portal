import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  Lock,
  PlayCircle,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || 'Unknown').trim();

  let toneClasses =
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let Icon = FileEdit;

  if (
    [
      'Active',
      'Verified',
      'Completed',
      'Exam Completed',
      'Ready',
      'Released',
      'Approved & Recalculated',
      'Pass',
      'PASS',
      'Present',
      'Published',
    ].includes(normalized)
  ) {
    toneClasses =
      'bg-[#16834A]/10 text-[#16834A] border-[#16834A]/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    Icon = CheckCircle2;
  } else if (
    ['Scheduled', 'In Progress', 'Submitted'].includes(normalized)
  ) {
    toneClasses =
      'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    Icon = normalized === 'In Progress' ? PlayCircle : Send;
  } else if (
    ['Frozen by COE'].includes(normalized)
  ) {
    toneClasses =
      'bg-[#6D5CE8]/10 text-[#6D5CE8] border-[#6D5CE8]/30 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30';
    Icon = Lock;
  } else if (
    [
      'Upcoming',
      'Awaiting COE Approval',
      'Correction Pending',
      'Pending COE Review',
      'Flagged',
      'Not Ready',
      'Superseded',
      'Replaced',
      'Archived',
    ].includes(normalized)
  ) {
    toneClasses =
      'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    Icon = normalized === 'Correction Pending' || normalized === 'Pending COE Review' ? ShieldAlert : Clock;
  } else if (
    [
      'Rejected',
      'Cancelled',
      'Issue',
      'Fail',
      'FAIL',
      'Inactive',
    ].includes(normalized)
  ) {
    toneClasses =
      'bg-[#B42318]/10 text-[#B42318] border-[#B42318]/30 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30';
    Icon = normalized === 'Inactive' ? AlertCircle : XCircle;
  } else if (['Absent', 'ABSENT'].includes(normalized)) {
    // Absent is distinctly styled in neutral-amber-slate and NOT automatically classified as Fail
    toneClasses =
      'bg-slate-200/80 text-slate-700 border-slate-400/50 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600';
    Icon = AlertCircle;
  }

  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border whitespace-nowrap shrink-0 ${padding} ${toneClasses}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{normalized}</span>
    </span>
  );
};
