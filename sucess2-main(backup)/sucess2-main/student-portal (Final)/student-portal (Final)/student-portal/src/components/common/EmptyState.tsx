/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, FileQuestion, FolderOpen, Inbox, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      role="status"
      className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center space-y-3 bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow ${className}`}
    >
      <div className="w-12 h-12 rounded-[10px] bg-slate-100 border border-[#CBD5E1] text-[#64748B] flex items-center justify-center">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-bold text-[#102A43]">{title}</h3>
        <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
          {description}
        </p>
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
