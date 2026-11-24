/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { InstitutionHeader, InstitutionHeaderProps } from './InstitutionHeader';

export interface StudentPageLayoutProps extends InstitutionHeaderProps {
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  mainClassName?: string;
}

export const StudentPageLayout: React.FC<StudentPageLayoutProps> = ({
  children,
  rightSlot,
  subtitle,
  serverAddress,
  footerContent,
  mainClassName = '',
}) => {
  return (
    <div className="min-h-[100dvh] bg-[#F7F9FC] flex flex-col justify-between text-[#243247] font-sans">
      <InstitutionHeader
        rightSlot={rightSlot}
        subtitle={subtitle}
        serverAddress={serverAddress}
      />
      <main className={`flex-1 w-full ${mainClassName}`}>
        {children}
      </main>
      {footerContent && (
        <footer className="bg-white border-t border-[#DCE3EC] px-6 py-3 text-xs text-[#64748B]">
          <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-2">
            {footerContent}
          </div>
        </footer>
      )}
    </div>
  );
};

