import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export function exportRowsToCsv(
  fileName: string,
  rows: Record<string, string | number | boolean | null | undefined>[]
): void {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRowsToExcel(
  fileName: string,
  sheetName: string,
  rows: Record<string, string | number | boolean | null | undefined>[]
): void {
  if (!rows || rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const targetName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, targetName);
}

export interface PdfResultExportMeta {
  examinationCode: string;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  semester: number;
  examDate: string;
  maximumMarks: number;
  passingMarks: number;
}

export function exportResultsToPdf(
  fileName: string,
  meta: PdfResultExportMeta,
  rows: {
    studentName: string;
    usn: string;
    originalSection?: string;
    marksObtained: string;
    maximumMarks: number;
    attendanceStatus: string;
    resultStatus: string;
    isTopper: boolean;
  }[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Institutional Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(23, 36, 58);
  doc.text('Maharaja Institute of Technology Mysore', margin, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Examination Management System — Controller of Examinations (COE) Official Result Report',
    margin,
    58
  );

  // Exam Metadata Box
  doc.setDrawColor(217, 226, 239);
  doc.setFillColor(245, 247, 251);
  doc.roundedRect(margin, 70, pageWidth - margin * 2, 54, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(
    `${meta.subjectCode}: ${meta.subjectName} (${meta.examinationCode})`,
    margin + 12,
    88
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Department: ${meta.departmentName} | Semester: ${meta.semester} | Date: ${meta.examDate} | Max Marks: ${meta.maximumMarks} | Passing Marks: ${meta.passingMarks}`,
    margin + 12,
    106
  );

  // Table Header
  let y = 144;
  const colPositions = [
    margin + 6,
    margin + 36,
    margin + 195,
    margin + 285,
    margin + 355,
    margin + 415,
    margin + 475,
  ];

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(23, 36, 58);
    doc.rect(margin, topY - 14, pageWidth - margin * 2, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('#', colPositions[0], topY);
    doc.text('Student Name', colPositions[1], topY);
    doc.text('USN', colPositions[2], topY);
    doc.text('Marks', colPositions[3], topY);
    doc.text('Max', colPositions[4], topY);
    doc.text('Attendance', colPositions[5], topY);
    doc.text('Result', colPositions[6], topY);
  };

  drawTableHeader(y);
  y += 20;

  rows.forEach((row, index) => {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 46;
      drawTableHeader(y);
      y += 20;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F');
    }

    doc.setFont('helvetica', row.isTopper ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);

    const displayName = row.isTopper
      ? `${row.studentName} [TOPPER]`
      : row.studentName;

    doc.text(String(index + 1), colPositions[0], y);
    doc.text(displayName.slice(0, 30), colPositions[1], y);
    doc.text(row.usn, colPositions[2], y);
    doc.text(String(row.marksObtained), colPositions[3], y);
    doc.text(String(row.maximumMarks), colPositions[4], y);
    doc.text(row.attendanceStatus, colPositions[5], y);
    doc.text(row.resultStatus, colPositions[6], y);

    y += 18;
  });

  const targetName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  doc.save(targetName);
}
