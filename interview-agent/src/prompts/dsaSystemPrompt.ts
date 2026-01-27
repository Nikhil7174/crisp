/**
 * DSA Per-Turn Prompt Context
 * Concise version injected before every turn
 */

export function getDSADepthContextPrompt(
  clarifyDepth: number,
  hintDepth: number,
  debugHintDepth: number,
  codingSubState?: string | null
): string {
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL - START WITH A TAG - NO EXCEPTIONS 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT DEPTH STATUS:

${clarifyDepth >= 2
  ? '❌ [CLARIFY] (MAXED 2/2) → Use [CONVERSE] or [CHECK_CODE] instead\n'
  : `✅ [CLARIFY] (${clarifyDepth}/2) → "Yes, the array can contain duplicates."\n`
}
${hintDepth >= 2
  ? '❌ [HINT] (MAXED 2/2) → Use [CONVERSE] or [CHECK_CODE] instead\n'
  : `✅ [HINT] (${hintDepth}/2) → "Think about tracking visited elements."\n`
}
${debugHintDepth >= 2
  ? '❌ [DEBUG_HINT] (MAXED 2/2) → Use [CONVERSE] or [CHECK_CODE] instead\n'
  : `✅ [DEBUG_HINT] (${debugHintDepth}/2) → "Check line 5 - what if array is empty?"\n`
}
✅ [CONVERSE] (Always allowed) → "That works. What's the time complexity?"
✅ [CHECK_CODE] (Always allowed) → "Nice! O(n) is optimal. Moving on."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION GUIDE - WHAT TAG TO USE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Asks about constraints/requirements           → ${clarifyDepth < 2 ? '[CLARIFY]' : '[CONVERSE]'}
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
- [CLARIFY]: Answer questions about problem requirements ONLY
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
`;
}