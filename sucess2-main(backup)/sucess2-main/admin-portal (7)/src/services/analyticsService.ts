import { StudentExamResult } from '../types';

export interface TopPerformerGroup {
  examinationId: string;
  subjectCode: string;
  subjectName: string;
  highestPercentage: number;
  maxMarks: number;
  toppers: {
    usn: string;
    studentName: string;
    section: string;
    marksObtained: number;
    percentage: number;
  }[];
}

export interface DepartmentPerformanceAnalytics {
  summary: {
    studentsEvaluated: number; // Present evaluations
    uniqueEvaluatedStudents: number;
    absentStudents: number;
    passCount: number;
    failCount: number;
    passPercentage: number;
    failPercentage: number;
    averagePercentage: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  topPerformersByExam: TopPerformerGroup[];
  subjectPerformance: {
    examinationId: string;
    subjectCode: string;
    subjectName: string;
    semesterNumber: number;
    maxMarks: number;
    evaluatedCount: number;
    absentCount: number;
    passPercentage: number;
    averagePercentage: number;
    highestPercentage: number;
    lowestPercentage: number;
  }[];
  sectionPerformance: {
    section: string;
    evaluatedCount: number;
    absentCount: number;
    passPercentage: number;
    averagePercentage: number;
  }[];
  semesterPerformance: {
    semesterNumber: number;
    evaluatedCount: number;
    absentCount: number;
    passPercentage: number;
    averagePercentage: number;
  }[];
}

export const analyticsService = {
  computeDepartmentAnalytics(releasedResults: StudentExamResult[]): DepartmentPerformanceAnalytics {
    const present = releasedResults.filter(
      (r) => r.attendance === 'Present' && r.percentage !== null && r.marksObtained !== null
    );
    const absent = releasedResults.filter((r) => r.attendance === 'Absent');
    const passed = present.filter((r) => r.resultOutcome === 'Pass');
    const failed = present.filter((r) => r.resultOutcome === 'Fail');
    const pcts = present.map((r) => r.percentage as number);

    const uniqueEvaluated = new Set(present.map((r) => r.usn.toUpperCase())).size;

    const summary = {
      studentsEvaluated: present.length,
      uniqueEvaluatedStudents: uniqueEvaluated,
      absentStudents: absent.length,
      passCount: passed.length,
      failCount: failed.length,
      passPercentage: present.length > 0 ? Number(((passed.length / present.length) * 100).toFixed(1)) : 0,
      failPercentage: present.length > 0 ? Number(((failed.length / present.length) * 100).toFixed(1)) : 0,
      averagePercentage:
        pcts.length > 0 ? Number((pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1)) : 0,
      highestPercentage: pcts.length > 0 ? Number(Math.max(...pcts).toFixed(1)) : 0,
      lowestPercentage: pcts.length > 0 ? Number(Math.min(...pcts).toFixed(1)) : 0,
    };

    // Group by examination for percentage comparisons & tied toppers
    const byExam = new Map<string, StudentExamResult[]>();
    releasedResults.forEach((r) => {
      const list = byExam.get(r.examinationId) || [];
      list.push(r);
      byExam.set(r.examinationId, list);
    });

    const subjectPerformance: DepartmentPerformanceAnalytics['subjectPerformance'] = [];
    const topPerformersByExam: TopPerformerGroup[] = [];

    byExam.forEach((rows, examId) => {
      const exPres = rows.filter((x) => x.attendance === 'Present' && x.percentage !== null);
      const exAbs = rows.filter((x) => x.attendance === 'Absent');
      const exPass = exPres.filter((x) => x.resultOutcome === 'Pass');
      const exPcts = exPres.map((x) => x.percentage as number);
      const high = exPcts.length > 0 ? Math.max(...exPcts) : 0;

      subjectPerformance.push({
        examinationId: examId,
        subjectCode: rows[0].subjectCode,
        subjectName: rows[0].subjectName,
        semesterNumber: rows[0].semesterNumber,
        maxMarks: rows[0].maxMarks,
        evaluatedCount: exPres.length,
        absentCount: exAbs.length,
        passPercentage: exPres.length > 0 ? Number(((exPass.length / exPres.length) * 100).toFixed(1)) : 0,
        averagePercentage:
          exPcts.length > 0 ? Number((exPcts.reduce((a, b) => a + b, 0) / exPcts.length).toFixed(1)) : 0,
        highestPercentage: Number(high.toFixed(1)),
        lowestPercentage: exPcts.length > 0 ? Number(Math.min(...exPcts).toFixed(1)) : 0,
      });

      if (exPres.length > 0) {
        // Tied topper handling: include ALL students matching the highest percentage
        const tiedToppers = exPres
          .filter((x) => x.percentage === high)
          .map((x) => ({
            usn: x.usn,
            studentName: x.studentName,
            section: x.originalSection,
            marksObtained: x.marksObtained as number,
            percentage: x.percentage as number,
          }));

        topPerformersByExam.push({
          examinationId: examId,
          subjectCode: rows[0].subjectCode,
          subjectName: rows[0].subjectName,
          highestPercentage: Number(high.toFixed(1)),
          maxMarks: rows[0].maxMarks,
          toppers: tiedToppers,
        });
      }
    });

    // Section-wise performance
    const bySection = new Map<string, StudentExamResult[]>();
    releasedResults.forEach((r) => {
      const list = bySection.get(r.originalSection) || [];
      list.push(r);
      bySection.set(r.originalSection, list);
    });

    const sectionPerformance = Array.from(bySection.entries())
      .map(([section, rows]) => {
        const sPres = rows.filter((x) => x.attendance === 'Present' && x.percentage !== null);
        const sAbs = rows.filter((x) => x.attendance === 'Absent');
        const sPass = sPres.filter((x) => x.resultOutcome === 'Pass');
        const sPcts = sPres.map((x) => x.percentage as number);
        return {
          section,
          evaluatedCount: sPres.length,
          absentCount: sAbs.length,
          passPercentage: sPres.length > 0 ? Number(((sPass.length / sPres.length) * 100).toFixed(1)) : 0,
          averagePercentage:
            sPcts.length > 0 ? Number((sPcts.reduce((a, b) => a + b, 0) / sPcts.length).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => a.section.localeCompare(b.section));

    // Semester-wise performance
    const bySemester = new Map<number, StudentExamResult[]>();
    releasedResults.forEach((r) => {
      const list = bySemester.get(r.semesterNumber) || [];
      list.push(r);
      bySemester.set(r.semesterNumber, list);
    });

    const semesterPerformance = Array.from(bySemester.entries())
      .map(([semesterNumber, rows]) => {
        const semPres = rows.filter((x) => x.attendance === 'Present' && x.percentage !== null);
        const semAbs = rows.filter((x) => x.attendance === 'Absent');
        const semPass = semPres.filter((x) => x.resultOutcome === 'Pass');
        const semPcts = semPres.map((x) => x.percentage as number);
        return {
          semesterNumber,
          evaluatedCount: semPres.length,
          absentCount: semAbs.length,
          passPercentage: semPres.length > 0 ? Number(((semPass.length / semPres.length) * 100).toFixed(1)) : 0,
          averagePercentage:
            semPcts.length > 0 ? Number((semPcts.reduce((a, b) => a + b, 0) / semPcts.length).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => a.semesterNumber - b.semesterNumber);

    return {
      summary,
      topPerformersByExam,
      subjectPerformance,
      sectionPerformance,
      semesterPerformance,
    };
  },
};
