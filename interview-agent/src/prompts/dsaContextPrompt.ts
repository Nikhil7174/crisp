/**
 * DSA Per-Turn Prompt Context
 * Concise version injected before every turn.
 *
 * This prompt is responsible for making the interviewer USE the candidate's
 * latest code snapshot (if available) and their prior explanations when
 * responding in the coding round.
 */

export function getDSADepthContextPrompt(
    hintDepth: number,
    debugHintDepth: number,
    codingSubState?: string | null,
    currentCode?: string
): string {

    const codeSection = currentCode && currentCode.trim().length > 0
        ? `
━━━━━━━━ CANDIDATE'S CURRENT CODE SNAPSHOT (READ-ONLY) ━━━━━━━━
You have access to the candidate's latest code from their editor.

For EVERY response during this coding problem (no matter what tag you use),
YOU MUST:
- Carefully read this code.
- Use their previous verbal explanation PLUS this code when deciding what to say.
- Ground your comments, hints, and clarifications in what the code actually does.
- If you are judging correctness, use [CHECK_CODE] when the solution is overall correct,
  or [DEBUG_HINT]/[CONVERSE] when there are logic issues, missing edge cases,
  or inefficiencies to discuss.

Do NOT rewrite or fully fix the code. Talk about problems and edge cases in words.

Candidate code:
\`\`\`
${currentCode}
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
        : `
━━━━━━━━ NO CODE SNAPSHOT AVAILABLE ━━━━━━━━
The candidate has not provided any code yet (or it is empty).
Reason only about their spoken approach.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL - START WITH A TAG - NO EXCEPTIONS 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT DEPTH STATUS:

✅ [CLARIFY] (No limit) → "Yes, the array can contain duplicates."
${hintDepth >= 2
    ? '❌ [HINT] (MAXED 2/2) → Use [CONVERSE] or [CHECK_CODE] instead\n'
    : `✅ [HINT] (${hintDepth}/2) → "Think about tracking visited elements."\n`
}
${debugHintDepth >= 2
    ? '❌ [DEBUG_HINT] (MAXED 2/2) → Use [CONVERSE] or [CHECK_CODE] instead\n'
    : `✅ [DEBUG_HINT] (${debugHintDepth}/2) → "Check line 5 - what if array is empty?"\n`
}
✅ [CONVERSE] (No limit) → "That works. What's the time complexity?"
✅ [CHECK_CODE] (No limit) → "Nice! O(n) is optimal. Moving on."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION GUIDE - WHAT TAG TO USE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Asks about constraints/requirements           → [CLARIFY]
Stuck on approach/algorithm                    → ${hintDepth < 2 ? '[HINT]' : '[CONVERSE]'}
Code has bugs/fails tests                      → ${debugHintDepth < 2 ? '[DEBUG_HINT]' : '[CONVERSE]'}
Discussing approach/validating logic           → [CONVERSE]
Solution complete and correct                  → [CHECK_CODE]
Wants to skip/move on                          → [CHECK_CODE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 NEVER write complete solutions or fix their code
🚨 Tag MUST be at the very start of your response
🚨 [CHECK_CODE] means END - system handles transition

TAG USAGE:
- [CLARIFY]: Answer questions about problem requirements ONLY (unlimited)
  ✅ "Yes, assume input can be empty"
  ❌ "Yes, and you'll need two pointers" (no approach hints!)

- [HINT]: Guide thinking about approach, DON'T name data structures
  ✅ "Consider how to track what you've seen"
  ❌ "Use a hash set to store visited elements" (too specific!)

- [DEBUG_HINT]: Point to problem area, DON'T fix code
  ✅ "Check line 8 - what happens when j reaches the end?"
  ❌ "Change line 5 to: if (j < arr.length)" (fixing their code!)

- [CONVERSE]: Discuss approach, validate logic, analyze complexity naturally

- [CHECK_CODE]: Solution is correct OR user wants to move on
  DON'T ask your own questions - system provides next problem

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${codingSubState ? `CURRENT PHASE: ${codingSubState}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${codeSection}
`;
}