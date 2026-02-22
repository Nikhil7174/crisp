import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuestionBreakdown {
  questionId: string;
  question: string;
  score: number;
  feedback: string;
  keyPointsCovered: string[];
  timeTaken?: number;
  hintsUsed?: number;
}

interface CodeReview {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

interface ProblemBreakdown {
  problemId: string;
  problem: string;
  score: number;
  feedback: string;
  codeReview?: CodeReview;
  testResults?: TestResult[];
  timeComplexity?: string;
  spaceComplexity?: string;
  timeTaken?: number;
  hintsUsed?: number;
}

interface DetailedEvaluation {
  theoreticalSection?: {
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    questionBreakdown?: QuestionBreakdown[];
  };
  codingSection?: {
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    problemBreakdown?: ProblemBreakdown[];
  };
  overall: {
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    learningRecommendations?: string[];
  };
  summaryStatistics?: {
    totalQuestions: number;
    totalProblems: number;
    averageScore: number;
    totalHints: number;
    totalClarifications: number;
    totalFollowUps: number;
    averageTimePerQuestion: number;
    averageTimePerProblem: number;
  };
}

export const generateFeedbackPDF = (
  evaluation: DetailedEvaluation,
  candidateName?: string,
  interviewDate?: string,
  companyName?: string,
  companyLogoUrl?: string
): void => {
  const doc = new jsPDF();
  let yPosition = 20;

  const displayCompanyName = companyName || 'Shakra AI interview';

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.height - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.4 + 2);
  };

  // Add company logo if provided (only base64 or data URLs work in jsPDF)
  if (companyLogoUrl && (companyLogoUrl.startsWith('data:') || companyLogoUrl.startsWith('http'))) {
    try {
      // For base64 images, add directly
      if (companyLogoUrl.startsWith('data:')) {
        doc.addImage(companyLogoUrl, 'PNG', 14, yPosition, 40, 15);
        yPosition += 20;
      }
      // For HTTP URLs, we'd need to fetch and convert, but that's async
      // For now, skip HTTP URLs in PDF
    } catch (error) {
      console.warn('Failed to add company logo to PDF:', error);
    }
  }

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Interview Feedback', 14, yPosition);
  yPosition += 10;

  // Company Name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(displayCompanyName, 14, yPosition);
  yPosition += 7;

  if (candidateName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Candidate: ${candidateName}`, 14, yPosition);
    yPosition += 7;
  }

  if (interviewDate) {
    doc.setFontSize(10);
    doc.text(`Interview Date: ${interviewDate}`, 14, yPosition);
    yPosition += 7;
  }

  // Overall Score
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const overallScore = evaluation.overall.score;
  const scoreColor = overallScore >= 80 ? [46, 125, 50] : overallScore >= 60 ? [237, 108, 2] : [211, 47, 47];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`Overall Score: ${overallScore}/100`, 14, yPosition);
  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  // Summary Statistics
  if (evaluation.summaryStatistics) {
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 14, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const stats = [
      [`Total Questions: ${evaluation.summaryStatistics.totalQuestions}`],
      [`Total Problems: ${evaluation.summaryStatistics.totalProblems}`],
      [`Average Score: ${evaluation.summaryStatistics.averageScore.toFixed(1)}/100`],
      [`Total Hints: ${evaluation.summaryStatistics.totalHints}`],
      [`Clarifications: ${evaluation.summaryStatistics.totalClarifications}`],
      [`Follow-ups: ${evaluation.summaryStatistics.totalFollowUps}`],
      [`Avg Time/Question: ${(evaluation.summaryStatistics.averageTimePerQuestion / 60).toFixed(1)}min`],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: stats.map(s => [s[0].split(': ')[0], s[0].split(': ')[1]]),
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // Overall Assessment
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Overall Assessment', 14, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPosition += addWrappedText(evaluation.overall.feedback, 14, yPosition, 180) + 5;

  // Strengths
  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Strengths:', 14, yPosition);
  yPosition += 5;
  doc.setFont('helvetica', 'normal');
  evaluation.overall.strengths.forEach((strength) => {
    checkPageBreak(10);
    yPosition += addWrappedText(`• ${strength}`, 20, yPosition, 175) + 3;
  });

  // Areas for Improvement
  checkPageBreak(20);
  yPosition += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Areas for Improvement:', 14, yPosition);
  yPosition += 5;
  doc.setFont('helvetica', 'normal');
  evaluation.overall.areasForImprovement.forEach((area) => {
    checkPageBreak(10);
    yPosition += addWrappedText(`• ${area}`, 20, yPosition, 175) + 3;
  });

  // Learning Recommendations
  if (evaluation.overall.learningRecommendations && evaluation.overall.learningRecommendations.length > 0) {
    checkPageBreak(20);
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Learning Recommendations:', 14, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    evaluation.overall.learningRecommendations.forEach((rec) => {
      checkPageBreak(10);
      yPosition += addWrappedText(`• ${rec}`, 20, yPosition, 175) + 3;
    });
  }

  // Theoretical Section (only if exists)
  if (evaluation.theoreticalSection) {
    // Add small gap between sections instead of new page
    checkPageBreak(50);
    yPosition += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Theoretical Section (Score: ${evaluation.theoreticalSection.score}/100)`, 14, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPosition += addWrappedText(evaluation.theoreticalSection.feedback, 14, yPosition, 180) + 5;

    // Theoretical Strengths
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Strengths:', 14, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    evaluation.theoreticalSection.strengths.forEach((strength) => {
      checkPageBreak(10);
      yPosition += addWrappedText(`• ${strength}`, 20, yPosition, 175) + 3;
    });

    // Theoretical Areas for Improvement
    checkPageBreak(20);
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Areas for Improvement:', 14, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    evaluation.theoreticalSection.areasForImprovement.forEach((area) => {
      checkPageBreak(10);
      yPosition += addWrappedText(`• ${area}`, 20, yPosition, 175) + 3;
    });

    // Question Breakdown
    if (evaluation.theoreticalSection.questionBreakdown && evaluation.theoreticalSection.questionBreakdown.length > 0) {
      checkPageBreak(30);
      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Question-by-Question Breakdown', 14, yPosition);
      yPosition += 7;

      evaluation.theoreticalSection.questionBreakdown.forEach((q, idx) => {
        checkPageBreak(40);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Question ${idx + 1} (Score: ${q.score}/100)`, 14, yPosition);
        yPosition += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        yPosition += addWrappedText(`Q: ${q.question}`, 20, yPosition, 175) + 5;
        yPosition += addWrappedText(`Feedback: ${q.feedback}`, 20, yPosition, 175) + 5;

        if (q.keyPointsCovered && q.keyPointsCovered.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text('Key Points Covered:', 20, yPosition);
          yPosition += 5;
          doc.setFont('helvetica', 'normal');
          q.keyPointsCovered.forEach((point) => {
            checkPageBreak(8);
            yPosition += addWrappedText(`• ${point}`, 25, yPosition, 170) + 3;
          });
        }

        if (q.hintsUsed !== undefined || q.timeTaken !== undefined) {
          yPosition += 3;
          const metrics: string[] = [];
          if (q.hintsUsed !== undefined) metrics.push(`Hints: ${q.hintsUsed}`);
          if (q.timeTaken !== undefined) metrics.push(`Time: ${q.timeTaken.toFixed(1)}s`);
          doc.text(metrics.join(' | '), 20, yPosition);
          yPosition += 5;
        }

        yPosition += 5;
      });
    }
  }

  // Coding Section (only if exists)
  if (evaluation.codingSection) {
    // Add small gap between sections instead of new page
    checkPageBreak(50);
    yPosition += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Coding Section (Score: ${evaluation.codingSection.score}/100)`, 14, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPosition += addWrappedText(evaluation.codingSection.feedback, 14, yPosition, 180) + 5;

    // Coding Strengths
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Strengths:', 14, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    evaluation.codingSection.strengths.forEach((strength) => {
      checkPageBreak(10);
      yPosition += addWrappedText(`• ${strength}`, 20, yPosition, 175) + 3;
    });

    // Coding Areas for Improvement
    checkPageBreak(20);
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Areas for Improvement:', 14, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    evaluation.codingSection.areasForImprovement.forEach((area) => {
      checkPageBreak(10);
      yPosition += addWrappedText(`• ${area}`, 20, yPosition, 175) + 3;
    });

    // Problem Breakdown
    if (evaluation.codingSection.problemBreakdown && evaluation.codingSection.problemBreakdown.length > 0) {
      checkPageBreak(30);
      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Problem-by-Problem Breakdown', 14, yPosition);
      yPosition += 7;

      evaluation.codingSection.problemBreakdown.forEach((p, idx) => {
        checkPageBreak(50);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Problem ${idx + 1} (Score: ${p.score}/100)`, 14, yPosition);
        yPosition += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        yPosition += addWrappedText(`Problem: ${p.problem}`, 20, yPosition, 175) + 5;
        yPosition += addWrappedText(`Feedback: ${p.feedback}`, 20, yPosition, 175) + 5;

        if (p.timeComplexity || p.spaceComplexity) {
          const complexities: string[] = [];
          if (p.timeComplexity) complexities.push(`Time: ${p.timeComplexity}`);
          if (p.spaceComplexity) complexities.push(`Space: ${p.spaceComplexity}`);
          doc.text(complexities.join(' | '), 20, yPosition);
          yPosition += 5;
        }

        if (p.codeReview) {
          checkPageBreak(30);
          yPosition += 5;
          doc.setFont('helvetica', 'bold');
          doc.text('Code Review:', 20, yPosition);
          yPosition += 5;

          if (p.codeReview.strengths && p.codeReview.strengths.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(46, 125, 50);
            doc.text('Strengths:', 25, yPosition);
            yPosition += 5;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            p.codeReview.strengths.forEach((s) => {
              checkPageBreak(8);
              yPosition += addWrappedText(`• ${s}`, 30, yPosition, 165) + 3;
            });
          }

          if (p.codeReview.weaknesses && p.codeReview.weaknesses.length > 0) {
            checkPageBreak(20);
            yPosition += 3;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(211, 47, 47);
            doc.text('Weaknesses:', 25, yPosition);
            yPosition += 5;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            p.codeReview.weaknesses.forEach((w) => {
              checkPageBreak(8);
              yPosition += addWrappedText(`• ${w}`, 30, yPosition, 165) + 3;
            });
          }

          if (p.codeReview.suggestions && p.codeReview.suggestions.length > 0) {
            checkPageBreak(20);
            yPosition += 3;
            doc.setFont('helvetica', 'bold');
            doc.text('Suggestions:', 25, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            p.codeReview.suggestions.forEach((s) => {
              checkPageBreak(8);
              yPosition += addWrappedText(`• ${s}`, 30, yPosition, 165) + 3;
            });
          }
        }

        if (p.testResults && p.testResults.length > 0) {
          checkPageBreak(40);
          yPosition += 5;
          doc.setFont('helvetica', 'bold');
          doc.text('Test Results:', 20, yPosition);
          yPosition += 5;

          const testData = p.testResults.map((t) => [
            t.passed ? 'Passed' : 'Failed',
            t.input.substring(0, 30) + (t.input.length > 30 ? '...' : ''),
            t.expectedOutput.substring(0, 30) + (t.expectedOutput.length > 30 ? '...' : ''),
            t.actualOutput.substring(0, 30) + (t.actualOutput.length > 30 ? '...' : ''),
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Status', 'Input', 'Expected', 'Actual']],
            body: testData,
            theme: 'striped',
            headStyles: { fillColor: [66, 139, 202] },
            styles: { fontSize: 8 },
            margin: { left: 20, right: 14 },
          });
          yPosition = (doc as any).lastAutoTable.finalY + 10;
        }

        if (p.hintsUsed !== undefined || p.timeTaken !== undefined) {
          yPosition += 3;
          const metrics: string[] = [];
          if (p.hintsUsed !== undefined) metrics.push(`Hints: ${p.hintsUsed}`);
          if (p.timeTaken !== undefined) metrics.push(`Time: ${p.timeTaken.toFixed(1)}s`);
          doc.text(metrics.join(' | '), 20, yPosition);
          yPosition += 5;
        }

        yPosition += 5;
      });
    }
  }

  // Save the PDF
  const fileName = `Interview_Feedback_${candidateName || 'Candidate'}_${interviewDate || new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

