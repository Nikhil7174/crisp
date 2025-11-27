export interface ManualTheoreticalQuestion {
  id: string;
  question: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedAnswer: string;
  explanation?: string;
  keyPoints?: string[];
  timeLimit?: number;
  type?: 'theoretical';
}

interface ParseResult {
  questions: ManualTheoreticalQuestion[];
  errors: string[];
}

const REQUIRED_HEADERS = ['question', 'topic', 'difficulty', 'expectedanswer'];

const normalizeHeader = (header: string) =>
  header
    .trim()
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');

const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1; // skip escaped quote
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
};

export const parseTheoreticalQuestionCsv = (content: string): ParseResult => {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return { questions: [], errors: ['CSV file is empty'] };
  }

  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine).map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter(required => !headers.includes(required));

  if (missingHeaders.length > 0) {
    return {
      questions: [],
      errors: [
        `Missing required columns: ${missingHeaders.join(', ')}`,
        'Required columns: question, topic, difficulty, expectedAnswer',
      ],
    };
  }

  const questions: ManualTheoreticalQuestion[] = [];
  const errors: string[] = [];

  for (let idx = 1; idx < lines.length; idx += 1) {
    const row = splitCsvLine(lines[idx]);
    if (row.length === 0 || row.every(col => col.trim().length === 0)) {
      continue;
    }

    if (row.length !== headers.length) {
      errors.push(`Row ${idx + 1}: Column count mismatch`);
      continue;
    }

    const rowData: Record<string, string> = {};
    headers.forEach((header, headerIdx) => {
      rowData[header] = row[headerIdx]?.trim() ?? '';
    });

    const question = rowData['question'];
    const topic = rowData['topic'];
    const difficulty = (rowData['difficulty'] || 'medium').toLowerCase() as ManualTheoreticalQuestion['difficulty'];
    const expectedAnswer = rowData['expectedanswer'];

    if (!question || !topic || !expectedAnswer) {
      errors.push(`Row ${idx + 1}: Missing required values (question/topic/expectedAnswer)`);
      continue;
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      errors.push(`Row ${idx + 1}: Difficulty must be easy, medium, or hard`);
      continue;
    }

    const keyPointsRaw = rowData['keypoints'] || '';
    const keyPoints = keyPointsRaw
      ? keyPointsRaw.split(/[,;|]/).map(point => point.trim()).filter(point => point.length > 0)
      : [];

    questions.push({
      id: `manual-theory-${Date.now()}-${idx}`,
      question,
      topic,
      difficulty,
      expectedAnswer,
      explanation: rowData['explanation'],
      keyPoints,
      timeLimit: 60,
      type: 'theoretical',
    });
  }

  if (questions.length === 0 && errors.length === 0) {
    errors.push('No valid rows found in CSV file');
  }

  return { questions, errors };
};

