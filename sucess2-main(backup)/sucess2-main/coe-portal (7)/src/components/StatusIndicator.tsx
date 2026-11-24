import React from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  FileCheck,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export type SemanticTone =
  | 'draft'
  | 'submitted'
  | 'frozen'
  | 'transfer'
  | 'verified'
  | 'rejected'
  | 'pending'
  | 'approved'
  | 'retired'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface StatusIndicatorProps {
  status?: string;
  label?: string;
  tone?: SemanticTone;
  className?: string;
}

function inferTone(status: string): SemanticTone {
  const s = status.toLowerCase();
  if (
    s.includes('frozen') ||
    s.includes('finalized') ||
    s.includes('encrypted') ||
    s.includes('signed')
  ) {
    return 'frozen';
  }
  if (
    s.includes('approved') ||
    s.includes('released') ||
    s.includes('ready for examination') ||
    s.includes('exam completed') ||
    s.includes('completed')
  ) {
    return 'approved';
  }
  if (
    s.includes('verified') ||
    s.includes('eligible') ||
    s.includes('active') ||
    s.includes('available') ||
    s.includes('generated') ||
    s.includes('prepared') ||
    s.includes('present') ||
    s.includes('pass') ||
    s.includes('connected') ||
    s.includes('logged in') ||
    s.includes('published by hod') ||
    s.includes('unlocked')
  ) {
    return 'verified';
  }
  if (
    s.includes('scheduled') ||
    s.includes('transferred') ||
    s.includes('transferring') ||
    s.includes('preparing') ||
    s.includes('received') ||
    s.includes('selected') ||
    s.includes('submitted') ||
    s.includes('ready') ||
    s.includes('in progress') ||
    s === 'imported'
  ) {
    return 'transfer';
  }
  if (
    s.includes('pending') ||
    s.includes('awaiting approval') ||
    s.includes('warning') ||
    s.includes('awaiting') ||
    s.includes('not started')
  ) {
    return 'pending';
  }
  if (
    s.includes('rejected') ||
    s.includes('correction pending') ||
    s.includes('transfer failed') ||
    s.includes('not eligible') ||
    s.includes('fail') ||
    s.includes('error') ||
    s.includes('absent') ||
    s.includes('locked') ||
    s.includes('disconnected') ||
    s.includes('not published') ||
    s.includes('blocked') ||
    s.includes('cancelled')
  ) {
    return 'rejected';
  }
  if (
    s.includes('not prepared') ||
    s.includes('not sent') ||
    s.includes('not imported')
  ) {
    return 'retired';
  }
  return 'draft';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  tone,
  className = '',
}) => {
  const textToShow = label || status || '';
  const resolvedTone = tone || inferTone(textToShow);

  const toneConfig: Record<
    SemanticTone,
    { textClass: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    draft: {
      textClass: 'text-[#64748B] dark:text-slate-400',
      Icon: Clock,
    },
    neutral: {
      textClass: 'text-[#64748B] dark:text-slate-400',
      Icon: Clock,
    },
    submitted: {
      textClass: 'text-[#2563EB] dark:text-blue-400',
      Icon: FileCheck,
    },
    info: {
      textClass: 'text-[#2563EB] dark:text-blue-400',
      Icon: FileCheck,
    },
    frozen: {
      textClass: 'text-[#6D5CE8] dark:text-violet-400',
      Icon: Lock,
    },
    transfer: {
      textClass: 'text-[#2563EB] dark:text-blue-400',
      Icon: Send,
    },
    verified: {
      textClass: 'text-[#16834A] dark:text-emerald-400',
      Icon: ShieldCheck,
    },
    success: {
      textClass: 'text-[#16834A] dark:text-emerald-400',
      Icon: CheckCircle2,
    },
    approved: {
      textClass: 'text-[#16834A] dark:text-emerald-400',
      Icon: CheckCircle2,
    },
    pending: {
      textClass: 'text-[#B7791F] dark:text-amber-400',
      Icon: AlertTriangle,
    },
    warning: {
      textClass: 'text-[#B7791F] dark:text-amber-400',
      Icon: AlertTriangle,
    },
    rejected: {
      textClass: 'text-[#B42318] dark:text-red-400',
      Icon: ShieldAlert,
    },
    danger: {
      textClass: 'text-[#B42318] dark:text-red-400',
      Icon: ShieldAlert,
    },
    retired: {
      textClass: 'text-[#64748B] dark:text-slate-400',
      Icon: Archive,
    },
  };

  const { textClass, Icon } = toneConfig[resolvedTone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap shrink-0 ${textClass} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{textToShow}</span>
    </span>
  );
};
