import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Moon,
  Plus,
  Power,
  RefreshCw,
  Save,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useExaminationStore } from '../hooks/useExaminationStore';
import { authenticationService } from '../services/authenticationService';
import { examinationService } from '../services/examinationService';

export type SettingsSectionId = 'laboratories' | 'change-password' | 'appearance';

interface LabRecord {
  id: string | number;
  numericId?: number;
  labCode?: string;
  code?: string;
  labName?: string;
  name?: string;
  buildingLocation?: string;
  location?: string;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE' | string;
  serverIdentifier?: string;
}

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { theme, setTheme, refreshAll, notify } = useExaminationStore();

  const rawSection = searchParams.get('section');
  const activeSection: SettingsSectionId =
    rawSection === 'appearance'
      ? 'appearance'
      : rawSection === 'change-password'
      ? 'change-password'
      : 'laboratories';

  // Section A: Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Section B: Laboratory Management State
  const [laboratories, setLaboratories] = useState<LabRecord[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [labActionError, setLabActionError] = useState<string | null>(null);
  const [labActionSuccess, setLabActionSuccess] = useState<string | null>(null);

  // Add Lab form
  const [showAddLab, setShowAddLab] = useState(false);
  const [newLabCode, setNewLabCode] = useState('');
  const [newLabName, setNewLabName] = useState('');
  const [newLabLocation, setNewLabLocation] = useState('');
  const [newLabCapacity, setNewLabCapacity] = useState<number>(30);
  const [submittingAddLab, setSubmittingAddLab] = useState(false);

  // Edit Lab form / modal
  const [editingLab, setEditingLab] = useState<LabRecord | null>(null);
  const [editLabCode, setEditLabCode] = useState('');
  const [editLabName, setEditLabName] = useState('');
  const [editLabLocation, setEditLabLocation] = useState('');
  const [editLabCapacity, setEditLabCapacity] = useState<number>(30);
  const [editLabStatus, setEditLabStatus] = useState<string>('ACTIVE');
  const [submittingEditLab, setSubmittingEditLab] = useState(false);

  const loadLaboratories = useCallback(async () => {
    setLoadingLabs(true);
    try {
      const data = await examinationService.getLaboratories();
      if (Array.isArray(data)) {
        setLaboratories(data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load laboratories';
      setLabActionError(msg);
    } finally {
      setLoadingLabs(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'laboratories') {
      loadLaboratories();
    }
  }, [activeSection, loadLaboratories]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setStatusMessage({
        type: 'error',
        text: 'All password fields are required.',
      });
      return;
    }

    if (newPassword.length < 8) {
      setStatusMessage({
        type: 'error',
        text: 'New password must be at least 8 characters long.',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatusMessage({
        type: 'error',
        text: 'New password and confirmation password do not match.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await authenticationService.changePassword(
        currentPassword,
        newPassword,
        confirmNewPassword
      );
      await refreshAll();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setStatusMessage({
        type: 'success',
        text: res.message,
      });
      notify('success', 'Password Updated', res.message);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to update COE password.';
      setStatusMessage({
        type: 'error',
        text: msg,
      });
      notify('error', 'Password Update Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setLabActionError(null);
    setLabActionSuccess(null);

    if (!newLabName.trim()) {
      setLabActionError('Laboratory Name is required.');
      return;
    }
    if (newLabCapacity <= 0) {
      setLabActionError('Number of seats / PCs available must be greater than zero.');
      return;
    }

    setSubmittingAddLab(true);
    try {
      await examinationService.createLaboratory({
        name: newLabName.trim(),
        capacity: Number(newLabCapacity),
      });
      setLabActionSuccess(`Laboratory "${newLabName.trim()}" created successfully.`);
      notify('success', 'Laboratory Added', `Laboratory "${newLabName.trim()}" created.`);
      setNewLabName('');
      setNewLabCapacity(30);
      setShowAddLab(false);
      await loadLaboratories();
      await refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create laboratory';
      setLabActionError(msg);
      notify('error', 'Creation Failed', msg);
    } finally {
      setSubmittingAddLab(false);
    }
  };

  const startEditLab = (lab: LabRecord) => {
    setEditingLab(lab);
    setEditLabCode(lab.labCode || lab.code || String(lab.id));
    setEditLabName(lab.labName || lab.name || '');
    setEditLabLocation(lab.buildingLocation || lab.location || '');
    setEditLabCapacity(Number(lab.capacity) || 30);
    setEditLabStatus(lab.status || 'ACTIVE');
    setLabActionError(null);
    setLabActionSuccess(null);
  };

  const handleSaveEditLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLab) return;
    setLabActionError(null);
    setLabActionSuccess(null);

    if (!editLabName.trim()) {
      setLabActionError('Laboratory Name is required.');
      return;
    }
    if (editLabCapacity <= 0) {
      setLabActionError('Number of seats / PCs available must be greater than zero.');
      return;
    }

    setSubmittingEditLab(true);
    try {
      const labIdentifier = editingLab.numericId || editingLab.id;
      await examinationService.updateLaboratory(labIdentifier, {
        name: editLabName.trim(),
        capacity: Number(editLabCapacity),
        status: editLabStatus,
      });
      setLabActionSuccess(`Laboratory "${editLabName.trim()}" updated successfully.`);
      notify('success', 'Laboratory Updated', `Laboratory "${editLabName.trim()}" settings saved.`);
      setEditingLab(null);
      await loadLaboratories();
      await refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update laboratory';
      setLabActionError(msg);
      notify('error', 'Update Failed', msg);
    } finally {
      setSubmittingEditLab(false);
    }
  };

  const handleToggleStatus = async (lab: LabRecord) => {
    setLabActionError(null);
    setLabActionSuccess(null);
    const newStatus = lab.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const labIdentifier = lab.numericId || lab.id;
      await examinationService.updateLaboratory(labIdentifier, {
        status: newStatus,
      });
      setLabActionSuccess(`Laboratory ${lab.labCode || lab.code || lab.id} marked as ${newStatus}.`);
      notify('success', 'Status Changed', `${lab.labCode || lab.id} is now ${newStatus}`);
      await loadLaboratories();
      await refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change laboratory status';
      setLabActionError(msg);
      notify('error', 'Toggle Failed', msg);
    }
  };

  return (
    <div className="max-w-5xl space-y-7">
      {/* Main Page Heading */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs">
        <h1 className="text-[26px] sm:text-[28px] font-bold text-[#1F2937] dark:text-slate-100 leading-tight">
          COE Portal Settings
        </h1>
        <p className="text-[15px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed">
          Manage institution laboratory facilities, capacity, authentication credentials, and portal appearance preferences.
        </p>
      </div>

      {/* SECTION: Laboratory Management */}
      {activeSection === 'laboratories' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <div className="flex items-center gap-3">
              <Laptop className="w-6 h-6 text-[#2563EB] dark:text-blue-400" />
              <div>
                <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                  Laboratory Management
                </h2>
                <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                  Configure examination laboratories, seat capacity, building locations, and operational availability.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={loadLaboratories}
                disabled={loadingLabs}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh laboratories"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLabs ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddLab(!showAddLab);
                  setEditingLab(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {showAddLab ? 'Close Form' : 'Add Laboratory'}
              </button>
            </div>
          </div>

          {labActionError && (
            <div className="p-4 rounded-xl border flex items-start gap-3 text-sm bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-[#B42318] dark:text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{labActionError}</span>
            </div>
          )}

          {labActionSuccess && (
            <div className="p-4 rounded-xl border flex items-start gap-3 text-sm bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[#16834A] dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{labActionSuccess}</span>
            </div>
          )}

          {/* Add Laboratory Form Card */}
          {showAddLab && (
            <form onSubmit={handleCreateLab} className="p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#2563EB]" />
                  Add New Examination Laboratory
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddLab(false)}
                  className="p-1 rounded-md text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                    Laboratory Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabName}
                    onChange={(e) => setNewLabName(e.target.value)}
                    placeholder="e.g. Computer Science Lab 1"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                    Number of Seats / PCs Available *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newLabCapacity}
                    onChange={(e) => setNewLabCapacity(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLab(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAddLab}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs disabled:opacity-50"
                >
                  {submittingAddLab ? 'Creating Lab...' : 'Save Laboratory'}
                </button>
              </div>
            </form>
          )}

          {/* Edit Laboratory Modal */}
          {editingLab && (
            <form onSubmit={handleSaveEditLab} className="p-5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Edit Laboratory: {editingLab.labCode || editingLab.code || editingLab.id}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingLab(null)}
                  className="p-1 rounded-md text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                    Laboratory Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editLabName}
                    onChange={(e) => setEditLabName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                    Number of Seats / PCs Available *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editLabCapacity}
                    onChange={(e) => setEditLabCapacity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-200 mb-1">
                    Status
                  </label>
                  <select
                    value={editLabStatus}
                    onChange={(e) => setEditLabStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLab(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#64748B] hover:text-[#1F2937] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditLab}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {submittingEditLab ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Laboratories Table */}
          <div className="overflow-x-auto rounded-xl border border-[#D9E2EF] dark:border-[#334155]">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#D9E2EF] dark:border-[#334155] text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Lab Code</th>
                  <th className="py-3.5 px-4">Lab Name</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4 text-center">Seat Capacity</th>
                  <th className="py-3.5 px-4 text-center">Operational Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EF] dark:divide-[#334155]">
                {loadingLabs ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B] dark:text-slate-400">
                      Loading institution laboratories...
                    </td>
                  </tr>
                ) : laboratories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B] dark:text-slate-400">
                      No laboratories found in the central database.
                    </td>
                  </tr>
                ) : (
                  laboratories.map((lab) => {
                    const labCode = lab.labCode || lab.code || String(lab.id);
                    const labName = lab.labName || lab.name || 'Unnamed Lab';
                    const location = lab.buildingLocation || lab.location || 'Examination Wing';
                    const isActive = lab.status === 'ACTIVE';

                    return (
                      <tr
                        key={String(lab.id)}
                        className="hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#1F2937] dark:text-slate-200">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {labCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#1F2937] dark:text-slate-100">
                          {labName}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B] dark:text-slate-400 text-xs">
                          {location}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Users className="w-3 h-3" />
                            {lab.capacity} Seats
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#16834A] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {lab.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditLab(lab)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-[#D9E2EF] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Lab Details and Seat Capacity"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(lab)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                                isActive
                                  ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-[#B42318] dark:text-red-300 hover:bg-red-100'
                                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-[#16834A] dark:text-emerald-300 hover:bg-emerald-100'
                              }`}
                              title={isActive ? 'Deactivate Laboratory' : 'Activate Laboratory'}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: Change Password */}
      {activeSection === 'change-password' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <KeyRound className="w-6 h-6 text-[#2563EB] dark:text-blue-400" />
            <div>
              <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
                Change Password
              </h2>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                Update your COE authentication credentials.
              </p>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[#16834A] dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-[#B42318] dark:text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-3 pr-11 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle current password visibility"
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (minimum 8 characters, letters & numbers)"
                  className="w-full px-4 py-3 pr-11 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle new password visibility"
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1F2937] dark:text-slate-200 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 pr-11 text-sm rounded-lg border border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] text-[#1F2937] dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION: Appearance */}
      {activeSection === 'appearance' && (
        <div className="bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-[#D9E2EF] dark:border-[#334155] pb-5">
            <h2 className="text-[20px] font-bold text-[#1F2937] dark:text-slate-100">
              Appearance
            </h2>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
              Choose Light Mode or Dark Mode for the COE Portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                theme === 'light'
                  ? 'border-[#2563EB] bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                  : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] hover:border-slate-400'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-white border border-[#D9E2EF] flex items-center justify-center text-amber-500 shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    Light Mode
                  </div>
                  <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    Standard institutional daylight interface
                  </div>
                </div>
              </div>
              {theme === 'light' && (
                <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                theme === 'dark'
                  ? 'border-[#2563EB] bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                  : 'border-[#D9E2EF] dark:border-[#334155] bg-[#F5F7FB] dark:bg-[#0F172A] hover:border-slate-400'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-[#0F172A] border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                    Dark Mode
                  </div>
                  <div className="text-[13px] text-[#64748B] dark:text-slate-400 mt-0.5">
                    Low-glare dark slate operational theme
                  </div>
                </div>
              </div>
              {theme === 'dark' && (
                <CheckCircle2 className="w-5 h-5 text-[#2563EB] dark:text-blue-400 shrink-0" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
