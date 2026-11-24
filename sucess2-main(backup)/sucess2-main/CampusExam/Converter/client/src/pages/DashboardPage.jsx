import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ArrowRight,
  TrendingUp,
  FileCheck,
  RefreshCw,
  Building2,
  Layers,
  Database
} from 'lucide-react';

export function DashboardPage({ onNavigate }) {
  const { isCOE, department } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const res = await api.getDashboardStats(isCOE ? 'ALL' : department);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [isCOE, department]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-[#1A237E] mr-2" />
        <span className="text-sm font-semibold">Loading Dashboard Intelligence...</span>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Uploaded Documents',
      value: stats?.totalUploaded || 0,
      icon: FileText,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      tag: 'All Formats'
    },
    {
      title: 'Successfully Converted',
      value: stats?.successfullyConverted || 0,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tag: 'Standardized'
    },
    {
      title: 'Awaiting Verification',
      value: stats?.awaitingVerification || 0,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      tag: 'Review Ready'
    },
    {
      title: 'Extraction Errors',
      value: stats?.extractionErrors || 0,
      icon: AlertTriangle,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      tag: 'Needs Attention'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Controller of Examinations &mdash; Conversion Dashboard
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1A237E]/10 text-[#1A237E] border border-[#1A237E]/20">
              {isCOE ? 'COE Master Authority' : `Dept: ${department}`}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Accept department question papers & student lists in any layout and convert into COE-established standard templates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate('sample-tests')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 shadow-sm"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Run 10 Test Cases</span>
          </button>
        </div>
      </div>

      {/* Primary Conversion Modules Navigation Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module A: Question Paper Converter */}
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl p-5 border border-blue-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A237E] bg-blue-100/70 px-2 py-0.5 rounded">
                Module A
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Question Paper Converter</h2>
              <p className="text-xs text-slate-600 max-w-md">
                Upload department question papers (PDF / DOCX). Automatically extracts dynamic modules, rich-text questions, code snippets, math formulas, options A&ndash;D, and images.
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#1A237E] text-white flex items-center justify-center shadow">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-100/80 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Dynamic Module Detection &bull; Rich Question Editor</span>
            </div>
            <button
              onClick={() => onNavigate('question-paper')}
              className="flex items-center gap-1 text-xs font-bold text-[#1A237E] hover:text-[#0D1442] group-hover:translate-x-0.5 transition-transform"
            >
              <span>Launch Converter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Module B: Student List Converter */}
        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-xl p-5 border border-orange-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#E65100] bg-orange-100/70 px-2 py-0.5 rounded">
                Module B
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">Student List Converter</h2>
              <p className="text-xs text-slate-600 max-w-md">
                Upload heterogeneous student rosters (Excel, CSV, PDF, DOCX). Formats Excel exports with the 4 locked template columns and imports records into the Central Database.
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#E65100] text-white flex items-center justify-center shadow">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-orange-100/80 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-orange-600" />
              <span>Supplied Student Template &bull; Central Roster Sync</span>
            </div>
            <button
              onClick={() => onNavigate('student-list')}
              className="flex items-center gap-1 text-xs font-bold text-[#E65100] hover:text-[#C2410C] group-hover:translate-x-0.5 transition-transform"
            >
              <span>Launch Converter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{c.title}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.color}`}>
                  {c.tag}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{c.value}</span>
                <div className={`p-2 rounded-lg border ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Department-wise Upload Breakdown */}
      {isCOE && stats?.departmentStats && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1A237E]" />
              <h3 className="text-sm font-bold text-slate-900">Department-wise Upload Records</h3>
            </div>
            <span className="text-xs text-slate-500">
              Central Student Roster: <strong className="text-slate-800">{stats?.centralStudentCount || 0} students</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Question Papers</th>
                  <th className="py-2.5 px-3">Student Lists</th>
                  <th className="py-2.5 px-3">Total Uploaded</th>
                  <th className="py-2.5 px-3">Verified</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.departmentStats.map((d) => (
                  <tr key={d.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded mr-1.5 text-slate-700">{d.code}</span>
                      {d.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{d.questionPapers}</td>
                    <td className="py-2.5 px-3 text-slate-600">{d.studentLists}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{d.total}</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">{d.verified}</td>
                    <td className="py-2.5 px-3">
                      {d.errors > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {d.errors} Error(s)
                        </span>
                      ) : d.total > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Operational
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No uploads</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Conversion History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#1A237E]" />
            <h3 className="text-sm font-bold text-slate-900">Recent Conversion History</h3>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-[#1A237E] hover:underline flex items-center gap-1"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats?.recentRecords?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Document Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Upload Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="uppercase text-[10px] px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                          {r.fileFormat}
                        </span>
                        <span className="truncate max-w-xs">{r.originalFilename}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.documentType === 'question_paper' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {r.documentType === 'question_paper' ? 'Question Paper' : 'Student List'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{r.department}</td>
                    <td className="py-2.5 px-3 text-slate-500">{new Date(r.uploadTime).toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'awaiting_verification'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.status === 'verified' ? 'Verified' : r.status === 'awaiting_verification' ? 'Awaiting Verification' : 'Error'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          if (r.documentType === 'question_paper') {
                            onNavigate('question-paper', { recordId: r.id });
                          } else {
                            onNavigate('student-list', { recordId: r.id });
                          }
                        }}
                        className="text-xs font-semibold text-[#1A237E] hover:underline"
                      >
                        Open Editor
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            No conversion records found. Upload a question paper or student list to get started.
          </div>
        )}
      </div>
    </div>
  );
}
