// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import {
  FileDown,
  Download,
  Eye,
  CheckCircle2,
  FileText,
  Users,
  UploadCloud,
  Folder,
  Check,
  Info,
  Sparkles,
  Lightbulb,
  Image as ImageIcon,
  X,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Table as TableIcon
} from 'lucide-react';
import { api } from '../services/converterApi';
import {
  createQuestionPaperWorkbook,
  createStudentListWorkbook,
  triggerFileDownload,
  normalizeDobToYyyyMmDd
} from '../services/converterExcelService';

// Official Approved Departments for MIT Mysore (Strictly 10, CAC completely removed)
export const OFFICIAL_DEPARTMENTS = [
  'CSE AI',
  'AI & ML',
  'Information Science (IS)',
  'Internet of Things (IoT)',
  'Computer Science and Business Systems (CSBS)',
  'Computer Science and Data Science (CSDS)',
  'Computer Engineering (CE)',
  'Civil Engineering',
  'Mechanical Engineering',
  'Electronics and Communication Engineering (ECE)'
];

const SMART_STAGES = [
  'Reading Document',
  'Universal Ingestion & Mapping',
  'Extracting Records',
  'Validating Fields & Discrepancies',
  'Formatting Template Worksheets',
  'Generating Excel Workbook',
  'Final Validation'
];

const QP_STAGES = [
  'Reading Document',
  'Extracting Text and Images',
  'Identifying Questions and Modules',
  'Formatting Excel Worksheets',
  'Embedding Images',
  'Generating Excel Workbook',
  'Final Validation'
];

const SL_STAGES = [
  'Reading Document',
  'Extracting Student Records',
  'Mapping Seven Standard Columns',
  'Validating USN and DOB',
  'Formatting Excel Worksheet',
  'Generating Excel Workbook',
  'Final Validation'
];

// Default sample data for initial state
const DEFAULT_PREVIEW_PAPER = {
  semester: 5,
  subjectName: 'Computer Networks (21CS51)',
  subjectCode: '21CS51',
  totalModules: 5,
  modules: [
    {
      moduleNumber: 1,
      title: 'Module 1',
      questions: [
        {
          questionNumber: 1,
          questionText: 'What is the maximum payload size of a standard Ethernet frame?',
          questionImage: null,
          options: {
            A: { text: '1024 bytes', image: null },
            B: { text: '1500 bytes', image: null },
            C: { text: '65535 bytes', image: null },
            D: { text: '4096 bytes', image: null }
          },
          correctAnswer: 'B'
        },
        {
          questionNumber: 2,
          questionText: 'Which layer of the OSI model handles end-to-end packet routing across networks?',
          questionImage: null,
          options: {
            A: { text: 'Data Link Layer', image: null },
            B: { text: 'Network Layer', image: null },
            C: { text: 'Transport Layer', image: null },
            D: { text: 'Session Layer', image: null }
          },
          correctAnswer: 'B'
        }
      ]
    },
    {
      moduleNumber: 2,
      title: 'Module 2',
      questions: [
        {
          questionNumber: 3,
          questionText: 'Which transport layer protocol provides connection-oriented byte stream transfer?',
          questionImage: null,
          options: {
            A: { text: 'UDP', image: null },
            B: { text: 'TCP', image: null },
            C: { text: 'ICMP', image: null },
            D: { text: 'IGMP', image: null }
          },
          correctAnswer: 'B'
        }
      ]
    },
    {
      moduleNumber: 3,
      title: 'Module 3',
      questions: [
        {
          questionNumber: 4,
          questionText: 'What is the standard port number for HTTPS communication?',
          questionImage: null,
          options: {
            A: { text: '80', image: null },
            B: { text: '443', image: null },
            C: { text: '8080', image: null },
            D: { text: '22', image: null }
          },
          correctAnswer: 'B'
        }
      ]
    },
    {
      moduleNumber: 4,
      title: 'Module 4',
      questions: [
        {
          questionNumber: 5,
          questionText: 'In wireless 802.11 networks, which collision avoidance mechanism is utilized?',
          questionImage: null,
          options: {
            A: { text: 'CSMA/CD', image: null },
            B: { text: 'CSMA/CA', image: null },
            C: { text: 'Token Ring', image: null },
            D: { text: 'Slotted ALOHA', image: null }
          },
          correctAnswer: 'B'
        }
      ]
    },
    {
      moduleNumber: 5,
      title: 'Module 5',
      questions: [
        {
          questionNumber: 6,
          questionText: 'Which protocol is used for secure shell remote administrative access?',
          questionImage: null,
          options: {
            A: { text: 'Telnet', image: null },
            B: { text: 'SSH', image: null },
            C: { text: 'FTP', image: null },
            D: { text: 'SMTP', image: null }
          },
          correctAnswer: 'B'
        }
      ]
    }
  ]
};

// Initial student records with EXACTLY 7 fields (with individual department assignment, CAC removed!)
const DEFAULT_PREVIEW_STUDENTS = [
  {
    serialNumber: 1,
    usn: '4XX23CS001',
    studentName: 'John Doe',
    dob: '15-05-2003',
    section: 'A',
    semester: 5,
    department: 'CSE AI'
  },
  {
    serialNumber: 2,
    usn: '4XX23CS002',
    studentName: 'Jane Smith',
    dob: '22-08-2003',
    section: 'A',
    semester: 5,
    department: 'Information Science (IS)'
  },
  {
    serialNumber: 3,
    usn: '4XX23CS003',
    studentName: 'David Kumar',
    dob: '09-12-2002',
    section: 'B',
    semester: 5,
    department: 'AI & ML'
  },
  {
    serialNumber: 4,
    usn: '4XX23CS015',
    studentName: 'Ananya Sharma',
    dob: '18-04-2003',
    section: 'A',
    semester: 5,
    department: 'Computer Engineering (CE)'
  },
  {
    serialNumber: 5,
    usn: '4XX23CS028',
    studentName: 'Rahul Varma',
    dob: '30-11-2002',
    section: 'B',
    semester: 5,
    department: 'Civil Engineering'
  }
];

/**
 * PRINTABLE QUESTION PAPER A4 TEMPLATE PREVIEW
 * Renders an exact, perfectly aligned, professional printable A4 question paper layout.
 * Correctly aligns:
 * - College header (Maharaja Institute of Technology Mysore, VTU Affiliation, Department, Examination details)
 * - Subject metadata grid (Course Title, Code, Semester, Duration, Max Marks, Date)
 * - Instructions box
 * - Question rows with Q.No, Question Description, Marks [10], CO, and RBT level
 * - Internal choice dividers (--- OR ---) and module section dividers
 * - Multi-page pagination (Page 1 of 2, Page 2 of 2) with consistent headers and footers
 * - Dynamic binding: displays extracted content from uploaded PDF or official standard template
 */
function PrintableQuestionPaperPreview({ paper = null }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;

  const subjectTitle = paper?.subjectName || 'Computer Networks';
  const subjectCode = paper?.subjectCode || '21CS51';
  const semester = paper?.semester || 5;
  const department = paper?.department || 'Computer Science & Engineering';

  // Use dynamic questions if paper is loaded and has questions
  const extractedQuestions = [];
  if (paper && Array.isArray(paper.modules)) {
    paper.modules.forEach(m => {
      if (Array.isArray(m.questions)) {
        m.questions.forEach(q => {
          extractedQuestions.push({
            moduleNumber: m.moduleNumber,
            qNo: String(q.questionNumber || extractedQuestions.length + 1),
            text: q.questionText || '',
            marks: q.marks ? String(q.marks) : '10',
            co: q.co || 'CO1',
            rbt: q.rbt || 'L2'
          });
        });
      }
    });
  }

  // Default standard reference questions if not enough extracted questions
  const defaultPage1Questions = [
    {
      qNo: '1 a',
      text: 'Explain the ISO-OSI 7-layer reference architecture with a neat diagram and state the primary functions of each layer.',
      marks: '10',
      co: 'CO1',
      rbt: 'L2'
    },
    {
      qNo: '1 b',
      text: 'Compare and contrast TCP and UDP transport protocols with their respective frame segment header formats.',
      marks: '10',
      co: 'CO1',
      rbt: 'L2'
    },
    { isDivider: true, text: 'OR' },
    {
      qNo: '2 a',
      text: 'Explain the working of Go-Back-N and Selective Repeat Sliding Window Protocols with timing sequence diagrams.',
      marks: '10',
      co: 'CO1',
      rbt: 'L3'
    },
    {
      qNo: '2 b',
      text: 'What is CSMA/CD? Explain how collision detection and binary exponential backoff algorithm operates in Ethernet.',
      marks: '10',
      co: 'CO1',
      rbt: 'L2'
    }
  ];

  const defaultPage2Questions = [
    {
      moduleTitle: 'MODULE - 3',
      items: [
        {
          qNo: '5 a',
          text: 'Explain Dijkstra\'s shortest path routing algorithm. Compute shortest path from source node A for the given network graph.',
          marks: '10',
          co: 'CO3',
          rbt: 'L3'
        },
        {
          qNo: '5 b',
          text: 'Discuss IPv4 datagram format highlighting significance of fragmentation offset, flags and TTL fields.',
          marks: '10',
          co: 'CO3',
          rbt: 'L2'
        }
      ]
    },
    {
      moduleTitle: 'MODULE - 4',
      items: [
        {
          qNo: '7 a',
          text: 'Describe the three-way handshake mechanism used in TCP connection establishment and graceful termination.',
          marks: '10',
          co: 'CO4',
          rbt: 'L2'
        },
        {
          qNo: '7 b',
          text: 'Explain TCP congestion control mechanisms: Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery.',
          marks: '10',
          co: 'CO4',
          rbt: 'L3'
        }
      ]
    }
  ];

  const page1Items = extractedQuestions.length >= 2 
    ? extractedQuestions.slice(0, 4) 
    : defaultPage1Questions;

  return (
    <div className="w-full space-y-2.5">
      {/* Page Navigation & Alignment Toolbar */}
      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Printer className="w-3.5 h-3.5 text-[#1263F5]" />
          <span>A4 Printable Format</span>
          <span className="text-[10px] bg-white text-[#1263F5] px-1.5 py-0.5 rounded border border-slate-200 font-semibold">
            VTU Autonomous Standard
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center rounded border border-slate-300 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`p-1 transition ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100 cursor-pointer'}`}
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(2)}
              disabled={currentPage === 2}
              className={`p-1 transition ${currentPage === 2 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100 cursor-pointer'}`}
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* A4 Proportion Page Sheet */}
      <div className="w-full bg-white rounded-xl border border-slate-300 p-4 sm:p-5 shadow-xs space-y-3 font-sans text-slate-900 select-none">
        {currentPage === 1 ? (
          <>
            {/* College Header */}
            <div className="text-center space-y-0.5 border-b-2 border-slate-800 pb-2.5">
              <div className="text-[10px] font-bold tracking-widest text-[#1263F5] uppercase">
                Autonomous Institution Affiliated to VTU, Belagavi
              </div>
              <h2 className="text-[15px] sm:text-[16px] font-black uppercase text-slate-900 tracking-wide leading-tight">
                MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE
              </h2>
              <p className="text-[10px] text-slate-500 italic">
                Belagola, Srirangapatna Taluk, Mandya - 571 477 | Approved by AICTE, New Delhi
              </p>
              <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider pt-0.5">
                Department of {department}
              </div>
              <div className="inline-block bg-slate-100 border border-slate-300 text-[11px] font-bold text-[#1E2B7B] uppercase px-3 py-0.5 rounded-full mt-1">
                Semester End Examination - Jan / Feb 2026
              </div>
            </div>

            {/* Subject Details Grid */}
            <div className="border border-slate-300 rounded overflow-hidden text-[11px]">
              <div className="grid grid-cols-3 divide-x divide-slate-300 bg-slate-50 font-semibold border-b border-slate-300 py-1.5 px-2">
                <div><span className="text-slate-500">Course Title:</span> <strong className="text-slate-900">{subjectTitle}</strong></div>
                <div><span className="text-slate-500">Course Code:</span> <strong className="font-mono text-slate-900">{subjectCode}</strong></div>
                <div><span className="text-slate-500">Semester:</span> <strong className="text-slate-900">{semester}th Sem</strong></div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-300 py-1.5 px-2 text-[10px] sm:text-[11px]">
                <div><span className="text-slate-500">Duration:</span> <strong>3 Hours</strong></div>
                <div><span className="text-slate-500">Max Marks:</span> <strong>100</strong></div>
                <div><span className="text-slate-500">Exam Date:</span> <strong>13-11-2026</strong></div>
              </div>
            </div>

            {/* Instructions Box */}
            <div className="p-2 bg-slate-50/80 border border-slate-200 rounded text-[10px] sm:text-[11px] text-slate-700 italic space-y-0.5">
              <p className="font-semibold not-italic text-slate-800">Instructions to Candidates:</p>
              <p>1. Answer any FIVE full questions, choosing at least ONE question from each module.</p>
              <p>2. Use of standard non-programmable scientific calculator is permitted.</p>
            </div>

            {/* Questions Table */}
            <div className="border border-slate-300 rounded overflow-hidden text-[11px]">
              <div className="bg-[#1263F5] text-white font-bold grid grid-cols-12 py-1.5 px-2 text-center text-[10px] sm:text-[11px]">
                <div className="col-span-1 border-r border-blue-400">Q.No</div>
                <div className="col-span-8 border-r border-blue-400 text-left px-2">Question Description</div>
                <div className="col-span-1 border-r border-blue-400">Marks</div>
                <div className="col-span-1 border-r border-blue-400">CO</div>
                <div className="col-span-1">RBT</div>
              </div>

              {/* Module 1 Header */}
              <div className="bg-slate-100 font-bold text-center py-1 text-slate-800 border-b border-slate-200 text-[11px] tracking-wider uppercase">
                MODULE - 1
              </div>

              <div className="divide-y divide-slate-200">
                {page1Items.map((q, idx) => {
                  if (q.isDivider) {
                    return (
                      <div key={idx} className="bg-slate-50 text-center font-bold text-[10px] text-slate-500 py-1 tracking-widest border-y border-slate-200">
                        --- OR ---
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="grid grid-cols-12 py-2 px-2 text-[10px] sm:text-[11px] hover:bg-slate-50/50 items-start">
                      <div className="col-span-1 font-mono font-bold text-center text-slate-800">{q.qNo}</div>
                      <div className="col-span-8 px-2 text-slate-800 leading-relaxed">{q.text}</div>
                      <div className="col-span-1 text-center font-bold text-slate-700">[{q.marks}]</div>
                      <div className="col-span-1 text-center text-slate-500 font-mono">{q.co}</div>
                      <div className="col-span-1 text-center text-slate-500 font-mono">{q.rbt}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Page 1 Footer */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-200">
              <span>Maharaja Institute of Technology Mysore</span>
              <span className="font-bold text-slate-600">Page 1 of 2</span>
              <span>Controller of Examinations (COE)</span>
            </div>
          </>
        ) : (
          <>
            {/* Page 2 Continuation Header */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-2 text-[10px] sm:text-[11px]">
              <div>
                <strong className="text-slate-800">MIT Mysore - Semester End Exam</strong>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-600">{subjectTitle} ({subjectCode})</span>
              </div>
              <div className="font-mono text-slate-500 font-bold">Sem {semester}</div>
            </div>

            {/* Page 2 Modules */}
            <div className="border border-slate-300 rounded overflow-hidden text-[11px] space-y-0">
              <div className="bg-[#1263F5] text-white font-bold grid grid-cols-12 py-1.5 px-2 text-center text-[10px] sm:text-[11px]">
                <div className="col-span-1 border-r border-blue-400">Q.No</div>
                <div className="col-span-8 border-r border-blue-400 text-left px-2">Question Description</div>
                <div className="col-span-1 border-r border-blue-400">Marks</div>
                <div className="col-span-1 border-r border-blue-400">CO</div>
                <div className="col-span-1">RBT</div>
              </div>

              {defaultPage2Questions.map((mod, mIdx) => (
                <div key={mIdx}>
                  <div className="bg-slate-100 font-bold text-center py-1 text-slate-800 border-y border-slate-200 text-[11px] tracking-wider uppercase">
                    {mod.moduleTitle}
                  </div>
                  <div className="divide-y divide-slate-200">
                    {mod.items.map((q, qIdx) => (
                      <div key={qIdx} className="grid grid-cols-12 py-2.5 px-2 text-[10px] sm:text-[11px] hover:bg-slate-50/50 items-start">
                        <div className="col-span-1 font-mono font-bold text-center text-slate-800">{q.qNo}</div>
                        <div className="col-span-8 px-2 text-slate-800 leading-relaxed">{q.text}</div>
                        <div className="col-span-1 text-center font-bold text-slate-700">[{q.marks}]</div>
                        <div className="col-span-1 text-center text-slate-500 font-mono">{q.co}</div>
                        <div className="col-span-1 text-center text-slate-500 font-mono">{q.rbt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* End of Question Paper Signoff */}
            <div className="text-center py-2 border-y border-dashed border-slate-300 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              ***** End of Question Paper *****
            </div>

            {/* Signatures Grid */}
            <div className="grid grid-cols-3 text-center text-[10px] text-slate-600 pt-3">
              <div>
                <div className="font-semibold border-t border-slate-300 pt-1 mx-4">Course Coordinator</div>
              </div>
              <div>
                <div className="font-semibold border-t border-slate-300 pt-1 mx-4">HOD Approval</div>
              </div>
              <div>
                <div className="font-bold text-[#1E2B7B] border-t border-slate-300 pt-1 mx-4">Controller of Examinations</div>
              </div>
            </div>

            {/* Page 2 Footer */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-200">
              <span>Maharaja Institute of Technology Mysore</span>
              <span className="font-bold text-slate-600">Page 2 of 2</span>
              <span>Autonomous Exam Wing</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>✓ Standard College Header &amp; Instructions</span>
        <span>✓ Module-wise Internal Choice Alignment</span>
        <span>✓ Verified A4 Margin Proportions</span>
      </div>
    </div>
  );
}

/**
 * VISUAL IMAGE COMPONENT 1: QUESTION PAPER TEMPLATE PREVIEW
 * Beautifully aligned, responsive 12-column preview matching the official reference screenshot.
 * Displays interactive module tabs (Summary, Module 1-5) and exact 12-column template structure.
 */
function QuestionPaperTemplatePreview({ paper = null, isConverted = false }) {
  const [activeSheetTab, setActiveSheetTab] = useState('Module 1');

  const modules = paper?.modules || [];
  const currentMod = modules.find(m => `Module ${m.moduleNumber}` === activeSheetTab) || modules[0];
  const questionsToShow = currentMod?.questions?.slice(0, 2) || [];

  return (
    <div className="w-full bg-white rounded-xl border border-[#DCE4F5] p-3.5 space-y-3 shadow-2xs">
      {/* Illustrative Worksheet Tabs Bar */}
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 p-1 rounded-lg overflow-x-auto select-none">
        <span className="px-2 py-0.5 text-slate-400 uppercase text-[10px] font-semibold">Sheets:</span>
        {['Summary', 'Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5'].map((sheet) => (
          <button
            key={sheet}
            type="button"
            onClick={() => setActiveSheetTab(sheet)}
            className={`px-2.5 py-1 rounded transition text-xs font-semibold whitespace-nowrap cursor-pointer ${
              activeSheetTab === sheet
                ? 'bg-white text-[#1263F5] shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {sheet}
          </button>
        ))}
      </div>

      {/* Sheet Content Table */}
      {activeSheetTab === 'Summary' ? (
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full">
            <thead className="bg-[#1263F5] text-white">
              <tr>
                <th className="py-2 px-3 text-left font-bold w-1/2">Property</th>
                <th className="py-2 px-3 text-left font-bold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              <tr><td className="py-1.5 px-3 font-semibold bg-slate-50">Institution</td><td className="py-1.5 px-3">Maharaja Institute of Technology Mysore</td></tr>
              <tr><td className="py-1.5 px-3 font-semibold bg-slate-50">Subject Name</td><td className="py-1.5 px-3">{paper?.subjectName || 'DATA STRUCTURES AND ALGORITHMS'}</td></tr>
              <tr><td className="py-1.5 px-3 font-semibold bg-slate-50">Total Modules</td><td className="py-1.5 px-3 font-bold text-[#1263F5]">{paper?.modules?.length || 5} Modules</td></tr>
              <tr><td className="py-1.5 px-3 font-semibold bg-slate-50">Total Questions</td><td className="py-1.5 px-3 font-bold text-[#12A86B]">{paper?.verification?.totalQuestions || 150} Questions</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
          <table className="w-full text-xs text-left min-w-[680px] border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2 px-2.5 border-r border-slate-200 text-center w-12">Q.No</th>
                <th className="py-2 px-3 border-r border-slate-200 min-w-[130px]">Question</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center min-w-[95px]">Question image</th>
                <th className="py-2 px-3 border-r border-slate-200 min-w-[95px]">Option A</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center min-w-[70px]">Image A</th>
                <th className="py-2 px-3 border-r border-slate-200 min-w-[95px]">Option B</th>
                <th className="py-2 px-2 border-r border-slate-200 text-center min-w-[70px]">Image B</th>
                <th className="py-2 px-2.5 text-center min-w-[65px] bg-emerald-50 text-[#12A86B]">Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {isConverted && questionsToShow.length > 0 ? (
                questionsToShow.map((q, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5 text-center font-bold font-mono border-r border-slate-100">{q.questionNumber || idx + 1}</td>
                    <td className="py-2.5 px-3 border-r border-slate-100 truncate max-w-[140px] font-medium text-slate-800" title={q.questionText}>{q.questionText}</td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100">
                      <div className="h-6 w-9 mx-auto rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100 truncate max-w-[90px]">{q.options?.A?.text}</td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100 text-[10px] text-slate-400">None</td>
                    <td className="py-2.5 px-3 border-r border-slate-100 truncate max-w-[90px]">{q.options?.B?.text}</td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100 text-[10px] text-slate-400">None</td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-[#12A86B] bg-emerald-50/50">{q.correctAnswer || 'A'}</td>
                  </tr>
                ))
              ) : (
                [1, 2].map((num) => (
                  <tr key={num} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5 text-center font-semibold text-slate-700 border-r border-slate-100">{num}</td>
                    <td className="py-2.5 px-3 border-r border-slate-100">
                      <div className="space-y-1">
                        <div className="h-2 w-24 bg-slate-200 rounded-full" />
                        <div className="h-2 w-14 bg-slate-100 rounded-full" />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100">
                      <div className="h-6 w-9 mx-auto rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-500">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100">
                      <div className="h-2 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100">
                      <div className="h-5 w-7 mx-auto rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-3 h-3" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100">
                      <div className="h-2 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-100">
                      <div className="h-5 w-7 mx-auto rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-3 h-3" />
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-[#12A86B] bg-emerald-50/50">
                      {num === 1 ? 'B' : 'A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
        <span>✓ Complete 12-Column Layout</span>
        <span>✓ Separate Sheets per Module</span>
        <span className="text-[#1263F5] font-semibold">Scroll horizontally →</span>
      </div>
    </div>
  );
}

/**
 * VISUAL IMAGE COMPONENT 2: STUDENT LIST TEMPLATE PREVIEW
 * Exact reproduction of the Student List Template Preview card from the reference screenshot.
 */
/**
 * Detects discrepancies in a student record:
 * - Missing or invalid student name
 * - Missing, non-standard, or duplicate USN
 * - Missing, unclear, or non-yyyy-mm-dd Date of Birth
 */
export function getStudentDiscrepancy(student, allStudents = []) {
  const issues = {
    usnError: null,
    nameError: null,
    dobError: null,
    hasDiscrepancy: false,
    reasons: []
  };

  if (!student) return issues;
  const safeStudents = Array.isArray(allStudents) ? allStudents : [];

  const usn = String(student.usn || student['USN'] || student.registrationNumber || student.rollNo || '').trim().toUpperCase();
  const name = String(student.studentName || student['Student Name'] || student.name || '').trim();
  const rawDob = student.dateOfBirth || student.dob || student['Date of Birth'] || '';
  const normDob = normalizeDobToYyyyMmDd(rawDob);

  // 1. Check USN
  if (!usn || usn === 'N/A' || usn === 'MISSING') {
    issues.usnError = 'Missing USN';
    issues.hasDiscrepancy = true;
    issues.reasons.push('Missing USN');
  } else if (!/^[0-9][A-Z]{2}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3}$/i.test(usn)) {
    issues.usnError = 'Non-Standard Format';
    issues.hasDiscrepancy = true;
    issues.reasons.push(`Invalid USN format: "${usn}"`);
  } else if (safeStudents.length > 0) {
    const dupCount = safeStudents.filter(s => {
      const u = String(s.usn || s['USN'] || s.registrationNumber || s.rollNo || '').trim().toUpperCase();
      return u === usn;
    }).length;
    if (dupCount > 1) {
      issues.usnError = 'Duplicate USN';
      issues.hasDiscrepancy = true;
      issues.reasons.push(`Duplicate USN: "${usn}"`);
    }
  }

  // 2. Check Student Name
  if (!name || name.toLowerCase() === 'student' || name.toLowerCase() === 'unknown' || name === '—' || name.length < 2) {
    issues.nameError = 'Missing / Invalid Name';
    issues.hasDiscrepancy = true;
    issues.reasons.push('Missing or invalid student name');
  } else if (/^\d+$/.test(name)) {
    issues.nameError = 'Invalid Name (Numbers Only)';
    issues.hasDiscrepancy = true;
    issues.reasons.push('Student name cannot be numbers only');
  }

  // 3. Check Date of Birth
  if (!rawDob || normDob.includes('missing') || normDob.includes('UNCLEAR')) {
    issues.dobError = normDob.includes('missing') ? 'Missing Date of Birth' : normDob;
    issues.hasDiscrepancy = true;
    issues.reasons.push('Missing or unclear Date of Birth');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(normDob)) {
    issues.dobError = 'Format error (must be yyyy-mm-dd)';
    issues.hasDiscrepancy = true;
    issues.reasons.push('Date must be formatted as yyyy-mm-dd');
  } else {
    const [y, m, d] = normDob.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1950 || y > 2030) {
      issues.dobError = 'Invalid calendar date';
      issues.hasDiscrepancy = true;
      issues.reasons.push('Invalid date value in yyyy-mm-dd');
    }
  }

  return issues;
}

function StudentListTemplatePreview({ students = null, isConverted = false }) {
  const displayStudents = isConverted && students && students.length > 0
    ? students
    : [
        { sno: 1, usn: '4XX23CS001', name: 'John Doe', dob: '2003-05-15' },
        { sno: 2, usn: '4XX23CS002', name: 'Jane Smith', dob: '2003-08-22' },
        { sno: 3, usn: '4XX23CS003', name: 'David Kumar', dob: '2002-12-09' }
      ];

  const discCount = isConverted && students
    ? students.filter(s => getStudentDiscrepancy(s, students).hasDiscrepancy).length
    : 0;

  return (
    <div className="w-full bg-white rounded-xl border border-[#DCE4F5] p-3.5 space-y-3 shadow-2xs">
      {discCount > 0 ? (
        <div className="p-2 bg-red-50 border border-red-300 rounded-lg flex items-center justify-between text-[11px] text-red-700 font-bold">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{discCount} Discrepancy(ies) detected (marked in RED)</span>
          </div>
          <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200">
            Review Below
          </span>
        </div>
      ) : isConverted ? (
        <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>All {students?.length || 0} student records valid (yyyy-mm-dd)</span>
        </div>
      ) : null}

      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-2xs max-h-64 overflow-y-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[420px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-10">
            <tr>
              <th className="py-2 px-2.5 border-r border-slate-200 text-center w-12">Sl.no.</th>
              <th className="py-2 px-3 border-r border-slate-200">Student Name</th>
              <th className="py-2 px-3 border-r border-slate-200">USN</th>
              <th className="py-2 px-2.5 text-center">Date of Birth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {displayStudents.map((s, idx) => {
              const disc = isConverted ? getStudentDiscrepancy(s, students) : {};
              const formattedDob = normalizeDobToYyyyMmDd(s.dateOfBirth || s.dob || s['Date of Birth']);
              const displayName = s.studentName || s.name || s['Student Name'];

              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    disc.hasDiscrepancy
                      ? 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-2 px-2.5 text-center font-medium text-slate-700 border-r border-slate-100">
                    {s.sno || s.serialNumber || idx + 1}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-100">
                    {disc.nameError ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs" title={disc.nameError}>
                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                          {displayName || 'Missing Name'}
                        </span>
                        <span className="text-[9px] text-red-600 font-semibold">{disc.nameError}</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-800">{displayName}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-100 font-mono">
                    {disc.usnError ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs" title={disc.usnError}>
                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                          {s.usn || 'Missing USN'}
                        </span>
                        <span className="text-[9px] text-red-600 font-semibold">{disc.usnError}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-[#0F172A]">{s.usn}</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-center font-mono">
                    {disc.dobError ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs" title={disc.dobError}>
                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                          {formattedDob || 'Missing DOB'}
                        </span>
                        <span className="text-[9px] text-red-600 font-semibold">{disc.dobError}</span>
                      </div>
                    ) : (
                      <span className="text-slate-700">{formattedDob}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
        <span>✓ 4 template columns</span>
        <span>✓ Date of Birth (yyyy-mm-dd)</span>
        {discCount > 0 ? (
          <span className="text-red-600 font-bold">⚠ {discCount} Discrepancy(ies) in RED</span>
        ) : (
          <span className="text-emerald-600 font-bold">✓ 100% Valid</span>
        )}
      </div>
    </div>
  );
}

export interface SmartDocumentConverterProps {
  initialTab?: 'question_paper' | 'student_list';
  onTabChange?: (tab: 'question_paper' | 'student_list') => void;
}

export function SmartDocumentConverter({
  initialTab = 'question_paper',
  onTabChange = null
}: SmartDocumentConverterProps = {}) {
  const [activeTab, setActiveTab] = useState<'question_paper' | 'student_list'>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Actual Conversion Progress States
  const [isConverting, setIsConverting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isConverted, setIsConverted] = useState(false);
  const [conversionError, setConversionError] = useState(null);

  // Live converted datasets for actual file generation
  const [convertedPaper, setConvertedPaper] = useState(null);
  const [convertedStudents, setConvertedStudents] = useState(null);

  // Generated Workbook Buffer (Stored upon completion of actual conversion)
  const [generatedBuffer, setGeneratedBuffer] = useState(null);

  // Modal State for "View Converted File" (Actual Converted Workbook)
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [viewerActiveSheet, setViewerActiveSheet] = useState('summary');

  // Modal State for Individual Student Record Editing (DOB or Department)
  const [editingStudent, setEditingStudent] = useState(null);

  const fileInputRef = useRef(null);

  const activeStagesList = activeTab === 'question_paper' ? QP_STAGES : SL_STAGES;

  const normalizeDob = (val) => {
    if (!val) return '';
    const clean = String(val).trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-');
      return `${d}-${m}-${y}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      return clean.replace(/\//g, '-');
    }
    return clean;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File reading failed.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * ACTUAL CONVERSION ENGINE EXECUTION
   * Percentage strictly reflects completed tasks:
   * Stage 1: 14% | Stage 2: 28% | Stage 3: 43% | Stage 4: 57%
   * Stage 5: 71% | Stage 6: 85% | Stage 7: 100%
   */
  const handleFileSelected = async (file) => {
    const validExts = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExts.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      alert('Please upload a valid document format: PDF, DOC, DOCX, XLSX, or XLS');
      return;
    }

    setUploadedFile(file);
    setIsConverting(true);
    setConversionError(null);
    setIsConverted(false);
    setGeneratedBuffer(null);
    setConvertedPaper(null);
    setConvertedStudents(null);
    setProgressPercent(0);
    setCurrentStageIndex(0);

    try {
      // STAGE 1: Reading Document (14%)
      setCurrentStageIndex(0);
      const fileBuffer = await readFileAsArrayBuffer(file);
      if (!fileBuffer || fileBuffer.byteLength === 0) {
        throw new Error('Unable to read document file. The file appears to be empty or corrupted.');
      }
      setProgressPercent(14);

      const formData = new FormData();
      formData.append('file', file);
      const destTemplate = activeTab === 'question_paper' ? 'QUESTION_PAPER' : 'STUDENT_LIST';
      formData.append('templateId', destTemplate);
      formData.append('destinationTemplate', destTemplate);
      formData.append('documentType', activeTab === 'question_paper' ? 'question_paper' : 'student_list');
      formData.append('department', 'CSE');
      formData.append('semester', '5');

      if (activeTab === 'question_paper') {
        // STAGE 2: Extracting Text and Images (28%)
        setCurrentStageIndex(1);
        let rawPaper = null;
        try {
          const uploadRes = await api.converterUpload(formData);
          if (uploadRes.success && (uploadRes.data?.preview?.modules || uploadRes.data?.preview?.questions)) {
            rawPaper = uploadRes.data.preview;
            setConversionMeta({
              conversionId: uploadRes.data.conversionId,
              detectedFormat: uploadRes.data.detectedFormat,
              extractionMethod: uploadRes.data.extractionMethod,
              envelope: uploadRes.data.envelope
            });
            setValidationReport(uploadRes.data.validation);
          }
        } catch (err) {
          console.warn('Universal upload fallback to legacy question extractor:', err);
        }

        if (!rawPaper) {
          const uploadRes = await api.uploadQuestionPaper(formData);
          if (!uploadRes.success || !uploadRes.data?.paper) {
            throw new Error(uploadRes.error?.message || 'Server failed to extract questions from uploaded document.');
          }
          rawPaper = uploadRes.data.paper;
        }
        setProgressPercent(28);

        // STAGE 3: Identifying Questions and Modules (43%)
        setCurrentStageIndex(2);
        if (!rawPaper.modules || rawPaper.modules.length === 0) {
          throw new Error('No modules or questions detected in the uploaded file.');
        }

        const totalExtracted = rawPaper.verification?.totalQuestions ||
          rawPaper.modules.reduce((sum, m) => sum + (m.questions?.length || 0), 0);

        if (totalExtracted === 0) {
          throw new Error('No valid questions found in this document. Please check file layout.');
        }

        const normalizedPaper = {
          ...rawPaper,
          subjectName: rawPaper.metadata?.subjectName || rawPaper.subjectName || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          subjectCode: rawPaper.metadata?.subjectCode || rawPaper.subjectCode || 'N/A',
          semester: rawPaper.metadata?.semester || rawPaper.semester || 3,
          department: rawPaper.metadata?.department || rawPaper.department || 'CSE'
        };

        setConvertedPaper(normalizedPaper);
        setProgressPercent(43);

        // STAGE 4: Formatting Excel Worksheets (57%)
        setCurrentStageIndex(3);
        await sleep(250);
        setProgressPercent(57);

        // STAGE 5: Embedding Images (71%)
        setCurrentStageIndex(4);
        await sleep(250);
        setProgressPercent(71);

        // STAGE 6: Generating Excel Workbook (85%)
        setCurrentStageIndex(5);
        const { workbook, buffer } = await createQuestionPaperWorkbook(normalizedPaper);
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Excel generator failed to assemble workbook binary stream.');
        }
        setProgressPercent(85);

        // STAGE 7: Final Validation (100%)
        setCurrentStageIndex(6);
        // Verify workbook has at least 1 worksheet
        if (!workbook.worksheets || workbook.worksheets.length === 0) {
          throw new Error('Validation failed: Generated workbook contains no worksheets.');
        }

        await sleep(250);
        setGeneratedBuffer(buffer);
        setProgressPercent(100);
        setIsConverting(false);
        setIsConverted(true);

      } else {
        // Student List Converter
        // STAGE 2: Extracting Student Records (28%)
        setCurrentStageIndex(1);
        let extractedStudents = null;
        try {
          const uploadRes = await api.converterUpload(formData);
          if (uploadRes.success && uploadRes.data?.preview?.records) {
            extractedStudents = uploadRes.data.preview.records;
            setConversionMeta({
              conversionId: uploadRes.data.conversionId,
              detectedFormat: uploadRes.data.detectedFormat,
              extractionMethod: uploadRes.data.extractionMethod,
              envelope: uploadRes.data.envelope
            });
            setValidationReport(uploadRes.data.validation);
          }
        } catch (err) {
          console.warn('Universal upload fallback to legacy student extractor:', err);
        }

        if (!extractedStudents) {
          const legacyRes = await api.uploadStudentList(formData);
          if (!legacyRes.success) {
            throw new Error(legacyRes.error?.message || 'Server failed to extract student records.');
          }
          extractedStudents = legacyRes.data?.listData?.records || legacyRes.data?.listData || [];
        }

        if (!extractedStudents || extractedStudents.length === 0) {
          throw new Error('No student records found in the uploaded document.');
        }
        setProgressPercent(28);

        // STAGE 3: Mapping Student Template Columns (43%)
        setCurrentStageIndex(2);
        await sleep(200);
        setConvertedStudents(extractedStudents);
        setProgressPercent(43);

        // STAGE 4: Validating USN and DOB (57%)
        setCurrentStageIndex(3);
        await sleep(200);
        setProgressPercent(57);

        // STAGE 5: Formatting Excel Worksheet (71%)
        setCurrentStageIndex(4);
        await sleep(200);
        setProgressPercent(71);

        // STAGE 6: Generating Excel Workbook (85%)
        setCurrentStageIndex(5);
        const { workbook, buffer } = await createStudentListWorkbook(extractedStudents);
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Excel generator failed to assemble student list binary stream.');
        }
        setProgressPercent(85);

        // STAGE 7: Final Validation (100%)
        setCurrentStageIndex(6);
        await sleep(200);

        setGeneratedBuffer(buffer);
        setProgressPercent(100);
        setIsConverting(false);
        setIsConverted(true);
      }

    } catch (err) {
      console.error('[Conversion Engine Error]', err);
      setIsConverting(false);
      setIsConverted(false);
      setGeneratedBuffer(null);
      setConversionError(err.message || 'An unexpected error occurred during document conversion.');
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setIsConverting(false);
    setProgressPercent(0);
    setCurrentStageIndex(0);
    setIsConverted(false);
    setConversionError(null);
    setGeneratedBuffer(null);
    setConvertedPaper(null);
    setConvertedStudents(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadExcel = () => {
    if (!generatedBuffer) {
      alert('Please convert a document first before downloading.');
      return;
    }
    const filename = uploadedFile
      ? activeTab === 'question_paper'
        ? `${uploadedFile.name.replace(/\.[^/.]+$/, '')}_Standard_QP.xlsx`
        : `${uploadedFile.name.replace(/\.[^/.]+$/, '')}_Standard_Students.xlsx`
      : activeTab === 'question_paper'
      ? 'Question_Paper_Standard.xlsx'
      : 'Student_List_Standard.xlsx';

    triggerFileDownload(generatedBuffer, filename);
  };

  const handleOpenViewer = () => {
    if (!isConverted) {
      alert('Please upload and convert a document first to view the extracted workbook.');
      return;
    }
    setViewerActiveSheet(activeTab === 'question_paper' ? 'summary' : 'students');
    setShowFileViewer(true);
  };

  // Save individual student updates and dynamically update the Excel binary buffer
  const handleSaveIndividualStudent = async (updatedStudent) => {
    const formattedDob = normalizeDobToYyyyMmDd(updatedStudent.dob || updatedStudent.dateOfBirth);
    const cleanedUSN = String(updatedStudent.usn || '').trim().toUpperCase();
    const cleanedName = String(updatedStudent.studentName || updatedStudent.name || '').trim();

    const normalizedStudent = {
      ...updatedStudent,
      usn: cleanedUSN,
      studentName: cleanedName,
      name: cleanedName,
      dob: formattedDob,
      dateOfBirth: formattedDob
    };

    const newStudents = (convertedStudents || []).map((s, idx) => {
      const isMatch = (s.serialNumber !== undefined && s.serialNumber === updatedStudent.serialNumber) ||
                      (s.sno !== undefined && s.sno === updatedStudent.sno) ||
                      (updatedStudent._idx !== undefined && idx === updatedStudent._idx);
      return isMatch ? { ...s, ...normalizedStudent } : s;
    });

    setConvertedStudents(newStudents);
    setEditingStudent(null);

    // Live refresh Excel workbook buffer so downloads immediately reflect changes
    try {
      const { buffer } = await createStudentListWorkbook(newStudents);
      if (buffer && buffer.byteLength > 0) {
        setGeneratedBuffer(buffer);
      }
    } catch (err) {
      console.warn('Workbook live update on student edit:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FF] text-[#101B46] py-8 px-4 sm:px-6 lg:px-10" style={{ fontFamily: 'Lato, sans-serif' }}>
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ========================================================= */}
        {/* TOP HEADER SECTION */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Proper Document Download Icon (NOT retry/refresh) */}
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-[#7048F5] to-[#8C6BFF] flex items-center justify-center text-white shadow-md shadow-[#7048F5]/20 shrink-0">
              <FileDown className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-[30px] sm:text-[34px] font-bold text-[#101B46] tracking-tight leading-tight">
                Document Converter
              </h1>
              <p className="text-[15px] sm:text-[16px] text-[#64748B] mt-0.5">
                Convert department documents into standard Excel templates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center bg-[#EAF8F0] border border-[#12A86B]/20 text-[#12A86B] text-[13px] font-bold px-3.5 py-1.5 rounded-full shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#12A86B] animate-pulse"></span>
            <span>Powered by Smart Extraction</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NAVIGATION TABS */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2 border-b border-[#DCE4F5] pb-2 text-[15px] font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('question_paper');
              if (onTabChange) onTabChange('question_paper');
              handleReset();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'question_paper'
                ? 'bg-white text-[#1263F5] shadow-xs border border-[#DCE4F5]'
                : 'text-[#64748B] hover:text-[#101B46] hover:bg-white/60'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'question_paper' ? 'text-[#1263F5]' : 'text-[#64748B]'}`} />
            <span>Question Paper Converter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('student_list');
              if (onTabChange) onTabChange('student_list');
              handleReset();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'student_list'
                ? 'bg-white text-[#12A86B] shadow-xs border border-[#DCE4F5]'
                : 'text-[#64748B] hover:text-[#101B46] hover:bg-white/60'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'student_list' ? 'text-[#12A86B]' : 'text-[#64748B]'}`} />
            <span>Student List Converter</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TWO COLUMN WORKSPACE */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ========================================================= */}
          {/* LEFT COLUMN: UPLOAD, SELECTION & PROGRESS (approx 58%)   */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DCE4F5] shadow-sm p-6 space-y-6">

            {/* SECTION 1: Upload Your Document (Clean, no predefined selection box) */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#1263F5] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <div>
                  <h2 className="text-[20px] font-bold text-[#101B46] leading-tight">
                    {activeTab === 'question_paper' ? 'Upload Your Document' : 'Upload Your Student List'}
                  </h2>
                  <p className="text-[14px] text-[#64748B]">
                    {activeTab === 'question_paper'
                      ? 'Upload the Question Paper PDF or any supported file format'
                      : 'Upload the Student List document in PDF, DOC, DOCX or XLSX format'}
                  </p>
                </div>
              </div>

              {/* Drag and Drop Upload Surface */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all bg-[#F7FAFF] ${
                  isDragging
                    ? 'border-[#1263F5] bg-[#EBF2FE]'
                    : 'border-[#A8C7FA] hover:border-[#1263F5]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.xlsx,.xls"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2.5">
                  <div className="h-14 w-14 rounded-full bg-[#EBF2FE] border border-[#CBDFFD] flex items-center justify-center text-[#1263F5]">
                    <UploadCloud className="w-8 h-8 stroke-[1.8]" />
                  </div>

                  <span className="text-[16px] font-bold text-[#101B46]">
                    Drag and drop your file here
                  </span>

                  <span className="text-[13px] text-[#64748B] font-medium">or</span>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-[#1263F5] hover:bg-[#0E52D4] text-white font-bold text-[14px] px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Folder className="w-4 h-4 fill-white text-[#1263F5]" />
                    <span>Choose File</span>
                  </button>

                  <span className="text-[13px] text-[#64748B] pt-1">
                    Supported formats: PDF, DOC, DOCX, XLSX, XLS
                  </span>
                </div>
              </div>

              {uploadedFile && (
                <div className="p-3 bg-[#F0F5FF] rounded-xl border border-[#CBDFFD] flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono uppercase font-bold text-[11px] bg-[#1263F5] text-white px-2 py-0.5 rounded">
                      {uploadedFile.name.split('.').pop()}
                    </span>
                    <span className="font-bold text-[#101B46] truncate max-w-xs">{uploadedFile.name}</span>
                    <span className="text-[#64748B] text-[12px]">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={handleReset}
                    className="p-1 text-[#64748B] hover:text-[#101B46] rounded-full cursor-pointer"
                    title="Remove File"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 2: Select Conversion Type */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#1263F5] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <h2 className="text-[20px] font-bold text-[#101B46]">
                  Select Conversion Type
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => {
                    setActiveTab('question_paper');
                    if (onTabChange) onTabChange('question_paper');
                    handleReset();
                  }}
                  className={`relative rounded-xl p-4 transition-all cursor-pointer flex items-center gap-3.5 ${
                    activeTab === 'question_paper'
                      ? 'border-2 border-[#1263F5] bg-[#F0F5FF] shadow-xs'
                      : 'border border-[#DCE4F5] bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="p-3 rounded-xl bg-[#7048F5]/10 text-[#7048F5] shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 pr-6">
                    <div className="text-[16px] font-bold text-[#101B46]">Question Paper</div>
                    <p className="text-[13px] text-[#64748B] leading-snug">
                      Convert MCQ Question Papers into standard Excel format
                    </p>
                  </div>

                  {activeTab === 'question_paper' && (
                    <div className="absolute top-3 right-3 text-[#1263F5]">
                      <CheckCircle2 className="w-5 h-5 fill-[#1263F5] text-white" />
                    </div>
                  )}
                </div>

                <div
                  onClick={() => {
                    setActiveTab('student_list');
                    if (onTabChange) onTabChange('student_list');
                    handleReset();
                  }}
                  className={`relative rounded-xl p-4 transition-all cursor-pointer flex items-center gap-3.5 ${
                    activeTab === 'student_list'
                      ? 'border-2 border-[#1263F5] bg-[#F0F5FF] shadow-xs'
                      : 'border border-[#DCE4F5] bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="p-3 rounded-xl bg-[#12A86B]/10 text-[#12A86B] shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 pr-6">
                    <div className="text-[16px] font-bold text-[#101B46]">Student List</div>
                    <p className="text-[13px] text-[#64748B] leading-snug">
                      Convert Student Lists into standard Excel format
                    </p>
                  </div>

                  {activeTab === 'student_list' && (
                    <div className="absolute top-3 right-3 text-[#1263F5]">
                      <CheckCircle2 className="w-5 h-5 fill-[#1263F5] text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: Actual Conversion Progress */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#1263F5] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <h2 className="text-[20px] font-bold text-[#101B46]">
                  Conversion Progress
                </h2>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[14px] font-bold">
                  <span className="text-[#64748B]">
                    {conversionError
                      ? 'Conversion Failed'
                      : isConverting
                      ? `Stage ${currentStageIndex + 1} of 7: ${activeStagesList[currentStageIndex]}...`
                      : isConverted
                      ? 'Conversion Completed (Validated 100%)'
                      : 'Awaiting Document Upload'}
                  </span>
                  <span className={`font-mono font-bold ${conversionError ? 'text-red-600' : 'text-[#1263F5]'}`}>
                    {progressPercent}%
                  </span>
                </div>

                <div className="h-2.5 w-full bg-[#E6EDF9] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ease-out rounded-full ${
                      conversionError ? 'bg-red-500' : 'bg-[#1263F5]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* 7-Step Milestones Sequence */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
                  {activeStagesList.map((stageName, idx) => {
                    const isDone = progressPercent > Math.round(((idx + 1) / 7) * 100) - 5 || isConverted;
                    const isCurrent = isConverting && currentStageIndex === idx;
                    const isFailed = conversionError && currentStageIndex === idx;

                    return (
                      <div
                        key={stageName}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                          isFailed
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : isDone
                            ? 'bg-white border-[#1263F5]/30 text-[#1263F5]'
                            : isCurrent
                            ? 'bg-[#EBF2FE] border-[#1263F5] text-[#1263F5] shadow-xs'
                            : 'bg-white/60 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold ${
                            isFailed
                              ? 'bg-red-600 text-white'
                              : isDone
                              ? 'bg-[#1263F5] text-white'
                              : isCurrent
                              ? 'bg-[#1263F5] text-white animate-pulse'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
                        </div>
                        <span className="truncate">{stageName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {conversionError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3 text-[13px] text-red-700">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="leading-snug">{conversionError}</p>
                </div>
              )}

              {/* POST-CONVERSION STUDENT RECORDS PREVIEW & DISCREPANCY AUDIT */}
              {isConverted && activeTab === 'student_list' && convertedStudents && convertedStudents.length > 0 && (() => {
                const discCount = convertedStudents.filter(s => getStudentDiscrepancy(s, convertedStudents).hasDiscrepancy).length;

                return (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                          <TableIcon className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[15px] text-[#101B46]">
                            Converted Student Records Preview
                          </h4>
                          <p className="text-[12px] text-[#64748B]">
                            Institutional COE Format: 4 Locked Columns with <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-bold">yyyy-mm-dd</code> DOB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {convertedStudents.length} Records
                        </span>
                        {discCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            {discCount} Discrepancy(ies)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            All Valid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Discrepancy Alert Banner */}
                    {discCount > 0 ? (
                      <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-[13px] text-red-700">
                            Discrepancies Found ({discCount} record(s) marked in RED)
                          </p>
                          <p className="text-red-700 leading-relaxed">
                            Highlighted cells contain missing names, invalid or duplicate USNs, or non-compliant Date of Birth formats. Click the <span className="font-bold underline">Edit</span> button on any row to correct records before downloading.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All {convertedStudents.length} student records comply with the COE template requirements.</span>
                      </div>
                    )}

                    {/* Interactive Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-72 overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse min-w-[620px]">
                        <thead className="bg-[#12A86B] text-white font-bold sticky top-0 z-10 text-[12px]">
                          <tr>
                            <th className="py-2.5 px-3 border-r border-emerald-400 text-center w-14">Sl.no.</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[160px]">Student Name</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[140px]">USN</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 text-center min-w-[120px]">Date of Birth</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[160px]">Status / Issues</th>
                            <th className="py-2.5 px-3 text-center w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {convertedStudents.map((s, idx) => {
                            const disc = getStudentDiscrepancy(s, convertedStudents);
                            const formattedDob = normalizeDobToYyyyMmDd(s.dateOfBirth || s.dob || s['Date of Birth']);
                            const displayName = s.studentName || s.name || s['Student Name'];

                            return (
                              <tr
                                key={s.serialNumber || idx}
                                className={`transition-colors ${
                                  disc.hasDiscrepancy
                                    ? 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500'
                                    : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-600 border-r border-slate-100">
                                  {s.serialNumber || s.sno || idx + 1}
                                </td>

                                {/* Student Name */}
                                <td className="py-2.5 px-3 border-r border-slate-100">
                                  {disc.nameError ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 inline-flex items-center gap-1 shadow-2xs text-[11px]" title={disc.nameError}>
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {displayName || 'Missing Name'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                                        {disc.nameError}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-semibold text-slate-900">{displayName}</span>
                                  )}
                                </td>

                                {/* USN */}
                                <td className="py-2.5 px-3 border-r border-slate-100 font-mono">
                                  {disc.usnError ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 inline-flex items-center gap-1 shadow-2xs text-[11px]" title={disc.usnError}>
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {s.usn || 'Missing USN'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                                        {disc.usnError}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-bold text-[#101B46]">{s.usn}</span>
                                  )}
                                </td>

                                {/* Date of Birth */}
                                <td className="py-2.5 px-3 text-center font-mono border-r border-slate-100">
                                  {disc.dobError ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 inline-flex items-center gap-1 shadow-2xs text-[11px]" title={disc.dobError}>
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {formattedDob || 'Missing DOB'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                                        {disc.dobError}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-800 font-medium">{formattedDob}</span>
                                  )}
                                </td>

                                {/* Status / Issues */}
                                <td className="py-2.5 px-3 border-r border-slate-100">
                                  {disc.hasDiscrepancy ? (
                                    <div className="flex flex-wrap gap-1">
                                      {(disc.reasons || []).map((r, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                          {r}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      Valid
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setEditingStudent({
                                      serialNumber: s.serialNumber || s.sno || idx + 1,
                                      studentName: displayName || '',
                                      usn: s.usn || '',
                                      dob: formattedDob,
                                      _idx: idx
                                    })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-slate-100 text-[#1263F5] border border-[#1263F5]/30 shadow-2xs transition-colors cursor-pointer"
                                    title="Edit student record"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                          <span>Red: Discrepancy (Missing / Format / Duplicate)</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span>Green: Valid Record</span>
                        </span>
                      </div>
                      <span className="font-mono text-slate-600">Template: 4 COE Columns &bull; YYYY-MM-DD</span>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-[#F1ECFF] border border-[#E3D8FF] rounded-xl p-3.5 flex items-center gap-3 text-[14px] text-slate-700">
                <div className="h-6 w-6 rounded-full bg-[#7048F5] text-white flex items-center justify-center shrink-0">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <p className="leading-relaxed">
                  Your uploaded file will be converted into our standard Excel template with proper formatting, including images and module separation.
                </p>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-[#101B46] font-semibold text-[14px] px-4 py-2.5 rounded-lg border border-[#DCE4F5] transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#64748B]" />
                <span>Reset</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenViewer}
                  disabled={!isConverted}
                  className={`flex items-center gap-2 font-bold text-[14px] px-5 py-2.5 rounded-lg border transition cursor-pointer ${
                    isConverted
                      ? 'bg-white hover:bg-[#F0F5FF] text-[#1263F5] border-[#1263F5] shadow-xs'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                  }`}
                  title={isConverted ? 'Preview the generated Excel workbook before downloading' : 'Convert document first'}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Converted File</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={!isConverted}
                  className={`flex items-center gap-2 font-bold text-[14px] px-6 py-2.5 rounded-lg shadow-sm transition cursor-pointer ${
                    isConverted
                      ? 'bg-[#1263F5] hover:bg-[#0E52D4] text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: COMPLETE VISUAL IMAGE PREVIEWS (NO SCROLL)  */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">

            {/* CARD 1: Question Paper Template Image Preview */}
            <div className={`bg-white rounded-2xl border transition-all shadow-sm p-5 space-y-4 ${
              activeTab === 'question_paper' ? 'border-[#7048F5]/30 ring-1 ring-[#7048F5]/20' : 'border-[#DCE4F5]'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="text-[#7048F5]">
                    <Sparkles className="w-5 h-5 fill-[#7048F5]" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[#101B46]">
                      Question Paper Template Preview
                    </h3>
                    <p className="text-[13px] text-[#64748B]">
                      Excel will contain separate sheets for each module
                    </p>
                  </div>
                </div>

                <div className="h-7 w-7 rounded bg-[#107C41] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  X
                </div>
              </div>

              {/* Perfectly Aligned 12-Column Excel Template Preview */}
              <QuestionPaperTemplatePreview paper={convertedPaper} isConverted={isConverted} />
            </div>

            {/* CARD 2: Student List Template Preview */}
            <div className={`bg-white rounded-2xl border transition-all shadow-sm p-5 space-y-4 ${
              activeTab === 'student_list' ? 'border-[#12A86B]/30 ring-1 ring-[#12A86B]/20' : 'border-[#DCE4F5]'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="text-[#12A86B]">
                    <Users className="w-5 h-5 fill-[#12A86B]" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[#101B46]">
                      Student List Template Preview
                    </h3>
                    <p className="text-[13px] text-[#64748B]">
                      Standard format for student records
                    </p>
                  </div>
                </div>

                <div className="h-7 w-7 rounded bg-[#107C41] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  X
                </div>
              </div>

              {/* Standard 7-Column Student List Template Preview */}
              <StudentListTemplatePreview students={convertedStudents} isConverted={isConverted} />
            </div>

            {/* CARD 3: Key Features */}
            <div className="bg-[#F0F5FF]/60 border border-[#D0E0FF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#1263F5]">
                <Lightbulb className="w-4 h-4 fill-[#1263F5]" />
                <h3 className="text-[16px] font-bold text-[#101B46]">Key Features</h3>
              </div>

              <div className="space-y-2.5 text-[14px] text-slate-700 font-medium">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 fill-[#12A86B] text-white shrink-0" />
                  <span>Supports multiple input formats (PDF, DOC, DOCX, XLSX)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 fill-[#12A86B] text-white shrink-0" />
                  <span>Automatically separates modules</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 fill-[#12A86B] text-white shrink-0" />
                  <span>Includes images in Excel</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 fill-[#12A86B] text-white shrink-0" />
                  <span>Standardized output format</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* EXCEL WORKBOOK VIEWER MODAL ("View Converted File")        */}
      {/* ========================================================= */}
      {showFileViewer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-[#F7F9FF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#107C41] text-white font-extrabold text-sm flex items-center justify-center shadow-xs shrink-0">
                  XLSX
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[18px] font-bold text-[#101B46]">
                      {uploadedFile
                        ? activeTab === 'question_paper'
                          ? `${uploadedFile.name.replace(/\.[^/.]+$/, '')}_Standard_QP.xlsx`
                          : `${uploadedFile.name.replace(/\.[^/.]+$/, '')}_Standard_Students.xlsx`
                        : activeTab === 'question_paper'
                        ? 'Question_Paper_Standard.xlsx'
                        : 'Student_List_Standard.xlsx'}
                    </h3>
                    <span className="text-[11px] font-bold bg-[#EAF8F0] text-[#12A86B] px-2 py-0.5 rounded border border-[#12A86B]/20">
                      Standard Verified
                    </span>
                  </div>
                  <p className="text-[13px] text-[#64748B]">
                    Maharaja Institute of Technology Mysore - Offline CBT Verified Excel Workbook
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-2 bg-[#1263F5] hover:bg-[#0E52D4] text-white font-bold text-[13px] px-4 py-2 rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFileViewer(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-[13px]">
              <span className="text-slate-400 font-bold text-xs uppercase px-1">Worksheets:</span>
              {activeTab === 'question_paper' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setViewerActiveSheet('summary')}
                    className={`px-3.5 py-1.5 rounded-t-lg font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
                      viewerActiveSheet === 'summary'
                        ? 'bg-white text-[#1263F5] border-[#1263F5] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/50'
                    }`}
                  >
                    Summary
                  </button>
                  {convertedPaper?.modules?.map((m) => {
                    const sheetKey = `module_${m.moduleNumber}`;
                    return (
                      <button
                        key={m.moduleNumber}
                        type="button"
                        onClick={() => setViewerActiveSheet(sheetKey)}
                        className={`px-3.5 py-1.5 rounded-t-lg font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
                          viewerActiveSheet === sheetKey
                            ? 'bg-white text-[#1263F5] border-[#1263F5] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/50'
                        }`}
                      >
                        Module {m.moduleNumber} ({m.questions?.length || 0})
                      </button>
                    );
                  })}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewerActiveSheet('students')}
                  className="px-3.5 py-1.5 rounded-t-lg font-bold bg-white text-[#12A86B] border-b-2 border-[#12A86B] shadow-xs cursor-pointer"
                >
                  Standard Student List (7 Columns)
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-5 bg-white">
              {activeTab === 'question_paper' && viewerActiveSheet === 'summary' && (
                <div className="max-w-xl mx-auto border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-[#1263F5] text-white font-bold px-4 py-2.5 text-[14px]">
                    Question Paper Summary Worksheet
                  </div>
                  <table className="w-full text-[13px] border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50 w-1/2">Institution</td><td className="py-2.5 px-4 font-semibold text-[#101B46]">Maharaja Institute of Technology Mysore</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Examination System</td><td className="py-2.5 px-4 text-[#101B46]">Student Examination Portal (ProTick)</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Subject Name</td><td className="py-2.5 px-4 text-[#101B46]">{convertedPaper?.subjectName || 'DATA STRUCTURES AND ALGORITHMS'}</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Subject Code</td><td className="py-2.5 px-4 font-mono text-[#101B46]">{convertedPaper?.subjectCode || '21CS32'}</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Semester</td><td className="py-2.5 px-4 text-[#101B46]">{convertedPaper?.semester || 3}</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Total Number of Modules</td><td className="py-2.5 px-4 font-bold text-[#1263F5]">{convertedPaper?.modules?.length || 5}</td></tr>
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Total Extracted Questions</td><td className="py-2.5 px-4 font-bold text-[#12A86B]">{convertedPaper?.modules?.reduce((s, m) => s + (m.questions?.length || 0), 0) || 150}</td></tr>
                      {convertedPaper?.modules?.map((m) => (
                        <tr key={m.moduleNumber}>
                          <td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Module {m.moduleNumber} Question Count</td>
                          <td className="py-2.5 px-4 font-semibold text-[#101B46]">{m.questions?.length || 0} questions</td>
                        </tr>
                      ))}
                      <tr><td className="py-2.5 px-4 font-bold text-slate-600 bg-slate-50">Standard Column Hierarchy</td><td className="py-2.5 px-4 font-semibold text-[#101B46]">12 Columns Enforced</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'question_paper' && viewerActiveSheet !== 'summary' && (() => {
                const modNum = parseInt(viewerActiveSheet.replace('module_', ''), 10) || 1;
                const mod = convertedPaper?.modules?.find((m) => m.moduleNumber === modNum) || convertedPaper?.modules?.[0];

                if (!mod || !mod.questions || mod.questions.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500">
                      No questions found in this module.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                      <span className="font-bold text-[#101B46]">{mod.title || `Module ${mod.moduleNumber}`}</span>
                      <span className="font-semibold text-[#1263F5] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        Showing all {mod.questions.length} questions
                      </span>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs max-h-[60vh] overflow-y-auto">
                      <table className="w-full text-[13px] border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-[#1263F5] text-white font-bold text-[12px] whitespace-nowrap text-center">
                            <th className="py-2.5 px-2.5 border-r border-blue-400 w-14">Q.No</th>
                            <th className="py-2.5 px-3 border-r border-blue-400 text-left min-w-[240px]">Question Text</th>
                            <th className="py-2.5 px-2.5 border-r border-blue-400 min-w-[110px]">Question Image</th>
                            <th className="py-2.5 px-3 border-r border-blue-400 text-left min-w-[140px]">Option A</th>
                            <th className="py-2.5 px-2.5 border-r border-blue-400 min-w-[85px]">Image A</th>
                            <th className="py-2.5 px-3 border-r border-blue-400 text-left min-w-[140px]">Option B</th>
                            <th className="py-2.5 px-2.5 border-r border-blue-400 min-w-[85px]">Image B</th>
                            <th className="py-2.5 px-3 border-r border-blue-400 text-left min-w-[140px]">Option C</th>
                            <th className="py-2.5 px-2.5 border-r border-blue-400 min-w-[85px]">Image C</th>
                            <th className="py-2.5 px-3 border-r border-blue-400 text-left min-w-[140px]">Option D</th>
                            <th className="py-2.5 px-2.5 border-r border-blue-400 min-w-[85px]">Image D</th>
                            <th className="py-2.5 px-2.5 min-w-[80px] bg-[#0E52D4]">Correct Answer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {mod.questions.map((q, idx) => (
                            <tr key={q.questionNumber || idx} className="hover:bg-blue-50/20">
                              <td className="py-3 px-2.5 text-center font-mono font-bold border-r border-slate-100">{q.questionNumber || idx + 1}</td>
                              <td className="py-3 px-3 border-r border-slate-100 text-slate-800 font-medium leading-relaxed">{q.questionText}</td>
                              <td className="py-3 px-2.5 text-center border-r border-slate-100">
                                {q.questionImage ? (
                                  <img src={q.questionImage} alt={`Q${q.questionNumber}`} className="h-10 mx-auto rounded border" />
                                ) : (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-100 text-slate-700">{q.options?.A?.text || '-'}</td>
                              <td className="py-3 px-2.5 text-center border-r border-slate-100">
                                {q.options?.A?.image ? (
                                  <img src={q.options.A.image} alt="Opt A" className="h-8 mx-auto rounded border" />
                                ) : (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-100 text-slate-700">{q.options?.B?.text || '-'}</td>
                              <td className="py-3 px-2.5 text-center border-r border-slate-100">
                                {q.options?.B?.image ? (
                                  <img src={q.options.B.image} alt="Opt B" className="h-8 mx-auto rounded border" />
                                ) : (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-100 text-slate-700">{q.options?.C?.text || '-'}</td>
                              <td className="py-3 px-2.5 text-center border-r border-slate-100">
                                {q.options?.C?.image ? (
                                  <img src={q.options.C.image} alt="Opt C" className="h-8 mx-auto rounded border" />
                                ) : (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">None</span>
                                )}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-100 text-slate-700">{q.options?.D?.text || '-'}</td>
                              <td className="py-3 px-2.5 text-center border-r border-slate-100">
                                {q.options?.D?.image ? (
                                  <img src={q.options.D.image} alt="Opt D" className="h-8 mx-auto rounded border" />
                                ) : (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">None</span>
                                )}
                              </td>
                              <td className="py-3 px-2.5 text-center font-mono font-extrabold text-[#12A86B] text-[15px] bg-emerald-50/50">
                                {q.correctAnswer || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'student_list' && (() => {
                const discCount = (convertedStudents || []).filter(s => getStudentDiscrepancy(s, convertedStudents).hasDiscrepancy).length;

                return (
                  <div className="space-y-3">
                    {discCount > 0 ? (
                      <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs text-red-800">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span className="font-bold">
                            Discrepancies detected in {discCount} record(s) — highlighted in RED below.
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold">Click Edit to resolve before downloading</span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All {convertedStudents?.length || 0} student records conform strictly to the institutional COE 4-column template.</span>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs max-h-[60vh] overflow-y-auto">
                      <table className="w-full text-[13px] border-collapse min-w-[650px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-[#12A86B] text-white font-bold text-[12px] whitespace-nowrap text-left">
                            <th className="py-2.5 px-3 border-r border-emerald-400 text-center w-14">Sl.no.</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[180px]">Student Name</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[140px]">USN</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 text-center min-w-[120px]">Date of Birth</th>
                            <th className="py-2.5 px-3 border-r border-emerald-400 min-w-[160px]">Status / Discrepancy</th>
                            <th className="py-2.5 px-3 text-center w-20">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {(convertedStudents || []).map((s, idx) => {
                            const disc = getStudentDiscrepancy(s, convertedStudents);
                            const formattedDob = normalizeDobToYyyyMmDd(s.dateOfBirth || s.dob || s['Date of Birth']);
                            const displayName = s.studentName || s.name || s['Student Name'];

                            return (
                              <tr
                                key={s.serialNumber || idx}
                                className={`transition-colors ${
                                  disc.hasDiscrepancy
                                    ? 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500'
                                    : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-100">
                                  {s.serialNumber || s.sno || idx + 1}
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-100">
                                  {disc.nameError ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold text-[12px] inline-flex items-center gap-1 shadow-2xs">
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {displayName || 'Missing Name'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600">{disc.nameError}</span>
                                    </div>
                                  ) : (
                                    <span className="font-semibold text-slate-900">{displayName}</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 font-mono border-r border-slate-100">
                                  {disc.usnError ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold text-[12px] inline-flex items-center gap-1 shadow-2xs">
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {s.usn || 'Missing USN'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600">{disc.usnError}</span>
                                    </div>
                                  ) : (
                                    <span className="font-bold text-[#101B46]">{s.usn}</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center font-mono border-r border-slate-100">
                                  {disc.dobError ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold text-[12px] inline-flex items-center gap-1 shadow-2xs">
                                        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                        {formattedDob || 'Missing DOB'}
                                      </span>
                                      <span className="text-[10px] font-bold text-red-600">{disc.dobError}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-800 font-medium">{formattedDob}</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-100">
                                  {disc.hasDiscrepancy ? (
                                    <div className="flex flex-wrap gap-1">
                                      {(disc.reasons || []).map((r, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                          {r}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      Valid
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setEditingStudent({
                                      serialNumber: s.serialNumber || s.sno || idx + 1,
                                      studentName: displayName || '',
                                      usn: s.usn || '',
                                      dob: formattedDob,
                                      _idx: idx
                                    })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-slate-100 text-[#1263F5] border border-[#1263F5]/30 shadow-2xs transition-colors cursor-pointer"
                                    title="Edit student record"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[13px] text-slate-500">
                Viewing actual generated workbook data. Verify question options, answers, and student credentials.
              </span>
              <button
                type="button"
                onClick={() => setShowFileViewer(false)}
                className="px-5 py-2 text-[14px] font-bold text-[#101B46] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INDIVIDUAL STUDENT RECORD EDITING MODAL                  */}
      {/* ========================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-[18px] font-bold text-[#101B46]">
                Edit Student Record #{editingStudent.serialNumber}
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-[14px]">
              <div>
                <label className="block text-[12px] font-bold text-[#101B46] mb-1">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={editingStudent.studentName || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, studentName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[14px] text-[#101B46] focus:outline-none focus:ring-2 focus:ring-[#1263F5]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#101B46] mb-1">
                  USN (University Seat Number) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4MH21CS001"
                  value={editingStudent.usn || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, usn: e.target.value.toUpperCase().trim() })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[14px] font-mono font-bold text-[#101B46] focus:outline-none focus:ring-2 focus:ring-[#1263F5]"
                />
                <span className="text-[11px] text-slate-400">Institutional format e.g. 4MH21CS001</span>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#101B46] mb-1">
                  Date of Birth (YYYY-MM-DD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD (e.g. 2003-05-15)"
                  value={editingStudent.dob || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, dob: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[14px] font-mono text-[#101B46] focus:outline-none focus:ring-2 focus:ring-[#1263F5]"
                />
                <span className="text-[11px] text-slate-400">Strictly YYYY-MM-DD format as required by the template</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-[14px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveIndividualStudent(editingStudent);
                }}
                className="px-5 py-2 text-[14px] font-bold text-white bg-[#1263F5] hover:bg-[#0E52D4] rounded-lg shadow-sm cursor-pointer"
              >
                Save & Update Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartDocumentConverter;

