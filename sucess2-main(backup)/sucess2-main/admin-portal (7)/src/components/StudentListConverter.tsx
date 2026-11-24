import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Info,
  Layers,
  ArrowRight,
  FileText,
  FileCheck,
  ShieldCheck,
  HelpCircle,
  Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHodSemester } from '../hooks/useHodSemester';
import {
  extractBrowserDocumentContent,
  ExtractedTextLine,
  BrowserDocumentError,
  ConversionProgressEvent
} from '../utils/browserPdfOcr';
import {
  normalizeDobValue,
  isValidIsoDob
} from '../utils/browserStudentConverter';
import { buildStudentWorkbookBlob } from '../utils/browserExcelService';
import { triggerBlobDownload } from '../utils/exportUtils';

export type ConverterStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface EditableStudentRow {
  id: string;
  rowNumber: number;
  usn: string;
  studentName: string;
  dob: string;
  confidence: number;
  uncertain: boolean;
  ocrAmbiguities: string[];
  suggestedFix?: { field: 'usn' | 'dob'; original: string; replacement: string };
  errors: string[];
  isValid: boolean;
}

export const StudentListConverter: React.FC = () => {
  const { user } = useAuth();
  const { selectedSemester } = useHodSemester();

  // Wizard Stage State
  const [stage, setStage] = useState<ConverterStage>(1);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress & Processing State
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const cancelExtractionRef = useRef<boolean>(false);

  // Extracted Student Records State (Strictly 3 fields: USN | Student Name | DOB)
  const [rows, setRows] = useState<EditableStudentRow[]>([]);
  const [originalExtractedLines, setOriginalExtractedLines] = useState<ExtractedTextLine[]>([]);

  // Document Preview State
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Manual Column Mapping Fallback
  const [showManualMapping, setShowManualMapping] = useState<boolean>(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [manualColMap, setManualColMap] = useState<{ usn: number; name: number; dob: number }>({
    usn: 0,
    name: 1,
    dob: 2,
  });

  // Excel Generation & Download State
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState<boolean>(false);
  const [exportedCount, setExportedCount] = useState<number>(0);
  const exportFilename = 'MITM_Student_List_Converted.xlsx';

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewImageSrc && previewImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previewImageSrc);
      }
    };
  }, [previewImageSrc]);

  // Stage definition for visual wizard stepper
  const STAGES = [
    { num: 1, label: 'Upload Document', icon: UploadCloud },
    { num: 2, label: 'Extract Student Data', icon: Layers },
    { num: 3, label: 'Review & Correct', icon: FileText },
    { num: 4, label: 'Validate Records', icon: FileCheck },
    { num: 5, label: 'Generate Excel', icon: FileSpreadsheet },
    { num: 6, label: 'Download & Handoff', icon: Download },
  ];

  // Helper to detect OCR character confusion (0 vs O, 1 vs I, 5 vs S, 8 vs B)
  const analyzeOcrAmbiguities = (usn: string, dob: string): { ambiguities: string[]; fix?: { field: 'usn' | 'dob'; original: string; replacement: string } } => {
    const ambiguities: string[] = [];
    let fix: { field: 'usn' | 'dob'; original: string; replacement: string } | undefined;

    // Check USN for 'O' in trailing digits (e.g. 4MH21CS00O -> 0)
    if (/^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9O]{1,3}$/i.test(usn) && /O/i.test(usn.slice(7))) {
      ambiguities.push("Possible letter 'O' detected in numeric USN suffix (likely '0')");
      fix = { field: 'usn', original: usn, replacement: usn.slice(0, 7) + usn.slice(7).replace(/O/gi, '0') };
    } else if (/[0-9][A-Z]{2}[0-9O]{2}[A-Z]{2,3}/i.test(usn) && /O/i.test(usn.slice(3, 5))) {
      ambiguities.push("Possible letter 'O' detected in year digits (likely '0')");
      fix = { field: 'usn', original: usn, replacement: usn.slice(0, 3) + usn.slice(3, 5).replace(/O/gi, '0') + usn.slice(5) };
    }

    // Check USN for 'I' or 'L' in digits
    if (/[0-9][A-Z]{2}[0-9IL]{2}[A-Z]{2,3}/i.test(usn) && /[IL]/i.test(usn.slice(3, 5))) {
      ambiguities.push("Possible letter 'I' or 'L' detected in year digits (likely '1')");
      fix = { field: 'usn', original: usn, replacement: usn.slice(0, 3) + usn.slice(3, 5).replace(/[IL]/gi, '1') + usn.slice(5) };
    }

    // Check DOB for 'O' in numbers
    if (/[O]/i.test(dob)) {
      ambiguities.push("Letter 'O' found in date string (likely digit '0')");
      if (!fix) {
        fix = { field: 'dob', original: dob, replacement: dob.replace(/O/gi, '0') };
      }
    }

    return { ambiguities, fix };
  };

  // Revalidate an array of student rows
  const validateStudentRows = useCallback((rawRows: { id: string; rowNumber: number; usn: string; studentName: string; dob: string; confidence: number }[]): EditableStudentRow[] => {
    const usnCounts = new Map<string, number>();
    for (const r of rawRows) {
      const clean = r.usn.trim().toUpperCase();
      if (clean) {
        usnCounts.set(clean, (usnCounts.get(clean) || 0) + 1);
      }
    }

    return rawRows.map((r, idx) => {
      const usn = r.usn.trim().toUpperCase();
      const studentName = r.studentName.trim();
      const rawDob = r.dob.trim();
      const { normalized: dobNormalized, suggestedCorrection } = normalizeDobValue(rawDob);

      const errors: string[] = [];

      // USN Validation: Required, Trim whitespace, Duplicate check. Do not impose unsupported patterns.
      if (!usn) {
        errors.push('USN is required');
      } else if ((usnCounts.get(usn) || 0) > 1) {
        errors.push(`Duplicate USN "${usn}" in uploaded file`);
      }

      // Student Name Validation: Required, Preserve actual name
      if (!studentName) {
        errors.push('Student Name is required');
      }

      // DOB Validation: Required, Valid calendar date, No future dates, Normalize
      if (!rawDob) {
        errors.push('Date of Birth (DOB) is required');
      } else if (!isValidIsoDob(dobNormalized)) {
        errors.push(`Invalid calendar date "${rawDob}" (expected DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD not in future)`);
      }

      const { ambiguities, fix } = analyzeOcrAmbiguities(usn, rawDob);
      const isLowConfidence = r.confidence > 0 && r.confidence < 75;
      const uncertain = errors.length > 0 || isLowConfidence || ambiguities.length > 0;
      const isValid = errors.length === 0;

      return {
        id: r.id || `row-${idx + 1}-${Date.now()}`,
        rowNumber: idx + 1,
        usn,
        studentName,
        dob: dobNormalized || rawDob,
        confidence: r.confidence || 95,
        uncertain,
        ocrAmbiguities: ambiguities,
        suggestedFix: fix,
        errors,
        isValid,
      };
    });
  }, []);

  // Handle file selection
  const handleFileChange = async (file: File) => {
    setFileError(null);
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isSupported = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      setFileError('Unsupported file format. Please upload a PDF, JPG, JPEG, PNG, or WebP document.');
      return;
    }

    if (file.size > 45 * 1024 * 1024) {
      setFileError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 45 MB browser processing safeguard.`);
      return;
    }

    setSelectedFile(file);

    // If PDF, detect page count locally
    if (lowerName.endsWith('.pdf')) {
      try {
        const { getDocument } = await import('pdfjs-dist');
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf/pdf.worker.min.mjs';
        const arrayBuf = await file.arrayBuffer();
        const doc = await getDocument({ data: arrayBuf }).promise;
        pdfDocRef.current = doc;
        setPdfPageCount(doc.numPages);
        setTotalPages(doc.numPages);
      } catch (e) {
        console.warn('PDF page count inspection warning:', e);
        setPdfPageCount(1);
        setTotalPages(1);
      }
    } else {
      setPdfPageCount(1);
      setTotalPages(1);
      const objUrl = URL.createObjectURL(file);
      setPreviewImageSrc(objUrl);
    }
  };

  // Render current PDF page to canvas
  const renderPdfPage = async (pageNum: number, scale = 1.0) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale * 1.3 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.warn('Page render error:', e);
    }
  };

  useEffect(() => {
    if (pdfDocRef.current && (stage === 3 || stage === 4)) {
      renderPdfPage(previewPage, zoomLevel);
    }
  }, [previewPage, zoomLevel, stage]);

  // Stage 2: Execute Client-Side Text Extraction & Local OCR
  const startExtraction = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setStage(2);
    setProgressPercent(5);
    setProgressMessage('Validating document integrity locally in browser...');
    cancelExtractionRef.current = false;
    setExtractionWarnings([]);

    try {
      const extractedContent = await extractBrowserDocumentContent({
        file: selectedFile,
        extractDiagramRegionsFromRaster: false,
        onProgress: (ev: ConversionProgressEvent) => {
          if (cancelExtractionRef.current) return;
          setProgressPercent(ev.percent);
          setProgressMessage(ev.message);
        },
      });

      if (cancelExtractionRef.current) {
        setIsExtracting(false);
        setStage(1);
        return;
      }

      setOriginalExtractedLines(extractedContent.lines);
      if (extractedContent.warnings.length > 0) {
        setExtractionWarnings(extractedContent.warnings);
      }

      // Reconstruct table rows
      setProgressPercent(92);
      setProgressMessage('Reconstructing student table rows from spatial coordinates...');

      const rawExtractedRows: { id: string; rowNumber: number; usn: string; studentName: string; dob: string; confidence: number }[] = [];

      // Identify header line
      let headerIdx = -1;
      for (let i = 0; i < extractedContent.lines.length; i++) {
        const text = extractedContent.lines[i].text.toLowerCase();
        if (
          (text.includes('usn') || text.includes('seat') || text.includes('roll') || text.includes('register')) &&
          (text.includes('name') || text.includes('student'))
        ) {
          headerIdx = i;
          break;
        }
      }

      const startIndex = headerIdx !== -1 ? headerIdx + 1 : 0;

      for (let i = startIndex; i < extractedContent.lines.length; i++) {
        const ln = extractedContent.lines[i];
        const lower = ln.text.toLowerCase();

        // Skip repeated headers and metadata lines
        if (
          lower.includes('page ') ||
          lower.includes('department of') ||
          lower.includes('maharaja institute') ||
          lower.includes('sl.no') ||
          (lower.includes('usn') && lower.includes('name'))
        ) {
          continue;
        }

        // Token-based parsing using spatial X positions
        let usn = '';
        let studentName = '';
        let dob = '';

        if (ln.tokens && ln.tokens.length >= 2) {
          // Identify USN token: matches alphanumeric pattern
          const usnTok = ln.tokens.find((t) => /\b\d[A-Z]{2}\d{2}[A-Z]{2,3}\d{2,3}\b/i.test(t.text) || /^4MH/i.test(t.text));
          // Identify DOB token: matches date pattern
          const dobTok = ln.tokens.find((t) => /\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/.test(t.text) || /\b(19|20)\d{2}\b/.test(t.text));

          if (usnTok) usn = usnTok.text;
          if (dobTok) dob = dobTok.text;

          // Name is composed of remaining tokens between or around USN/DOB
          const nameTokens = ln.tokens.filter((t) => t !== usnTok && t !== dobTok && !/^\d{1,3}\.?$/.test(t.text.trim()));
          studentName = nameTokens.map((t) => t.text).join(' ').trim();
        }

        // Fallback to text splitting if tokens didn't extract clean columns
        if (!usn || !studentName) {
          let lineText = ln.text.trim().replace(/^\d{1,3}[.)]\s+/, '');
          // Look for date at the end
          const dateMatch = lineText.match(/(\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4})\s*$/);
          if (dateMatch) {
            dob = dateMatch[1];
            lineText = lineText.slice(0, dateMatch.index).trim();
          }

          // Look for USN pattern
          const usnMatch = lineText.match(/(\b\d[A-Z]{2}\d{2}[A-Z]{2,3}\d{2,3}\b|4MH\w+)/i);
          if (usnMatch) {
            usn = usnMatch[1];
            studentName = lineText.replace(usnMatch[0], '').trim();
          } else {
            // First token as USN, remainder as Name
            const parts = lineText.split(/\s+/);
            if (parts.length >= 2) {
              usn = parts[0];
              studentName = parts.slice(1).join(' ');
            }
          }
        }

        if (usn || studentName || dob) {
          rawExtractedRows.push({
            id: `row-${rawExtractedRows.length + 1}-${Date.now()}`,
            rowNumber: rawExtractedRows.length + 1,
            usn: usn.toUpperCase(),
            studentName,
            dob,
            confidence: ln.confidence || 95,
          });
        }
      }

      const validated = validateStudentRows(rawExtractedRows);
      setRows(validated);
      setProgressPercent(100);
      setProgressMessage('Extraction and row reconstruction complete.');

      // Proceed directly to Stage 3 (Review & Correct)
      setTimeout(() => {
        setIsExtracting(false);
        setStage(3);
      }, 400);

    } catch (err: any) {
      console.error('Client-side extraction error:', err);
      setIsExtracting(false);
      setFileError(err.message || 'An error occurred during local document extraction.');
      setStage(1);
    }
  };

  // Cancel running extraction
  const cancelExtraction = () => {
    cancelExtractionRef.current = true;
    setIsExtracting(false);
    setStage(1);
    setProgressMessage('Extraction cancelled by user.');
  };

  // Row editing handlers
  const handleUpdateRow = (id: string, field: 'usn' | 'studentName' | 'dob', value: string) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    setRows(validateStudentRows(updated));
  };

  const handleApplyFix = (id: string, field: 'usn' | 'dob', fixedValue: string) => {
    handleUpdateRow(id, field, fixedValue);
  };

  const handleAddRow = () => {
    const newRow = {
      id: `row-${rows.length + 1}-${Date.now()}`,
      rowNumber: rows.length + 1,
      usn: '',
      studentName: '',
      dob: '',
      confidence: 100,
    };
    setRows(validateStudentRows([...rows, newRow]));
  };

  const handleDeleteRow = (id: string) => {
    const filtered = rows.filter((r) => r.id !== id);
    setRows(validateStudentRows(filtered));
  };

  // Stage 5: Excel Generation
  const handleGenerateExcel = async () => {
    if (rows.length === 0 || rows.some((r) => !r.isValid)) return;

    setIsGeneratingExcel(true);
    setStage(5);

    try {
      // Small tick for visual feedback
      await new Promise((r) => setTimeout(r, 400));
      const blob = await buildStudentWorkbookBlob(rows);
      setGeneratedBlob(blob);
      setExportedCount(rows.length);
      setIsGeneratingExcel(false);
      setStage(6);
    } catch (err: any) {
      console.error('Excel assembly error:', err);
      setIsGeneratingExcel(false);
      alert('Failed to assemble Excel workbook: ' + (err.message || 'Unknown error'));
      setStage(4);
    }
  };

  // Stage 6: Download Excel File
  const handleDownloadExcel = () => {
    if (!generatedBlob) return;
    triggerBlobDownload(generatedBlob, exportFilename);
  };

  // Reset / Clear Data
  const handleClearAllData = () => {
    setSelectedFile(null);
    setFileError(null);
    setPdfPageCount(1);
    setRows([]);
    setGeneratedBlob(null);
    setExportedCount(0);
    setProgressPercent(0);
    setProgressMessage('');
    if (previewImageSrc && previewImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(previewImageSrc);
    }
    setPreviewImageSrc(null);
    pdfDocRef.current = null;
    setStage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validation metrics
  const totalRows = rows.length;
  const validRows = rows.filter((r) => r.isValid).length;
  const invalidRows = totalRows - validRows;
  const duplicateUsnCount = rows.filter((r) => r.errors.some((e) => e.includes('Duplicate'))).length;
  const reviewRequiredCount = rows.filter((r) => r.uncertain && r.isValid).length;
  const canProceedToExcel = totalRows > 0 && invalidRows === 0;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* HEADER BAR                                                */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              Browser-Side OCR Engine
            </span>
            <span className="flex items-center gap-1 text-xs text-[#059669] dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Client-Side Privacy
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#17243A] dark:text-white">
            Student List Converter
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Extract, review and convert student rosters from PDF or images into Phase-3 standardized Excel workbooks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedFile && (
            <button
              type="button"
              onClick={handleClearAllData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All Data
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VISUAL STAGE STEPPER                                      */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl p-4 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const isCurrent = stage === s.num;
            const isCompleted = stage > s.num;

            return (
              <div
                key={s.num}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-[#2563EB]/10 border-[#2563EB] text-[#2563EB] dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300 font-bold'
                    : isCompleted
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                    isCurrent
                      ? 'bg-[#2563EB] text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* STAGE 1: UPLOAD DOCUMENT                                  */}
      {/* ========================================================= */}
      {stage === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-8 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Stage 1: Upload Document
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Select or drop your departmental student roster document. Supports multi-page text PDFs, scanned PDFs, JPG, JPEG, PNG, and WebP.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-[#2563EB] bg-[#2563EB]/5'
                : 'border-slate-300 dark:border-slate-700 hover:border-[#2563EB] hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-14 h-14 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-[#2563EB] dark:text-blue-400">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#17243A] dark:text-white mb-1">
              Click to browse or drag and drop document here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PDF, JPG, JPEG, PNG, or WebP (Max 45 MB)
            </p>
          </div>

          {/* File Error Alert */}
          {fileError && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Selected File Card */}
          {selectedFile && !fileError && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedFile.name.split('.').pop()?.toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17243A] dark:text-white truncate max-w-sm">
                    {selectedFile.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull;{' '}
                    {selectedFile.name.toLowerCase().endsWith('.pdf')
                      ? `${pdfPageCount} page(s) detected`
                      : 'Single Image Document'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Replace File
                </button>
                <button
                  type="button"
                  onClick={startExtraction}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Extract Student Data <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Institutional Privacy & Confidentiality Guarantee</p>
              <p className="text-blue-800 dark:text-blue-300/80 leading-relaxed">
                All document parsing, image rendering, and OCR character extraction run 100% inside your local web browser. Original documents and extracted personal data are never uploaded to backend servers, third-party OCR engines, or AI cloud services.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 2: EXTRACT STUDENT DATA (LIVE PROGRESS)              */}
      {/* ========================================================= */}
      {stage === 2 && (
        <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-10 shadow-xs max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/40 text-[#2563EB] dark:text-blue-400 flex items-center justify-center animate-spin">
            <RefreshCw className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Stage 2: Extracting Student Data Locally
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {progressMessage || 'Processing document in browser memory...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className="bg-[#2563EB] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs font-bold text-[#2563EB]">{progressPercent}% Completed</div>

          <div className="pt-2">
            <button
              type="button"
              onClick={cancelExtraction}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel Extraction
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 3: REVIEW AND CORRECT RECORDS                        */}
      {/* ========================================================= */}
      {stage === 3 && (
        <div className="space-y-6">
          {/* Top Bar with actions */}
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#17243A] dark:text-white flex items-center gap-2">
                Stage 3: Review and Correct Extracted Records
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#2563EB] dark:bg-blue-900/60 dark:text-blue-300">
                  {rows.length} records found
                </span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Inspect and edit student data. Verify that USN, Student Name, and Date of Birth match the original document.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Student Row
              </button>
              <button
                type="button"
                onClick={() => setStage(4)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Proceed to Validation <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Two-Column Workspace: Source Document vs Editable Records */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: Source Document Preview (approx 5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3 sticky top-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Eye className="w-4 h-4 text-[#2563EB]" /> Source Document Preview
                </span>

                {/* PDF Page Navigator */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono">
                      Page {previewPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={previewPage >= totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.2))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Canvas or Image */}
              <div className="max-h-[600px] overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-2">
                {selectedFile?.name.toLowerCase().endsWith('.pdf') ? (
                  <canvas ref={canvasRef} className="max-w-full h-auto shadow-sm rounded" />
                ) : previewImageSrc ? (
                  <img
                    src={previewImageSrc}
                    alt="Source Document"
                    className="max-w-full h-auto rounded shadow-sm"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">Preview not available</div>
                )}
              </div>
            </div>

            {/* RIGHT: Editable Records Table (approx 7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-[#17243A] dark:text-white uppercase tracking-wider">
                  Extracted Records ({rows.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Exactly 3 Fields: USN &bull; Student Name &bull; DOB
                </span>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[#17243A] dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-36">USN</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 w-32">DOB (DD-MM-YYYY)</th>
                      <th className="py-2.5 px-3 w-20 text-center">Status</th>
                      <th className="py-2.5 px-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          No student records extracted. Click "Add Student Row" to create records manually.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            !row.isValid
                              ? 'bg-red-50/40 dark:bg-red-950/20'
                              : row.uncertain
                              ? 'bg-amber-50/40 dark:bg-amber-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.usn}
                              onChange={(e) => handleUpdateRow(row.id, 'usn', e.target.value)}
                              placeholder="e.g. 4MH21CS001"
                              className={`w-full px-2 py-1 text-xs font-mono rounded border uppercase ${
                                row.errors.some((e) => e.includes('USN'))
                                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                              }`}
                            />
                            {/* Suggested Quick Fix for OCR Ambiguity */}
                            {row.suggestedFix && row.suggestedFix.field === 'usn' && (
                              <button
                                type="button"
                                onClick={() => handleApplyFix(row.id, 'usn', row.suggestedFix!.replacement)}
                                className="mt-1 text-[10px] text-blue-600 hover:underline block text-left"
                              >
                                Fix: Use "{row.suggestedFix.replacement}"
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.studentName}
                              onChange={(e) => handleUpdateRow(row.id, 'studentName', e.target.value)}
                              placeholder="Full Student Name"
                              className={`w-full px-2 py-1 text-xs rounded border ${
                                row.errors.some((e) => e.includes('Name'))
                                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.dob}
                              onChange={(e) => handleUpdateRow(row.id, 'dob', e.target.value)}
                              placeholder="DD-MM-YYYY"
                              className={`w-full px-2 py-1 text-xs font-mono rounded border ${
                                row.errors.some((e) => e.includes('DOB') || e.includes('date'))
                                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                              }`}
                            />
                            {row.suggestedFix && row.suggestedFix.field === 'dob' && (
                              <button
                                type="button"
                                onClick={() => handleApplyFix(row.id, 'dob', row.suggestedFix!.replacement)}
                                className="mt-1 text-[10px] text-blue-600 hover:underline block text-left"
                              >
                                Fix: Use "{row.suggestedFix.replacement}"
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400"
                                title={row.errors.join('; ')}
                              >
                                <AlertCircle className="w-3.5 h-3.5" /> Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 4: VALIDATE RECORDS                                 */}
      {/* ========================================================= */}
      {stage === 4 && (
        <div className="space-y-6">
          {/* Validation Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
              <span className="text-xs text-slate-500">Total Records</span>
              <p className="text-2xl font-bold text-[#17243A] dark:text-white mt-1">{totalRows}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 shadow-2xs">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Valid Records</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{validRows}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/60 rounded-xl p-4 shadow-2xs">
              <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Invalid / Blocking</span>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{invalidRows}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 shadow-2xs">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Duplicate USNs</span>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{duplicateUsnCount}</p>
            </div>
          </div>

          {/* Validation Status & Discrepancies */}
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-[#17243A] dark:text-white">
                  Stage 4: Validation Summary
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review the validation status of all extracted student records prior to Excel generation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStage(3)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  &larr; Back to Review & Edit
                </button>
                <button
                  type="button"
                  disabled={!canProceedToExcel}
                  onClick={handleGenerateExcel}
                  className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer ${
                    canProceedToExcel
                      ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Generate Excel Workbook <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* If Blocking Errors Exist */}
            {invalidRows > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Blocking Validation Errors Detected ({invalidRows} rows)</span>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300/80 leading-relaxed">
                  Excel generation is blocked until all student records have valid USNs, non-empty student names, and valid calendar dates of birth without duplicates. Please return to Stage 3 to correct the highlighted records.
                </p>

                {/* Issues Table */}
                <div className="max-h-60 overflow-y-auto border border-red-100 dark:border-red-900/40 rounded-lg bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50/50 dark:bg-red-950/60 text-red-900 dark:text-red-300 font-bold">
                      <tr>
                        <th className="py-2 px-3 w-16">Row #</th>
                        <th className="py-2 px-3 w-32">USN</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3">Blocking Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                      {rows
                        .filter((r) => !r.isValid)
                        .map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 px-3 font-mono">{r.rowNumber}</td>
                            <td className="py-2 px-3 font-mono">{r.usn || '(empty)'}</td>
                            <td className="py-2 px-3">{r.studentName || '(empty)'}</td>
                            <td className="py-2 px-3 text-red-600 font-medium">{r.errors.join('; ')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* If All Valid */}
            {canProceedToExcel && (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    All {totalRows} Student Records Successfully Validated!
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/80 mt-0.5">
                    Every row contains a valid non-empty USN, full candidate name, and genuine calendar date. Ready to compile into the standard 3-column OpenXML (.xlsx) format.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 5: GENERATE EXCEL (ASSEMBLING ANIMATION)             */}
      {/* ========================================================= */}
      {stage === 5 && (
        <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-12 shadow-xs max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#17243A] dark:text-white">
              Stage 5: Assembling Standardized Excel Workbook
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Formatting 3-column worksheet (USN | Student Name | DOB), encoding genuine date numbers with DD-MM-YYYY display masks, and building binary XLSX package...
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STAGE 6: DOWNLOAD COMPLETED FILE & MANUAL HANDOFF          */}
      {/* ========================================================= */}
      {stage === 6 && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Download Success Card */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-8 shadow-xs text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Stage 6: Conversion Completed Successfully
              </span>
              <h2 className="text-xl font-bold text-[#17243A] dark:text-white">
                {exportFilename}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {exportedCount} student records compiled into standardized OpenXML format compatible with Phase-3 Java parser.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" /> Download Converted Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Convert Another Document
              </button>
            </div>
          </div>

          {/* PART 9: MANUAL IMPORT HANDOFF INSTRUCTIONS */}
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
              <HelpCircle className="w-5 h-5 text-[#2563EB]" />
              <div>
                <h3 className="text-sm font-bold text-[#17243A] dark:text-white">
                  Next Step: Manual Roster Import into College Database
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Follow these step-by-step instructions to enroll students into your departmental semester section.
                </p>
              </div>
            </div>

            <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  1
                </span>
                <div>
                  <strong>Download File:</strong> Save{' '}
                  <code className="text-blue-600 font-mono font-semibold">MITM_Student_List_Converted.xlsx</code>{' '}
                  to your computer using the download button above.
                </div>
              </li>

              <li className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  2
                </span>
                <div>
                  <strong>Navigate to Setup Class:</strong> Click on{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">Setup Class</span> in the left
                  HOD sidebar navigation.
                </div>
              </li>

              <li className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  3
                </span>
                <div>
                  <strong>Select Semester & Open Student Lists:</strong> Choose the target semester (e.g. Semester 5),
                  then click on the <span className="font-semibold text-slate-900 dark:text-white">Student Lists</span> tab.
                </div>
              </li>

              <li className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  4
                </span>
                <div>
                  <strong>Upload Excel Workbook:</strong> Select your designated class section (e.g. Section A), click{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">Upload Excel</span>, and attach your
                  downloaded file.
                </div>
              </li>

              <li className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  5
                </span>
                <div>
                  <strong>Review Validation & Confirm Import:</strong> The Phase 3 backend will verify that USNs are not
                  already enrolled in another department or section, display point-in-time revision logs, and confirm enrollment.
                </div>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
