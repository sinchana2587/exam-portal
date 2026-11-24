// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/converterApi';
import { useAuth } from '../../hooks/useAuth';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  Copy,
  ArrowRightLeft,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Eye,
  X,
  Code,
  HelpCircle,
  FolderPlus,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export function QuestionPaperConverterPage({ initialRecordId = null }) {
  const { user } = useAuth();
  const isCOE = (user?.role as string) === 'COE';
  const activeDept = user?.departmentCode || 'CSE';

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [department, setDepartment] = useState(activeDept === 'ALL' ? 'CSE' : activeDept);
  const [semester, setSemester] = useState(5);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Active converted paper state
  const [recordId, setRecordId] = useState(initialRecordId);
  const [paperData, setPaperData] = useState(null);
  const [recordMeta, setRecordMeta] = useState(null);
  const [activeModuleNumber, setActiveModuleNumber] = useState(1);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  // Image upload modal / input
  const [uploadingImageFor, setUploadingImageFor] = useState(null); // { questionId, target: 'question' | 'A' | 'B' | 'C' | 'D' }
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Load initial record if passed
  useEffect(() => {
    if (initialRecordId) {
      loadPaperRecord(initialRecordId);
    }
  }, [initialRecordId]);

  const loadPaperRecord = async (id) => {
    try {
      setLoadingRecord(true);
      const res = await api.getQuestionPaper(id);
      if (res.success) {
        setRecordId(id);
        setPaperData(res.data.paper);
        setRecordMeta(res.data.record);
        if (res.data.paper.modules?.length > 0) {
          setActiveModuleNumber(res.data.paper.modules[0].moduleNumber);
          if (res.data.paper.modules[0].questions?.length > 0) {
            setSelectedQuestionId(res.data.paper.modules[0].questions[0].questionId);
          }
        }
      }
    } catch (err) {
      console.error('Error loading question paper:', err);
    } finally {
      setLoadingRecord(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please choose a question paper document (.pdf or .docx).' });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(20);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('department', department);
      formData.append('semester', semester);
      formData.append('subjectName', subjectName);
      formData.append('subjectCode', subjectCode);

      setUploadProgress(60);
      const res = await api.uploadQuestionPaper(formData);
      setUploadProgress(100);

      if (res.success) {
        setRecordId(res.data.recordId);
        setPaperData(res.data.paper);
        setRecordMeta(res.data.record);
        if (res.data.paper.modules?.length > 0) {
          setActiveModuleNumber(res.data.paper.modules[0].moduleNumber);
          if (res.data.paper.modules[0].questions?.length > 0) {
            setSelectedQuestionId(res.data.paper.modules[0].questions[0].questionId);
          }
        }
        setMessage({ type: 'success', text: 'Question paper successfully converted into COE standard format!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Failed to convert question paper' });
    } finally {
      setUploading(false);
    }
  };

  // Active module & questions
  const activeModule = paperData?.modules?.find(m => m.moduleNumber === activeModuleNumber) || paperData?.modules?.[0];
  const activeQuestions = activeModule?.questions || [];
  const selectedQuestion = activeQuestions.find(q => q.questionId === selectedQuestionId) || activeQuestions[0];

  // Actions on Questions
  const handleUpdateQuestion = async (updatedFields) => {
    if (!selectedQuestion) return;
    try {
      const res = await api.updateQuestion(recordId, selectedQuestion.questionId, updatedFields);
      if (res.success) {
        setPaperData(res.data);
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const handleAddQuestion = async () => {
    try {
      const res = await api.addQuestion(recordId, activeModuleNumber, {
        questionText: 'New question statement...',
        options: {
          A: { text: 'Option A text', image: null },
          B: { text: 'Option B text', image: null },
          C: { text: 'Option C text', image: null },
          D: { text: 'Option D text', image: null }
        },
        correctAnswer: null
      });
      if (res.success) {
        setPaperData(res.data.paper);
        setSelectedQuestionId(res.data.newQuestion.questionId);
      }
    } catch (err) {
      console.error('Add question error:', err);
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await api.deleteQuestion(recordId, qId);
      if (res.success) {
        setPaperData(res.data);
        const remaining = res.data.modules.find(m => m.moduleNumber === activeModuleNumber)?.questions || [];
        setSelectedQuestionId(remaining[0]?.questionId || null);
      }
    } catch (err) {
      console.error('Delete question error:', err);
    }
  };

  const handleDuplicateQuestion = async (qId) => {
    try {
      const res = await api.duplicateQuestion(recordId, qId);
      if (res.success) {
        setPaperData(res.data);
      }
    } catch (err) {
      console.error('Duplicate question error:', err);
    }
  };

  const handleMoveQuestion = async (qId, targetMod) => {
    try {
      const res = await api.moveQuestion(recordId, qId, targetMod);
      if (res.success) {
        setPaperData(res.data);
        setActiveModuleNumber(Number(targetMod));
      }
    } catch (err) {
      console.error('Move question error:', err);
    }
  };

  const handleAddModule = async () => {
    const title = window.prompt('Enter new Module Title:', `Module ${(paperData?.modules?.length || 0) + 1}`);
    if (!title) return;
    try {
      const res = await api.addModule(recordId, title);
      if (res.success) {
        setPaperData(res.data);
        const lastMod = res.data.modules[res.data.modules.length - 1];
        setActiveModuleNumber(lastMod.moduleNumber);
      }
    } catch (err) {
      console.error('Add module error:', err);
    }
  };

  const handleDeleteModule = async (modNum) => {
    if (!window.confirm(`Delete Module ${modNum} and all its questions?`)) return;
    try {
      const res = await api.deleteModule(recordId, modNum);
      if (res.success) {
        setPaperData(res.data);
        if (res.data.modules.length > 0) {
          setActiveModuleNumber(res.data.modules[0].moduleNumber);
        }
      }
    } catch (err) {
      console.error('Delete module error:', err);
    }
  };

  // Image Upload Handling
  const triggerImageUpload = (questionId, target) => {
    setUploadingImageFor({ questionId, target });
    if (imageInputRef.current) {
      imageInputRef.current.value = null;
      imageInputRef.current.click();
    }
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingImageFor || !selectedQuestion) return;

    try {
      const res = await api.uploadMediaImage(file);
      if (res.success) {
        const imageUrl = res.data.url;
        if (uploadingImageFor.target === 'question') {
          handleUpdateQuestion({ questionImage: imageUrl });
        } else {
          // Option A, B, C, D
          const optKey = uploadingImageFor.target;
          const updatedOptions = {
            ...selectedQuestion.options,
            [optKey]: {
              ...selectedQuestion.options[optKey],
              image: imageUrl
            }
          };
          handleUpdateQuestion({ options: updatedOptions });
        }
        setMessage({ type: 'success', text: `Image uploaded and linked to ${uploadingImageFor.target === 'question' ? 'question' : `Option ${uploadingImageFor.target}`}.` });
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      setMessage({ type: 'error', text: 'Image upload failed. Ensure file is a valid image format.' });
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleRemoveImage = (target) => {
    if (!selectedQuestion) return;
    if (target === 'question') {
      handleUpdateQuestion({ questionImage: null });
    } else {
      const updatedOptions = {
        ...selectedQuestion.options,
        [target]: {
          ...selectedQuestion.options[target],
          image: null
        }
      };
      handleUpdateQuestion({ options: updatedOptions });
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      const res = await api.verifyQuestionPaper(recordId);
      if (res.success) {
        setRecordMeta(res.data.record);
        setPaperData(res.data.paper);
        setMessage({ type: 'success', text: 'Question Paper verified & approved for standard portal integration!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hidden image input for independent image uploads */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Question Paper Converter
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1A237E]/10 text-[#1A237E] border border-[#1A237E]/20">
              Module A
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Extracts heterogeneous departmental question papers into the COE-established standard format with dynamic modules.
          </p>
        </div>

        {paperData && (
          <div className="flex items-center gap-2">
            <a
              href={api.getQuestionPaperExportUrl(recordId, 'xlsx')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Standard Excel (.xlsx)</span>
            </a>
            <a
              href={api.getQuestionPaperExportUrl(recordId, 'json')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Portal JSON</span>
            </a>
            <a
              href={api.getQuestionPaperExportUrl(recordId, 'csv')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </a>
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
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Upload Card (If no paper loaded or to upload new) */}
      {!paperData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Upload className="w-5 h-5 text-[#1A237E]" />
            <h2 className="text-sm font-bold text-slate-900">Step 1: Upload Department Question Paper</h2>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
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
                <label className="block font-semibold text-slate-700 mb-1">Subject Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Networks"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 21CS51"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:bg-white uppercase"
                />
              </div>
            </div>

            {/* Drag & Drop File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#1A237E] rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.docx,.doc"
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-blue-100 text-[#1A237E]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop question paper'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Supported formats: Digital PDF, Scanned PDF (OCR enabled), DOCX, DOC &bull; Max 50 MB
                </p>
                {selectedFile && (
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Ready to convert ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                12-Step Intelligent Engine: Layout Parsing &bull; OCR Fallback &bull; Dynamic Module Detection
              </span>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="px-5 py-2.5 bg-[#1A237E] hover:bg-[#0D1442] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Document ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <span>Execute Conversion Engine</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Converted Paper Workspace */}
      {paperData && (
        <div className="space-y-6">
          {/* Verification Bar & Paper Header Metadata */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {paperData.metadata?.subjectName || 'Question Paper'}
                </span>
                {paperData.metadata?.subjectCode && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                    {paperData.metadata.subjectCode}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Sem: {paperData.metadata?.semester || 5} &bull; Dept: {recordMeta?.department || 'CSE'}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span>Total Modules: <strong>{paperData.modules?.length}</strong></span>
                <span>Total Questions: <strong>{paperData.verification?.totalQuestions}</strong></span>
                <span>Confidence: <strong>{Math.round((paperData.verification?.confidenceScore || 0) * 100)}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {recordMeta?.status === 'verified' ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Approved & Verified by COE</span>
                </span>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>{verifying ? 'Verifying...' : 'Verify & Approve Paper'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setPaperData(null);
                  setSelectedFile(null);
                  setRecordId(null);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Upload Another Paper
              </button>
            </div>
          </div>

          {/* Verification Warning Alert Bar */}
          {paperData.verification && (
            <div className={`p-4 rounded-xl border text-xs ${
              paperData.verification.isVerificationReady
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}>
              <div className="font-bold flex items-center gap-2 mb-1.5">
                {paperData.verification.isVerificationReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>COE Verification Passed: All questions have complete text, 4 options, and module assignments.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Verification Checklist &mdash; Manual corrections can be made directly in the editor below:</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 font-medium">
                <div className={`p-2 rounded border ${paperData.verification.missingQuestionText > 0 ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-white border-slate-200'}`}>
                  Missing Text: {paperData.verification.missingQuestionText}
                </div>
                <div className={`p-2 rounded border ${paperData.verification.missingOptions > 0 ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold' : 'bg-white border-slate-200'}`}>
                  Missing Options: {paperData.verification.missingOptions}
                </div>
                <div className={`p-2 rounded border ${paperData.verification.missingAnswers > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200'}`}>
                  Unspecified Answers: {paperData.verification.missingAnswers}
                </div>
                <div className={`p-2 rounded border ${paperData.verification.duplicateQuestionNumbers > 0 ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-white border-slate-200'}`}>
                  Duplicate Q#: {paperData.verification.duplicateQuestionNumbers}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Dynamic Module Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 rounded-t-xl pt-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {paperData.modules?.map((mod) => {
                const isActive = mod.moduleNumber === activeModuleNumber;
                return (
                  <button
                    key={mod.moduleNumber}
                    onClick={() => {
                      setActiveModuleNumber(mod.moduleNumber);
                      if (mod.questions?.length > 0) {
                        setSelectedQuestionId(mod.questions[0].questionId);
                      }
                    }}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? 'border-[#1A237E] text-[#1A237E] bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{mod.title || `Module ${mod.moduleNumber}`}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-[#1A237E] text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {mod.questions?.length || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={handleAddModule}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                title="Add a new dynamic module section"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add Module</span>
              </button>
              {paperData.modules?.length > 1 && (
                <button
                  onClick={() => handleDeleteModule(activeModuleNumber)}
                  className="text-xs text-rose-600 hover:text-rose-800 p-1"
                  title="Delete active module"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Step 4 & 5: Standard Question Editor (Split View: Question List + Rich Editor) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Questions in Module */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Questions in Module {activeModuleNumber} ({activeQuestions.length})
                </span>
                <button
                  onClick={handleAddQuestion}
                  className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-[#1A237E] hover:bg-[#0D1442] text-white rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {activeQuestions.map((q, idx) => {
                  const isSelected = q.questionId === selectedQuestionId;
                  const hasError = q.validationErrors?.length > 0;
                  return (
                    <div
                      key={q.questionId}
                      onClick={() => setSelectedQuestionId(q.questionId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#1A237E] bg-blue-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            isSelected ? 'bg-[#1A237E] text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            Q{q.questionNumber}
                          </span>
                          {q.correctAnswer ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Ans: {q.correctAnswer}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                              No Ans
                            </span>
                          )}
                          {q.questionImage && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded flex items-center gap-0.5">
                              <ImageIcon className="w-3 h-3" />
                              <span>Img</span>
                            </span>
                          )}
                        </div>

                        {hasError && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                      </div>

                      <div className="text-slate-800 font-medium line-clamp-2">
                        {q.questionText || '<No question text>'}
                      </div>
                    </div>
                  );
                })}

                {activeQuestions.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No questions in Module {activeModuleNumber}. Click "Add Question" to create one.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Question & Option Structured Editor */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              {selectedQuestion ? (
                <>
                  {/* Question Controls Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded text-slate-800">
                        Question #{selectedQuestion.questionNumber}
                      </span>
                      <span className="text-xs text-slate-500">Module {selectedQuestion.moduleNumber}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Move to another module */}
                      <div className="flex items-center gap-1 text-xs">
                        <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500 text-[11px]">Move to:</span>
                        <select
                          value={selectedQuestion.moduleNumber}
                          onChange={(e) => handleMoveQuestion(selectedQuestion.questionId, e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                        >
                          {paperData.modules?.map(m => (
                            <option key={m.moduleNumber} value={m.moduleNumber}>
                              Module {m.moduleNumber}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleDuplicateQuestion(selectedQuestion.questionId)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                        title="Duplicate Question"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteQuestion(selectedQuestion.questionId)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded"
                        title="Delete Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Section: Rich Text Editor & Image */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Question Text & Code Snippet
                      </label>
                      <button
                        onClick={() => triggerImageUpload(selectedQuestion.questionId, 'question')}
                        className="flex items-center gap-1 text-xs text-[#1A237E] font-semibold hover:underline"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{selectedQuestion.questionImage ? 'Replace Question Image' : 'Add Question Image / Diagram'}</span>
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      value={selectedQuestion.questionText || ''}
                      onChange={(e) => handleUpdateQuestion({ questionText: e.target.value })}
                      placeholder="Type question text here. Mathematical expressions and code snippets (```code```) are supported..."
                      className="w-full bg-slate-50 focus:bg-white border border-slate-300 rounded-lg p-3 text-xs md:text-sm font-sans focus:ring-1 focus:ring-[#1A237E]"
                    />

                    {/* Question Image Preview */}
                    {selectedQuestion.questionImage && (
                      <div className="relative inline-block border border-slate-200 rounded-lg p-2 bg-slate-50">
                        <img
                          src={selectedQuestion.questionImage}
                          alt="Question Media"
                          className="max-h-48 rounded object-contain"
                        />
                        <button
                          onClick={() => handleRemoveImage('question')}
                          className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Option Section: 4 Independent Options (A, B, C, D) */}
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Answer Options (4 Independent Options)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Each option supports text and/or independent diagram image
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['A', 'B', 'C', 'D'].map((key) => {
                        const opt = selectedQuestion.options?.[key] || { text: '', image: null };
                        const isCorrect = selectedQuestion.correctAnswer === key;

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border transition-all space-y-2 ${
                              isCorrect ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {key}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => triggerImageUpload(selectedQuestion.questionId, key)}
                                  className="text-[11px] font-semibold text-[#1A237E] hover:underline flex items-center gap-1"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{opt.image ? 'Replace Img' : 'Upload Img'}</span>
                                </button>
                                {opt.image && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(key)}
                                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                                  >
                                    Remove Img
                                  </button>
                                )}
                              </div>
                            </div>

                            <input
                              type="text"
                              value={opt.text || ''}
                              onChange={(e) => {
                                const newOpts = {
                                  ...selectedQuestion.options,
                                  [key]: { ...opt, text: e.target.value }
                                };
                                handleUpdateQuestion({ options: newOpts });
                              }}
                              placeholder={`Option ${key} text...`}
                              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-[#1A237E]"
                            />

                            {opt.image && (
                              <div className="pt-1">
                                <img
                                  src={opt.image}
                                  alt={`Option ${key}`}
                                  className="h-16 rounded border border-slate-200 object-contain bg-white"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Answer Section: Dropdown A, B, C, D */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                        Correct Answer Key
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Accepts only A, B, C, or D. Leave unselected if not clearly stated in source.
                      </p>
                    </div>

                    <select
                      value={selectedQuestion.correctAnswer || ''}
                      onChange={(e) => handleUpdateQuestion({ correctAnswer: e.target.value || null })}
                      className="bg-white border-2 border-[#1A237E] text-slate-900 rounded-lg px-4 py-2 text-xs font-bold shadow-sm"
                    >
                      <option value="">-- No Answer Assigned --</option>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Select a question from the left column to view and edit.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
