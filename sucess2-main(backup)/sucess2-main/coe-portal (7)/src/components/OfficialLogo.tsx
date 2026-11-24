import React, { useState } from 'react';

export const OFFICIAL_MIT_LOGO_PATH = '/assets/aistudio/image_03b7be00.png';

interface OfficialLogoProps {
  variant?: 'sidebar-expanded' | 'sidebar-collapsed' | 'login' | 'mobile-bar';
  className?: string;
}

export const OfficialLogo: React.FC<OfficialLogoProps> = ({
  variant = 'sidebar-expanded',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const renderLogoMark = (sizeClass: string, paddingClass = 'p-[2.5px]') => (
    <div
      className={`shrink-0 rounded-full bg-[#2C3384] ${paddingClass} ring-1 ring-white/20 shadow-xs flex items-center justify-center ${sizeClass}`}
      title="Maharaja Institute of Technology Mysore"
    >
      {!imgError ? (
        <div className="w-full h-full rounded-full overflow-hidden aspect-square bg-[#2C3384]">
          <img
            src={OFFICIAL_MIT_LOGO_PATH}
            alt="Maharaja Institute of Technology Mysore Official Logo"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover select-none"
          />
        </div>
      ) : (
        <span className="text-xs font-bold text-white tracking-tight">MITM</span>
      )}
    </div>
  );

  if (variant === 'sidebar-collapsed') {
    return (
      <div
        className={`flex items-center justify-center py-1 ${className}`}
        aria-label="Maharaja Institute of Technology Mysore - Examination Management System"
      >
        {renderLogoMark('w-10 h-10', 'p-[2px]')}
      </div>
    );
  }

  if (variant === 'mobile-bar') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {renderLogoMark('w-10 h-10', 'p-[2px]')}
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-tight truncate">
            Maharaja Institute of Technology Mysore
          </div>
          <div className="text-xs text-slate-300 leading-tight truncate mt-0.5">
            Examination Management System · COE Portal
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        {renderLogoMark('w-16 h-16', 'p-[3px]')}
        <div>
          <div className="text-base sm:text-lg font-bold text-[#17243A] tracking-tight leading-snug">
            Maharaja Institute of Technology Mysore
          </div>
          <div className="text-sm font-medium text-[#64748B] leading-snug">
            Examination Management System · Controller of Examinations Portal
          </div>
        </div>
      </div>
    );
  }

  // Default: sidebar-expanded
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {renderLogoMark('w-12 h-12', 'p-[2.5px]')}
      <div className="min-w-0">
        <div className="text-sm font-bold text-white leading-snug tracking-tight">
          Maharaja Institute of Technology Mysore
        </div>
        <div className="text-xs font-medium text-slate-300 leading-tight mt-0.5">
          Examination Management System
        </div>
      </div>
    </div>
  );
};
