import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Database,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Edit2,
  Users,
  Building2,
  CheckCircle2,
  X,
  RefreshCw
} from 'lucide-react';

export function CentralStudentDatabasePage() {
  const { isCOE, department: activeDept, departments } = useAuth();

  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(isCOE ? 'ALL' : activeDept);
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    usn: '',
    studentName: '',
    section: 'A',
    semester: 1,
    department: 'CSE'
  });

  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchCentralStudents();
  }, [searchQuery, selectedDept, selectedSemester, selectedSection]);

  const fetchCentralStudents = async () => {
    try {
      setLoading(true);
      const filter = {
        department: selectedDept !== 'ALL' ? selectedDept : undefined,
        semester: selectedSemester !== 'ALL' ? selectedSemester : undefined,
        section: selectedSection !== 'ALL' ? selectedSection : undefined,
        search: searchQuery || undefined
      };
      const res = await api.getCentralStudents(filter);
      if (res.success) {
        setStudents(res.data.students);
        setTotalCount(res.data.total);
      }
    } catch (err) {
      console.error('Error fetching central students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        const res = await api.updateCentralStudent(editingStudent.id, studentForm);
        if (res.success) {
          setMessage({ type: 'success', text: `Student ${studentForm.usn} updated.` });
        }
      } else {
        const res = await api.addCentralStudent(studentForm);
        if (res.success) {
          setMessage({ type: 'success', text: `Student ${studentForm.usn} registered in Central DB.` });
        }
      }
      setShowAddModal(false);
      setEditingStudent(null);
      setStudentForm({ usn: '', studentName: '', section: 'A', semester: 1, department: 'CSE' });
      fetchCentralStudents();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message });
    }
  };

  const handleDelete = async (id, usn) => {
    if (!window.confirm(`Are you sure you want to remove student ${usn} from the Central Database?`)) return;
    try {
      const res = await api.deleteCentralStudent(id);
      if (res.success) {
        setMessage({ type: 'success', text: `Student ${usn} removed.` });
        fetchCentralStudents();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const startEdit = (student) => {
    setEditingStudent(student);
    setStudentForm({
      usn: student.usn,
      studentName: student.studentName,
      section: student.section,
      semester: student.semester,
      department: student.department
    });
    setShowAddModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Central Student Database
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1A237E]/10 text-[#1A237E] border border-[#1A237E]/20">
              Master Roster
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Institutional student repository across departments. Preserves department attribution, USN keys, and handles sync conflicts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.getCentralExportUrl('xlsx', { department: selectedDept, semester: selectedSemester })}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Master Excel</span>
          </a>
          <a
            href={api.getCentralExportUrl('csv', { department: selectedDept, semester: selectedSemester })}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </a>
          {isCOE && (
            <button
              onClick={() => {
                setEditingStudent(null);
                setStudentForm({ usn: '', studentName: '', section: 'A', semester: 1, department: 'CSE' });
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Student</span>
            </button>
          )}
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

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by USN or Student Name..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Department Filter */}
            {isCOE && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Dept:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d.code} value={d.code}>{d.code}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Semester Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-500 font-medium">Semester:</span>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-500 font-medium">Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Sections</option>
                {['A', 'B', 'C', 'D'].map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Database Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Sl No</th>
                <th className="py-2.5 px-3">USN</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Section</th>
                <th className="py-2.5 px-3">Semester</th>
                <th className="py-2.5 px-3">Registered On</th>
                {isCOE && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s, idx) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-500">{s.serialNumber || (idx + 1)}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.usn}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{s.studentName}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono px-2 py-0.5 rounded bg-blue-50 font-bold text-[#1A237E] border border-blue-200">
                      {s.department}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Section {s.section}</td>
                  <td className="py-2.5 px-3 text-slate-700">Semester {s.semester}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    {s.importDate ? new Date(s.importDate).toLocaleDateString() : 'N/A'}
                  </td>
                  {isCOE && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(s)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.usn)}
                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {students.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-xs">
              No students found in Central Database. Import records from the Student List Converter or register manually.
            </div>
          )}
        </div>
      </div>

      {/* Register / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingStudent ? `Edit Student (${editingStudent.usn})` : 'Register New Student in Central DB'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">USN</label>
                <input
                  type="text"
                  required
                  disabled={!!editingStudent}
                  placeholder="e.g. 4MT21CS001"
                  value={studentForm.usn}
                  onChange={(e) => setStudentForm({ ...studentForm, usn: e.target.value.toUpperCase() })}
                  className="w-full border rounded-lg p-2 font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Student Full Name"
                  value={studentForm.studentName}
                  onChange={(e) => setStudentForm({ ...studentForm, studentName: e.target.value })}
                  className="w-full border rounded-lg p-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    className="w-full border rounded-lg p-2 font-bold"
                  >
                    {departments.map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value.toUpperCase() })}
                    className="w-full border rounded-lg p-2 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={studentForm.semester}
                    onChange={(e) => setStudentForm({ ...studentForm, semester: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-bold text-center"
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
                  {editingStudent ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
