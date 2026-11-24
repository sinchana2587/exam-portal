import React, { useState } from 'react';
import {
  INSTITUTION_NAME,
  MIT_MYSORE_LOGO_URL,
  PORTAL_NAME,
} from '../assets/brandAssets';

interface MitLogoBrandProps {
  size?: 'sm' | 'md' | 'lg';
  showPortalSubheading?: boolean;
  darkSurface?: boolean;
}

/**
 * Official Maharaja Institute of Technology Mysore Brand Lockup
 * Strictly preserves original aspect ratio and clear space around the logo.
 */
export const MitLogoBrand: React.FC<MitLogoBrandProps> = ({
  size = 'md',
  showPortalSubheading = true,
  darkSurface = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const logoSizeClasses =
    size === 'sm'
      ? 'h-10 w-auto'
      : size === 'lg'
      ? 'h-16 w-auto'
      : 'h-12 w-auto';

  const titleSizeClasses =
    size === 'sm'
      ? 'text-sm sm:text-base font-bold'
      : size === 'lg'
      ? 'text-lg sm:text-xl font-bold'
      : 'text-base sm:text-lg font-bold';

  const subtitleClasses = darkSurface
    ? 'text-slate-300 text-xs'
    : 'text-[#2463B5] font-semibold text-xs sm:text-[13px]';

  return (
    <div className="flex items-center gap-3.5 select-none">
      <div className="shrink-0 bg-white rounded-[6px] p-1 border border-[#DCE3EC] flex items-center justify-center">
        {!imgError ? (
          <img
            src={MIT_MYSORE_LOGO_URL}
            alt="Official Logo of Maharaja Institute of Technology Mysore"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`${logoSizeClasses} object-contain block`}
          />
        ) : (
          <div
            aria-label="Maharaja Institute of Technology Mysore Emblem"
            className="h-10 w-10 rounded-[6px] bg-[#102A43] text-white font-bold text-xs flex items-center justify-center tracking-tight"
          >
            MITM
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div
          className={`${titleSizeClasses} font-institution tracking-tight leading-snug ${
            darkSurface ? 'text-white' : 'text-[#102A43]'
          }`}
        >
          {INSTITUTION_NAME}
        </div>
        {showPortalSubheading && (
          <div className={`${subtitleClasses} truncate`}>
            {PORTAL_NAME}
          </div>
        )}
      </div>
    </div>
  );
};
