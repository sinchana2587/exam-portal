import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, ChevronDown, Award } from 'lucide-react';

export function Header() {
  const { role, department, userName, isCOE, departments, switchRole } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <header className="h-16 bg-[#1A237E] text-white px-4 md:px-6 flex items-center justify-between shadow-md border-b border-[#0D1442] z-30 select-none">
      {/* Brand & Crest */}
      <div className="flex items-center gap-3.5">
        <div className="bg-white rounded-md p-1 border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
          {!imgError ? (
            <img
              src="/assets/mit_logo.png"
              alt="MIT Mysore Logo"
              onError={() => setImgError(true)}
              className="h-10 w-auto object-contain block"
            />
          ) : (
            <div className="h-10 w-10 bg-[#0D1442] text-amber-400 font-bold text-xs flex items-center justify-center rounded">
              MITM
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm md:text-base font-bold tracking-tight text-white leading-tight">
              MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE
            </span>
            <span className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-white/10 text-slate-200 border border-white/20">
              COE System
            </span>
          </div>
          <span className="text-xs text-slate-300 font-medium">
            ProTick Examination Portal &mdash; Smart Document Converter
          </span>
        </div>
      </div>

      {/* Role Switcher & User Profile */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 bg-[#0D1442]/80 hover:bg-[#0D1442] border border-white/15 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-inner"
          >
            {isCOE ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Award className="w-3.5 h-3.5" />
                <span>COE / Super Admin</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Dept: {department}</span>
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Identity</div>
                <div className="font-bold text-slate-900 truncate mt-0.5">{userName}</div>
                <div className="text-slate-500">{isCOE ? 'Master Authority (All Departments)' : `Department Role: ${department}`}</div>
              </div>

              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Switch Role / Department
              </div>

              {/* COE Option */}
              <button
                onClick={() => {
                  switchRole('COE', 'ALL');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${isCOE ? 'bg-indigo-50 font-semibold text-[#1A237E]' : 'text-slate-700'}`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1A237E]" />
                  <div>
                    <div>Controller of Examinations (COE)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Full template config & all department access</div>
                  </div>
                </div>
                {isCOE && <span className="h-1.5 w-1.5 rounded-full bg-[#1A237E]"></span>}
              </button>

              <div className="my-1 border-t border-slate-100"></div>
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Department Users (Restricted)
              </div>

              {departments.map((d) => (
                <button
                  key={d.code}
                  onClick={() => {
                    switchRole('DEPARTMENT', d.code);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 ${!isCOE && department === d.code ? 'bg-orange-50 font-semibold text-[#E65100]' : 'text-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[11px] text-slate-600 w-10">{d.code}</span>
                    <span className="truncate">{d.name}</span>
                  </div>
                  {!isCOE && department === d.code && <span className="h-1.5 w-1.5 rounded-full bg-[#E65100]"></span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

