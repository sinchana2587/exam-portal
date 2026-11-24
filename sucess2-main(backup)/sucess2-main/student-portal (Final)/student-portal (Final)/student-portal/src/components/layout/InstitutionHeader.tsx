/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Monitor, Wifi } from 'lucide-react';
import {
  INSTITUTION_NAME,
  MIT_MYSORE_LOGO_URL,
  PORTAL_NAME,
} from '../../assets/brandAssets';
import { LAB_API_BASE_URL } from '../../services/apiConfig';
import { emergencyRecoveryService } from '../../services/emergencyRecoveryService';

export interface InstitutionHeaderProps {
  /** Optional right-side content (e.g. countdown timer, student info, action buttons) */
  rightSlot?: React.ReactNode;
  /** Subtitle text override if needed; defaults to 'MIT Mysore Student Examination Portal' */
  subtitle?: React.ReactNode;
  /** Override the displayed server URL; defaults to LAB_API_BASE_URL */
  serverAddress?: string;
  /** Custom class names to append to header container */
  className?: string;
  /** Workstation / Terminal System ID override */
  systemId?: string;
  /** Header color theme variant: 'white' (standard default) | 'blue' (institutional blue banner) */
  theme?: 'white' | 'blue';
  /** Whether to hide the offline LAN mode / Lab Server connected indicator */
  hideLanIndicator?: boolean;
}

/**
 * Standardized Shared Institutional Header for MIT Mysore Student Examination System.
 * Height: ~96-112px | Logo: ~64-90px | Background: White or Institutional Blue | Border: #DCE3EC or #243B53
 */
export const InstitutionHeader: React.FC<InstitutionHeaderProps> = ({
  rightSlot,
  subtitle = PORTAL_NAME,
  serverAddress = LAB_API_BASE_URL,
  className = '',
  systemId,
  theme = 'blue',
  hideLanIndicator = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const activeSystemId =
    systemId || emergencyRecoveryService.getClientSystemId() || 'LAB01-PC-03';
  const isBlue = theme === 'blue';

  return (
    <header
      role="banner"
      className={`${
        isBlue
          ? 'bg-gradient-to-r from-[#102A43] via-[#16365C] to-[#102A43] border-b border-[#243B53] text-white shadow-md'
          : 'bg-white border-b border-[#DCE3EC]'
      } min-h-[96px] sm:min-h-[112px] py-4 sm:py-5 flex items-center sticky top-0 z-40 select-none ${className}`}
    >
      <div className="max-w-[1400px] w-full mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* LEFT SIDE: MIT Mysore Logo + Institution Name + Subtitle */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 max-w-full">
          <div
            className={`shrink-0 rounded-[8px] p-1.5 sm:p-2 border flex items-center justify-center ${
              isBlue ? 'bg-white border-white/20 shadow-xs' : 'bg-white border-[#DCE3EC]'
            }`}
          >
            {!imgError ? (
              <img
                src={MIT_MYSORE_LOGO_URL}
                alt="Official Logo of Maharaja Institute of Technology Mysore"
                className="h-[64px] sm:h-[80px] md:h-[90px] w-auto object-contain block"
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                aria-label="Maharaja Institute of Technology Mysore"
                className="h-[64px] w-[64px] sm:h-[80px] sm:w-[80px] md:h-[90px] md:w-[90px] rounded-[8px] bg-[#102A43] text-white font-bold text-sm sm:text-base md:text-lg flex items-center justify-center tracking-tight"
              >
                MITM
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1
              className={`font-institution font-bold text-lg sm:text-2xl md:text-[28px] lg:text-3xl tracking-tight leading-tight truncate max-w-[220px] xs:max-w-[320px] sm:max-w-none ${
                isBlue ? 'text-white' : 'text-[#102A43]'
              }`}
            >
              {INSTITUTION_NAME}
            </h1>
            <div
              className={`text-xs sm:text-[14px] md:text-[15px] font-semibold mt-1 truncate max-w-[220px] xs:max-w-[320px] sm:max-w-none ${
                isBlue ? 'text-blue-200' : 'text-[#2463B5]'
              }`}
            >
              {subtitle}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Dynamic contextual slot OR Standard Offline LAN Mode Status */}
        <div className="shrink-0 flex items-center gap-2.5 sm:gap-3.5 ml-auto sm:-mr-14 md:-mr-16 lg:-mr-20">
          {rightSlot ? (
            rightSlot
          ) : hideLanIndicator ? null : (
            <div className="flex items-center gap-2.5 sm:gap-3.5 text-xs sm:text-sm">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[8px] border flex items-center justify-center shrink-0 ${
                  isBlue
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-[#F7F9FC] border-[#DCE3EC] text-[#2463B5]'
                }`}
              >
                <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="text-left hidden md:block">
                <div
                  className={`flex items-center gap-2 font-bold text-xs sm:text-sm ${
                    isBlue ? 'text-white' : 'text-[#102A43]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16865B] shrink-0"></span>
                  <span>Offline LAN Mode · Lab Server Connected</span>
                </div>
                <div
                  className={`font-mono text-xs sm:text-[13px] mt-0.5 ${
                    isBlue ? 'text-blue-200' : 'text-[#64748B]'
                  }`}
                >
                  {serverAddress}
                </div>
              </div>
              {/* Compact mobile badge */}
              <div
                className={`md:hidden flex items-center gap-2 px-3 py-1.5 rounded-[8px] border text-xs sm:text-sm font-bold ${
                  isBlue
                    ? 'bg-white/15 border-white/25 text-white'
                    : 'bg-emerald-50 border-emerald-300 text-[#16865B]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#16865B] shrink-0"></span>
                <span>LAN Connected</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

