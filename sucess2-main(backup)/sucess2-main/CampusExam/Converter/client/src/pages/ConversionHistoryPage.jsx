import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  History,
  Download,
  RotateCcw,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  FileCheck,
  ChevronDown
} from 'lucide-react';

export function ConversionHistoryPage({ onOpenRecord }) {
  const { isCOE, department: activeDept, departments } = useAuth();

  const [records, setRecords] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('documents'); // 'documents' | 'audit_logs'

  // Filters
  const [filterDept, setFilterDept] = useState(isCOE ? 'ALL' : activeDept);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [reprocessingId, setReprocessingId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [filterDept, filterType, filterStatus]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const filter = {
        department: filterDept !== 'ALL' ? filterDept : undefined,
        documentType: filterType !== 'ALL' ? filterType : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined
      };
      const res = await api.getHistory(filter);
      if (res.success) {
        setRecords(res.data.records);
      }
      const logsRes = await api.getAuditLogs();
      if (logsRes.success) {
        setAuditLogs(logsRes.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async (recordId) => {
    try {
      setReprocessingId(recordId);
      const res = await api.reprocessDocument(recordId);
      if (res.success) {
        setMessage({ type: 'success', text: 'Document reprocessed successfully!' });
        fetchHistory();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message });
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Delete this conversion record and its parsed outputs?')) return;
    try {
      const res = await api.deleteRecord(recordId);
      if (res.success) {
        setMessage({ type: 'success', text: 'Record removed.' });
        fetchHistory();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Conversion History & Audit Trail
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1A237E]/10 text-[#1A237E] border border-[#1A237E]/20">
              Auditing System
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Complete institutional audit log. Original documents are securely archived for auditing, verification, and reprocessing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('documents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'documents'
                ? 'bg-[#1A237E] text-white shadow-sm'
                : 'bg-white border text-slate-700 hover:bg-slate-50'
            }`}
          >
            Conversion Records ({records.length})
          </button>
          <button
            onClick={() => setActiveSubTab('audit_logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'audit_logs'
                ? 'bg-[#1A237E] text-white shadow-sm'
                : 'bg-white border text-slate-700 hover:bg-slate-50'
            }`}
          >
            Audit Log Stream ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Records View */}
      {activeSubTab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {isCOE && (
                <div className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className="bg-transparent font-bold text-slate-800"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500 font-medium">Doc Type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-transparent font-bold text-slate-800"
                >
                  <option value="ALL">All Types</option>
                  <option value="question_paper">Question Paper</option>
                  <option value="student_list">Student List</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent font-bold text-slate-800"
                >
                  <option value="ALL">All Status</option>
                  <option value="verified">Verified</option>
                  <option value="awaiting_verification">Awaiting Verification</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchHistory}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh History</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Original File</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Dept</th>
                  <th className="py-2.5 px-3">Uploaded On</th>
                  <th className="py-2.5 px-3">Uploaded By</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Exports</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const isQp = r.documentType === 'question_paper';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-600">
                            {r.fileFormat}
                          </span>
                          <span className="truncate max-w-xs">{r.originalFilename}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isQp ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {isQp ? 'Question Paper' : 'Student List'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{r.department}</td>
                      <td className="py-2.5 px-3 text-slate-500">{new Date(r.uploadTime).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.uploadedBy || 'Lecturer'}</td>
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
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {r.exportHistory?.length > 0 ? (
                          <span className="font-mono">{r.exportHistory.length} export(s)</span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View in editor */}
                          <button
                            onClick={() => onOpenRecord(r.documentType, r.id)}
                            className="p-1 hover:bg-slate-200 rounded text-[#1A237E]"
                            title="Open in Standard Editor"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Download Original File */}
                          <a
                            href={api.getDownloadOriginalUrl(r.id)}
                            download={r.originalFilename}
                            className="p-1 hover:bg-slate-200 rounded text-slate-700"
                            title="Download Original Document (Audit Archive)"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Reprocess */}
                          <button
                            onClick={() => handleReprocess(r.id)}
                            disabled={reprocessingId === r.id}
                            className="p-1 hover:bg-slate-200 rounded text-slate-700"
                            title="Reprocess with Conversion Engine"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${reprocessingId === r.id ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Delete */}
                          {isCOE && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1 hover:bg-rose-100 rounded text-rose-600"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {records.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">
                No conversion records found for selected filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Logs View */}
      {activeSubTab === 'audit_logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Immutable System Audit Log Stream (Last 100 Events)
            </h3>
            <span className="text-[11px] text-slate-400">Offline Audit Engine</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1A237E]">{log.action}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-200 font-mono text-[10px] text-slate-700">
                      {log.entityType}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-slate-600 flex items-center gap-2 text-[11px]">
                  <span>User: <strong className="text-slate-800">{log.user}</strong></span>
                  <span>&bull;</span>
                  <span>Role: <strong>{log.role}</strong></span>
                  <span>&bull;</span>
                  <span>Dept: <strong>{log.department}</strong></span>
                </div>
                {log.details && (
                  <pre className="p-2 bg-white rounded border border-slate-200 text-[10px] font-mono text-slate-700 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No audit log entries recorded yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
