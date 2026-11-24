/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading examination data...',
  subMessage = 'Connecting to Maharaja Institute of Technology Mysore Lab Server',
  className = '',
}) => {
  return (
    <div
      role="status"
      className={`w-full py-16 px-6 flex flex-col items-center justify-center text-center space-y-3.5 bg-white border border-[#DCE3EC] rounded-[10px] institutional-card-shadow ${className}`}
    >
      <div className="w-12 h-12 rounded-[10px] bg-blue-50 border border-blue-200 text-[#2463B5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-bold text-[#102A43]">{message}</h3>
        {subMessage && (
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
};
