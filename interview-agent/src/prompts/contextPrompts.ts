/**
 * Context Prompt Generator
 * 
 * Unifies the logic for injecting system context prompts based on the interview state.
 * Dispatches to the appropriate specialized prompt generator (theoretical vs DSA).
 */

import { InterviewState, StateProvider } from '../services/interview/state-provider.js';
import { getDepthContextPrompt } from './eachTurnPrompt.js';
import { getDSADepthContextPrompt } from './dsaContextPrompt.js';
import { Orchestrator } from '../services/interview/orchestrator.js';
import { log } from '@livekit/agents';

/**
 * Generates the appropriate context prompt for the current interview state.
 * 
 * @param state - The current interview state
 * @param stateProvider - The state provider instance (to fetch depths)
 * @param orchestrator - The orchestrator instance (to fetch problem details)
 * @param currentCode - The candidate's current code (if any)
 * @param currentNotepad - The candidate's notepad content (if any)
 * @returns The context prompt string to inject
 */
export function getInterviewContextPrompt(
    state: InterviewState,
    stateProvider: StateProvider,
    orchestrator: Orchestrator,
    currentCode?: string,
    currentNotepad?: string
): string | null {
    if (!state) return null;
    const { interviewId } = state;

    // 1. THEORETICAL PHASE
    if (state.currentState === 'theoretical') {
        // Check if we have a current question
        if (!state.currentQuestionId) {
            return null;
        }

        // Force a fresh read of depths (authoritative source)
        // Note: In original code, we read from stateProvider helpers first, then checked state trackers, and took max.
        // Here we replicate that logic to ensure consistency.

        // Helper accessors
        const followUpDepth = stateProvider.getFollowUpDepth(interviewId, state.currentQuestionId);
        const hintDepth = stateProvider.getHintDepth(interviewId, state.currentQuestionId);
        const clarificationDepth = stateProvider.getClarificationDepth(interviewId, state.currentQuestionId);
        const genericDepth = stateProvider.getGenericDepth(interviewId, state.currentQuestionId);

        // Tracker accessors (direct state)
        const followUpTracker = state.followUpTracker?.get(state.currentQuestionId);
        const followUpTrackerDepth = followUpTracker?.followUpDepth || 0;

        const hintTracker = state.hintTracker?.get(state.currentQuestionId);
        const hintTrackerDepth = hintTracker?.hintDepth || 0;

        const clarificationTracker = state.clarificationTracker?.get(state.currentQuestionId);
        const clarificationTrackerDepth = clarificationTracker?.clarificationDepth || 0;

        const genericTracker = state.genericTracker?.get(state.currentQuestionId);
        const genericTrackerDepth = genericTracker?.genericDepth || 0;

        // Use max of either source
        const actualFollowUpDepth = Math.max(followUpDepth, followUpTrackerDepth);
        const actualHintDepth = Math.max(hintDepth, hintTrackerDepth);
        const actualClarificationDepth = Math.max(clarificationDepth, clarificationTrackerDepth);
        const actualGenericDepth = Math.max(genericDepth, genericTrackerDepth);

        // Get the current question text to include in context
        const currentQuestion = orchestrator.getQuestionById(state.currentQuestionId);
        const questionText = currentQuestion ? currentQuestion.question : null;

        return getDepthContextPrompt(
            actualFollowUpDepth,
            actualHintDepth,
            actualClarificationDepth,
            actualGenericDepth,
            questionText
        );
    }

    // 2. CODING / DSA PHASE
    /*
       NOTE: We treat 'coding' as the main phase where we inject DSA context.
       The orchestrator might also use 'coding_intro' or 'coding_problem', but 'coding' 
       is the primary state used in interview-agent.ts logic.
    */
    if (state.currentState === 'coding') {
        const currentProblem = orchestrator.getCurrentProblem();

        // If no problem is active, we might be in transition, so no context needed or fallback
        if (!currentProblem) {
            return null;
        }

        // Map depths for the coding problem
        // Note: reusing hintDepth and clarificationDepth logic for DSA
        // ideally DSA specific trackers should be used if they existed, but currently they map to the same
        const hintDepth = stateProvider.getHintDepth(interviewId, currentProblem.id) || 0;
        // Use clarification depth as "debug hint" depth for DSA context
        const debugHintDepth = stateProvider.getClarificationDepth(interviewId, currentProblem.id) || 0;

        // Debug logging to confirm currentCode is reaching the DSA context
        const codeLength = currentCode ? currentCode.length : 0;
        const codePreview = currentCode
            ? currentCode.substring(0, 80).replace(/\s+/g, ' ')
            : '';
        log().info(
            `🧩 [ContextPrompt] DSA context for problem ${currentProblem.id} ` +
            `– currentCode length: ${codeLength} ` +
            (codeLength > 0 ? `preview: "${codePreview}..."` : '(no code)')
        );

        log().info({ currentNotepad }, " currentNotepad  ");

        // Always include a concise problem summary in the system prompt so the LLM
        // can see the coding question even if earlier turns were pruned.
        const constraintsText = currentProblem.constraints
            ? (Array.isArray(currentProblem.constraints)
                ? currentProblem.constraints.join(', ')
                : String(currentProblem.constraints))
            : 'None';

        const examplesText = currentProblem.examples
            ? (Array.isArray(currentProblem.examples)
                ? currentProblem.examples.map((ex: any) =>
                    typeof ex === 'string'
                        ? ex
                        : JSON.stringify(ex)
                  ).join(' | ')
                : String(currentProblem.examples))
            : 'None';

        const problemSummary = `
# CODING PROBLEM
Title: ${currentProblem.title}
Description: ${currentProblem.description}
Constraints: ${constraintsText}
Examples: ${examplesText}
`;

        const dsaPrompt = getDSADepthContextPrompt(
            hintDepth,
            debugHintDepth,
            state.codingSubState,
            currentCode,
            currentNotepad
        );

        return `${problemSummary}\n${dsaPrompt}`;
    }

    return null;
}
