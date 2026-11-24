import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Upload,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Database,
  X,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export function StudentListConverterPage({ initialRecordId = null }) {
  const { isCOE, department: activeDept } = useAuth();

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [department, setDepartment] = useState(activeDept === 'ALL' ? 'CSE' : activeDept);
  const [semester, setSemester] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Converted state
  const [recordId, setRecordId] = useState(initialRecordId);
  const [listData, setListData] = useState(null);
  const [recordMeta, setRecordMeta] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [message, setMessage] = useState(null);

  // Table filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'valid' | 'duplicate' | 'error'
  const [sortField, setSortField] = useState('serialNumber');
  const [sortAsc, setSortAsc] = useState(true);

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Add new student modal/inline
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    usn: '',
    studentName: '',
    section: 'A',
    semester: 5
  });

  // Central DB Import Conflict Confirmation Modal
  const [conflictModalData, setConflictModalData] = useState(null); // { conflicts, imported }

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialRecordId) {
      loadStudentList(initialRecordId);
    }
  }, [initialRecordId]);

  const loadStudentList = async (id) => {
    try {
      setLoadingRecord(true);
      const res = await api.getStudentList(id);
      if (res.success) {
        setRecordId(id);
        setListData(res.data.listData);
        setRecordMeta(res.data.record);
      }
    } catch (err) {
      console.error('Error loading student list:', err);
    } finally {
      setLoadingRecord(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a student list document (Excel, CSV, PDF, or DOCX).' });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(20);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('department', department);
      formData.append('semester', semester);

      setUploadProgress(60);
      const res = await api.uploadStudentList(formData);
      setUploadProgress(100);

      if (res.success) {
        setRecordId(res.data.recordId);
        setListData(res.data.listData);
        setRecordMeta(res.data.record);
        setMessage({ type: 'success', text: 'Student list successfully extracted and formatted for the uploaded template!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Extraction failed' });
    } finally {
      setUploading(false);
    }
  };

  // Inline Row Edit handlers
  const startEditRow = (row) => {
    setEditingRowId(row.id);
    setEditFormData({
      serialNumber: row.serialNumber,
      usn: row.usn,
      studentName: row.studentName,
      section: row.section,
      semester: row.semester
    });
  };

  const saveEditRow = async (studentId) => {
    try {
      const res = await api.updateStudentRow(recordId, studentId, editFormData);
      if (res.success) {
        setListData(res.data);
        setEditingRowId(null);
        setMessage({ type: 'success', text: 'Student row updated.' });
      }
    } catch (err) {
      console.error('Update row error:', err);
    }
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleDeleteRow = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student record?')) return;
    try {
      const res = await api.deleteStudentRow(recordId, studentId);
      if (res.success) {
        setListData(res.data);
      }
    } catch (err) {
      console.error('Delete row error:', err);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentData.usn || !newStudentData.studentName) {
      alert('USN and Student Name are required.');
      return;
    }
    try {
      const res = await api.addStudentRow(recordId, {
        ...newStudentData,
        department: recordMeta?.department || department
      });
      if (res.success) {
        setListData(res.data.listData);
        setShowAddModal(false);
        setNewStudentData({ usn: '', studentName: '', section: 'A', semester: 5 });
        setMessage({ type: 'success', text: 'Student added to list.' });
      }
    } catch (err) {
      console.error('Add student error:', err);
    }
  };

  const handleVerify = async () => {
    try {
      const res = await api.verifyStudentList(recordId);
      if (res.success) {
        setRecordMeta(res.data.record);
        setListData(res.data.listData);
        setMessage({ type: 'success', text: 'Student list verified & approved!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleImportToCentral = async (overwriteExisting = false) => {
    try {
      const res = await api.importToCentralDatabase(recordId, overwriteExisting);
      if (res.requiresConfirmation) {
        // Open conflict dialog
        setConflictModalData(res.data);
      } else if (res.success) {
        setConflictModalData(null);
        setMessage({ type: 'success', text: res.message });
        // reload
        loadStudentList(recordId);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message });
    }
  };

  // Filtered and Sorted Records
  let displayedRecords = listData?.records || [];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayedRecords = displayedRecords.filter(r =>
      (r.usn && r.usn.toLowerCase().includes(q)) ||
      (r.studentName && r.studentName.toLowerCase().includes(q))
    );
  }

  if (filterSection !== 'ALL') {
    displayedRecords = displayedRecords.filter(r => r.section === filterSection);
  }

  if (filterStatus !== 'ALL') {
    displayedRecords = displayedRecords.filter(r => r.validationStatus === filterStatus);
  }

  // Sorting
  displayedRecords = [...displayedRecords].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const availableSections = Array.from(new Set((listData?.records || []).map(r => r.section).filter(Boolean))).sort();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Student List Converter
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#E65100]/10 text-[#E65100] border border-[#E65100]/20">
              Module B
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Standardizes heterogeneous student records (Excel, CSV, PDF, DOCX) and imports them to the Central Database.
          </p>
        </div>

        {listData && (
          <div className="flex items-center gap-2">
            <a
              href={api.getStudentListExportUrl(recordId, 'xlsx')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Standard Excel (.xlsx)</span>
            </a>
            <a
              href={api.getStudentListExportUrl(recordId, 'csv')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </a>
            <a
              href={api.getStudentListExportUrl(recordId, 'json')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </a>
          </div>
        )}
      </div>

      {/* Status Alert */}
      {message && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Upload Card (If no list currently loaded) */}
      {!listData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Upload className="w-5 h-5 text-[#E65100]" />
            <h2 className="text-sm font-bold text-slate-900">Step 1: Upload Department Student List</h2>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:bg-white"
                >
                  <option value="CSE">CSE - Computer Science</option>
                  <option value="ISE">ISE - Information Science</option>
                  <option value="ECE">ECE - Electronics & Comm.</option>
                  <option value="MECH">MECH - Mechanical Engg.</option>
                  <option value="CIVIL">CIVIL - Civil Engg.</option>
                  <option value="AIML">AIML - AI & Machine Learning</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Template</label>
                <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px] truncate">
                  5 Locked Columns (Sl No, USN, Name, Sec, Sem)
                </div>
              </div>
            </div>

            {/* Drag & Drop File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#E65100] rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-orange-50/20"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".xlsx,.xls,.csv,.pdf,.docx"
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-orange-100 text-[#E65100]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop student roster'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Supported formats: Excel (.xlsx, .xls), CSV, PDF (table), DOCX &bull; Max 50 MB
                </p>
                {selectedFile && (
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Ready to extract ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Automatic column synonym mapping &bull; Duplicate USN detector &bull; 5 Locked Columns
              </span>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="px-5 py-2.5 bg-[#E65100] hover:bg-[#C2410C] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting Records ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <span>Extract & Standardize Roster</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Converted Student List Workspace */}
      {listData && (
        <div className="space-y-6">
          {/* Header Summary & Actions Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {recordMeta?.originalFilename || 'Department Roster'}
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-100 text-slate-700">
                  Dept: {recordMeta?.department || department}
                </span>
                <span className="text-xs text-slate-500">
                  Sem: {listData.records?.[0]?.semester || 5}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span>Total Extracted: <strong>{listData.records?.length}</strong></span>
                <span>Valid: <strong className="text-emerald-700">{listData.summary?.validCount}</strong></span>
                <span>Duplicates: <strong className="text-amber-700">{listData.summary?.duplicateUsnCount}</strong></span>
                <span>Confidence: <strong>{Math.round((listData.summary?.confidenceScore || 0) * 100)}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {recordMeta?.status !== 'verified' ? (
                <button
                  onClick={handleVerify}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Roster</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified</span>
                </span>
              )}

              {isCOE && (
                <button
                  onClick={() => handleImportToCentral(false)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-bold shadow transition-colors"
                >
                  <Database className="w-4 h-4" />
                  <span>Import to Central Student DB</span>
                </button>
              )}

              <button
                onClick={() => {
                  setListData(null);
                  setSelectedFile(null);
                  setRecordId(null);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>

          {/* Duplicate USN Review Banner (Section 5 Step 3 Requirement: Never silently delete duplicates!) */}
          {listData.duplicateRecords?.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>
                  Administrator Review Required: {listData.duplicateRecords.length} duplicate USN record(s) detected!
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                ProTick does not silently discard duplicate records. Review the flagged entries in the table below to resolve or remove them before importing.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {listData.duplicateRecords.map(dup => (
                  <span key={dup.id} className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-900 font-bold">
                    USN: {dup.usn} ({dup.studentName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Table Search, Filters, and Add Record Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by USN or Student Name..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Section Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 font-medium">Section:</span>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Sections</option>
                    {availableSections.map(s => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                </div>

                {/* Validation Status Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Status</option>
                    <option value="valid">Valid Records</option>
                    <option value="duplicate">Duplicates</option>
                    <option value="error">Has Errors</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Student</span>
                </button>
              </div>
            </div>

            {/* Standard 5-Column Locked Table (Section 3.B: Serial Number, USN, Student Name, Section, Semester) */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider select-none">
                    <th
                      onClick={() => {
                        setSortField('serialNumber');
                        setSortAsc(sortField === 'serialNumber' ? !sortAsc : true);
                      }}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70"
                    >
                      <div className="flex items-center gap-1">
                        <span>1. Serial Number</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('usn');
                        setSortAsc(sortField === 'usn' ? !sortAsc : true);
                      }}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70"
                    >
                      <div className="flex items-center gap-1">
                        <span>2. USN</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('studentName');
                        setSortAsc(sortField === 'studentName' ? !sortAsc : true);
                      }}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70"
                    >
                      <div className="flex items-center gap-1">
                        <span>3. Student Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('section');
                        setSortAsc(sortField === 'section' ? !sortAsc : true);
                      }}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70"
                    >
                      <div className="flex items-center gap-1">
                        <span>4. Section</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('semester');
                        setSortAsc(sortField === 'semester' ? !sortAsc : true);
                      }}
                      className="py-3 px-3 cursor-pointer hover:bg-slate-200/70"
                    >
                      <div className="flex items-center gap-1">
                        <span>5. Semester</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecords.map((row) => {
                    const isEditing = editingRowId === row.id;
                    const isDuplicate = row.isDuplicate;
                    const hasError = row.validationErrors?.length > 0;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isDuplicate
                            ? 'bg-amber-50/70 hover:bg-amber-100/50'
                            : hasError
                            ? 'bg-rose-50/50 hover:bg-rose-100/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* 1. Serial Number */}
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-600">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editFormData.serialNumber || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, serialNumber: Number(e.target.value) })}
                              className="w-16 p-1 border rounded bg-white text-xs"
                            />
                          ) : (
                            row.serialNumber
                          )}
                        </td>

                        {/* 2. USN */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFormData.usn || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, usn: e.target.value.toUpperCase() })}
                              className="w-32 p-1 border rounded bg-white text-xs uppercase font-bold"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>{row.usn}</span>
                              {isDuplicate && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                  Duplicate
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. Student Name */}
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFormData.studentName || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, studentName: e.target.value })}
                              className="w-48 p-1 border rounded bg-white text-xs"
                            />
                          ) : (
                            row.studentName
                          )}
                        </td>

                        {/* 4. Section */}
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editFormData.section || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value.toUpperCase() })}
                              className="w-12 p-1 border rounded bg-white text-xs text-center"
                            />
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100">
                              {row.section}
                            </span>
                          )}
                        </td>

                        {/* 5. Semester */}
                        <td className="py-2.5 px-3 text-slate-700">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              max={8}
                              value={editFormData.semester || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, semester: Number(e.target.value) })}
                              className="w-16 p-1 border rounded bg-white text-xs text-center"
                            />
                          ) : (
                            `Semester ${row.semester}`
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => saveEditRow(row.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditRow}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEditRow(row)}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                title="Edit Row"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 hover:bg-rose-100 rounded text-rose-600"
                                title="Delete Row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {displayedRecords.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No student records match the search or filter criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Student */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Add Student Record to Standard Roster</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">USN (University Seat Number)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4MT21CS099"
                  value={newStudentData.usn}
                  onChange={(e) => setNewStudentData({ ...newStudentData, usn: e.target.value.toUpperCase() })}
                  className="w-full border rounded-lg p-2 font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={newStudentData.studentName}
                  onChange={(e) => setNewStudentData({ ...newStudentData, studentName: e.target.value })}
                  className="w-full border rounded-lg p-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    placeholder="A"
                    value={newStudentData.section}
                    onChange={(e) => setNewStudentData({ ...newStudentData, section: e.target.value.toUpperCase() })}
                    className="w-full border rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newStudentData.semester}
                    onChange={(e) => setNewStudentData({ ...newStudentData, semester: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg font-bold"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Central DB Import Conflict Dialog (Section 5 Step 5 Requirement: Never overwrite without confirmation) */}
      {conflictModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-2 text-amber-700 border-b pb-3">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">
                Central Database Conflict Warning &mdash; Administrator Confirmation Required
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              The following {conflictModalData.conflicts.length} student record(s) already exist in the institutional Central Student Database. Confirm whether you want to overwrite their existing records or preserve the current records.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50 text-xs">
              {conflictModalData.conflicts.map((c, idx) => (
                <div key={idx} className="p-3 bg-white rounded border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between font-mono font-bold text-slate-800">
                    <span>USN: {c.existing.usn}</span>
                    <span className="text-[10px] text-slate-400">Conflict #{idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-slate-50 rounded border">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Current in Central DB</div>
                      <div className="font-semibold">{c.existing.studentName}</div>
                      <div>Dept: {c.existing.department} | Sec: {c.existing.section} | Sem: {c.existing.semester}</div>
                    </div>
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-950">
                      <div className="text-[10px] uppercase font-bold text-amber-700">Incoming from Upload</div>
                      <div className="font-semibold">{c.incoming.studentName}</div>
                      <div>Dept: {c.incoming.department} | Sec: {c.incoming.section} | Sem: {c.incoming.semester}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t flex items-center justify-between">
              <button
                onClick={() => setConflictModalData(null)}
                className="px-3 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-xs"
              >
                Cancel Import
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleImportToCentral(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
                >
                  Skip Conflicted (Import New Only)
                </button>
                <button
                  onClick={() => handleImportToCentral(true)}
                  className="px-4 py-2 bg-[#E65100] hover:bg-[#C2410C] text-white rounded-lg text-xs font-bold shadow"
                >
                  Overwrite Existing Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
