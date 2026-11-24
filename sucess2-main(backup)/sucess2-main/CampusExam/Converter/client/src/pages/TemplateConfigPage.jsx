import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Save,
  Layers,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

export function TemplateConfigPage() {
  const { isCOE } = useAuth();

  const [templates, setTemplates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form states
  const [qpConfig, setQpConfig] = useState({
    defaultModules: 5,
    allowDynamicModules: true,
    requireImagesSeparated: true,
    allowedAnswers: ['A', 'B', 'C', 'D']
  });

  const [slConfig, setSlConfig] = useState({
    isLocked: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(false);
      const res = await api.getTemplates();
      if (res.success) {
        setTemplates(res.data);
        if (res.data.questionPaper) {
          setQpConfig({
            defaultModules: res.data.questionPaper.defaultModules || 5,
            allowDynamicModules: res.data.questionPaper.allowDynamicModules !== false,
            requireImagesSeparated: res.data.questionPaper.requireImagesSeparated !== false,
            allowedAnswers: res.data.questionPaper.allowedAnswers || ['A', 'B', 'C', 'D']
          });
        }
        if (res.data.studentList) {
          setSlConfig({
            isLocked: res.data.studentList.isLocked !== false
          });
        }
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQP = async () => {
    if (!isCOE) {
      alert('Only authorized Controller of Examinations (COE) can modify reference templates.');
      return;
    }
    try {
      setSaving(true);
      const res = await api.updateQuestionPaperTemplate(qpConfig);
      if (res.success) {
        setMessage({ type: 'success', text: 'Question Paper Reference Template configuration updated!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSLLock = async () => {
    if (!isCOE) {
      alert('Only authorized Controller of Examinations (COE) can toggle template locks.');
      return;
    }
    try {
      const newLock = !slConfig.isLocked;
      const res = await api.updateStudentListTemplate({
        isLocked: newLock,
        overrideLock: true
      });
      if (res.success) {
        setSlConfig({ isLocked: newLock });
        setMessage({ type: 'success', text: `Student List standard structure is now ${newLock ? 'LOCKED' : 'UNLOCKED'}.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-[#1A237E] mr-2" />
        <span className="text-sm font-semibold">Loading Reference Templates...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Reference Template Configuration
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              COE Master Authority
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Establish the permanent standard output structure. The converter enforces these templates regardless of the original document layout.
          </p>
        </div>

        {!isCOE && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only View: Switch to COE role to configure</span>
          </div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Grid: Question Paper Template vs Student List Template */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Template A: Question Paper Reference Template */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-[#1A237E] rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">A. Question Paper Reference Template</h2>
                <div className="text-[11px] text-slate-500">Configured by: {templates?.questionPaper?.configuredBy || 'COE Admin'}</div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1A237E] border border-blue-200">
              {(templates?.questionPaper?.standardFields?.length || 12)} Template Columns
            </span>
          </div>

          {/* Standard Fields Manifest */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Permanent Output Fields (Standardized Hierarchy)
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 max-h-48 overflow-y-auto">
              {templates?.questionPaper?.standardFields?.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[10px] w-4">{i + 1}.</span>
                  <span className="font-semibold">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Module Configuration (Section 3.A Core Rule) */}
          <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1A237E]" />
              <span className="text-xs font-bold text-[#1A237E]">Dynamic Module Architecture</span>
            </div>
            <p className="text-[11px] text-slate-600">
              ProTick never hardcodes 5 modules. Modules are detected dynamically from the document (3, 5, 8, etc.) or configured manually.
            </p>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="font-semibold text-slate-700">Allow Dynamic Module Auto-Detection:</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                Always Active
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Default Baseline Modules:</span>
              <select
                disabled={!isCOE}
                value={qpConfig.defaultModules}
                onChange={(e) => setQpConfig({ ...qpConfig, defaultModules: Number(e.target.value) })}
                className="bg-white border border-slate-300 rounded px-3 py-1 font-bold text-slate-800"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(m => (
                  <option key={m} value={m}>{m} Modules</option>
                ))}
              </select>
            </div>
          </div>

          {/* Answer Option Enforcement */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Permitted Answer Values:</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                A, B, C, D (Strictly Locked)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Separate Media Asset Storage:</span>
              <span className="font-bold text-emerald-700">Enabled (Extracted as independent URLs)</span>
            </div>
          </div>

          {isCOE && (
            <div className="pt-2 border-t flex justify-end">
              <button
                onClick={handleSaveQP}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-bold shadow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Question Paper Template</span>
              </button>
            </div>
          )}
        </div>

        {/* Template B: Student List Reference Template */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 text-[#E65100] rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">B. Student List Reference Template</h2>
                <div className="text-[11px] text-slate-500">Established by: {templates?.studentList?.configuredBy || 'COE'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {slConfig.isLocked ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Locked by COE</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  <Unlock className="w-3 h-3 text-slate-500" />
                  <span>Unlocked</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>COE Structural Enforcement Rule</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Departments are not permitted to change the final output structure. Every department upload, regardless of original column names or arrangements, is transformed strictly into these 4 template columns.
            </p>
          </div>

          {/* Supplied Student Workbook Template Columns */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              4 Template Columns (Enforced)
            </label>
            <div className="space-y-2">
              {templates?.studentList?.standardColumns?.map((col) => (
                <div key={col.key} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-[#1A237E] text-white flex items-center justify-center font-bold text-[10px]">
                      {col.order}
                    </span>
                    <span className="font-bold text-slate-900">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                    <span>Type: {col.type}</span>
                    <span className="text-emerald-700 font-bold">Required</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column Synonym Mappings */}
          <div className="space-y-2 text-xs">
            <label className="block font-bold text-slate-700 uppercase tracking-wider">
              Built-in Column Synonym Recognition
            </label>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1.5 text-slate-600">
              <div><strong>USN &larr;</strong> Register Number, Reg No, Roll No, Hall Ticket, Candidate ID</div>
              <div><strong>Student Name &larr;</strong> Name, Student, Candidate Name, Full Name</div>
              <div><strong>Section &larr;</strong> Class, Division, Sec, Group</div>
              <div><strong>Semester &larr;</strong> Sem, Term, Year/Sem</div>
              <div><strong>Serial Number &larr;</strong> Sl No, S.No, Sno, #</div>
            </div>
          </div>

          {isCOE && (
            <div className="pt-2 border-t flex justify-end">
              <button
                onClick={handleToggleSLLock}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow"
              >
                {slConfig.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{slConfig.isLocked ? 'Unlock Template for Editing' : 'Lock Template (Enforce Strict 5-Col Output)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
