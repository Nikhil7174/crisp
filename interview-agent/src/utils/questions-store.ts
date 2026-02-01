/**
 * Questions Store Utility
 * 
 * In-memory store for questions and coding problems for each interview.
 * This provides a fallback mechanism when the API is unavailable.
 */

/**
 * Store questions and coding problems for each interview
 * Keyed by interviewId (room name)
 * This allows the agent to access questions without needing them in the API response
 */
const interviewQuestionsStore = new Map<string, {
  questions: any[];
  codingProblems: any[];
}>();

/**
 * Set questions for an interview (called by controller when spawning worker)
 */
export function setInterviewQuestions(interviewId: string, questions: any[], codingProblems: any[]): void {
  interviewQuestionsStore.set(interviewId, { questions, codingProblems });
  console.log(`📚 [QuestionsStore] Stored ${questions.length} questions and ${codingProblems.length} coding problems for ${interviewId}`);
}

/**
 * Get questions for an interview
 */
export function getInterviewQuestions(interviewId: string): { questions: any[]; codingProblems: any[] } | undefined {
  return interviewQuestionsStore.get(interviewId);
}

