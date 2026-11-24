import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCsv).join(',')];
  rows.forEach((row) => {
    lines.push(row.map(escapeCsv).join(','));
  });

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => (r[i] !== null && r[i] !== undefined ? String(r[i]).length : 0))
    );
    return { wch: Math.min(Math.max(maxLen + 4, 12), 52) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportTableToPdf(params: {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  orientation?: 'portrait' | 'landscape';
}): void {
  const doc = new jsPDF({
    orientation: params.orientation || 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  doc.setFontSize(13);
  doc.setTextColor(23, 36, 58);
  doc.text('Maharaja Institute of Technology Mysore', 40, 38);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(params.title, 40, 56);

  if (params.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(params.subtitle, 40, 72);
  }

  autoTable(doc, {
    startY: params.subtitle ? 86 : 70,
    head: [params.headers],
    body: params.rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)))),
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      textColor: [31, 41, 55],
    },
    headStyles: {
      fillColor: [23, 36, 58],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 251],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
