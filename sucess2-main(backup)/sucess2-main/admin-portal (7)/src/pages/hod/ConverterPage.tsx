import React, { Component, ReactNode, ErrorInfo, useState } from 'react';
import { StudentListConverter } from '../../components/StudentListConverter';
import { SmartDocumentConverter } from '../../components/SmartDocumentConverter';
import {
  AlertTriangle,
  RotateCcw,
  Users,
  FileText,
  Sparkles
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ConverterErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Converter caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-8 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl shadow-sm text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/60 rounded-full flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">Converter Error</h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4 font-mono bg-white dark:bg-slate-900 p-3 rounded-lg border border-red-100 dark:border-red-900/40 inline-block max-w-full overflow-x-auto text-left">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div>
            <button
              onClick={this.resetError}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Converter
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ConverterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'question_paper' | 'student_list'>('question_paper');

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* CONVERTER SECTION NAVIGATION TABS                        */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D9E2EF] dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {/* Tab 1: Question Paper Converter (Restored Operational Mode) */}
          <button
            type="button"
            onClick={() => setActiveTab('question_paper')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'question_paper'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-[#D9E2EF] dark:border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Question Paper Converter</span>
          </button>

          {/* Tab 2: Student List Converter (Phase 4 Dedicated Mode) */}
          <button
            type="button"
            onClick={() => setActiveTab('student_list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'student_list'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-[#D9E2EF] dark:border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student List Converter</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>MIT Mysore Examination Management System</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB CONTENT                                               */}
      {/* ========================================================= */}
      <ConverterErrorBoundary>
        {activeTab === 'question_paper' ? (
          <SmartDocumentConverter
            initialTab="question_paper"
            onTabChange={(tab: 'question_paper' | 'student_list') => setActiveTab(tab)}
          />
        ) : (
          <StudentListConverter />
        )}
      </ConverterErrorBoundary>
    </div>
  );
};

export default ConverterPage;
