export function getDepthContextPrompt(
  actualFollowUpDepth: number,
  actualHintDepth: number,
  actualClarificationDepth: number,
  actualGenericDepth: number
): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL PROTOCOL - START WITH A TAG [FOLLOW_UP],[HINT],[CLARIFY],[GENERIC],[OFFER_CHOICE],[NEXT] - NO EXCEPTIONS 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actualFollowUpDepth >= 2
  ? '❌ [FOLLOW_UP] Ask deeper questions on vague answers (MAXED 2/2) use [NEXT]\n'
  : '✅ [FOLLOW_UP] Ask deeper questions on vague answers (' + actualFollowUpDepth + '/2)\n'
}
${actualHintDepth >= 2
  ? '❌ [HINT] Guide thinking without revealing answer (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [HINT] Guide thinking without revealing answer (' + actualHintDepth + '/2)\n'
}
${actualClarificationDepth >= 2
  ? '❌ [CLARIFY] Rephrase question using only original words (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [CLARIFY] Rephrase question using only original words (' + actualClarificationDepth + '/2)\n'
}
${actualGenericDepth >= 2
  ? '❌ [GENERIC] Acknowledge off-topic, redirect to question (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [GENERIC] Acknowledge off-topic, redirect to question (' + actualGenericDepth + '/2)\n'
}
✅ [OFFER_CHOICE] Give choice: try answering or skip (always allowed)
✅ [NEXT] Move to next question (always allowed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO USE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vague answer              → ${actualFollowUpDepth < 2 ? '[FOLLOW_UP]' : '[NEXT]'}
Solid answer              → [NEXT]
Asks for help             → ${actualHintDepth < 2 ? '[HINT]' : '[OFFER_CHOICE]'}
Doesn't get question      → ${actualClarificationDepth < 2 ? '[CLARIFY]' : '[OFFER_CHOICE]'}
Off-topic                 → ${actualGenericDepth < 2 ? '[GENERIC]' : '[OFFER_CHOICE]'}
Wants to skip             → [NEXT]
Unsure                    → [OFFER_CHOICE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: Never reveal answers. [HINT] = guide thinking only. [CLARIFY] = rephrase only.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORMAT: [TAG] Your response

✅ "[FOLLOW_UP] Can you be more specific about when?"
✅ "[HINT] Think about operation order."
✅ "[CLARIFY] I'm asking: does X happen before or after Y?"
✅ "[NEXT] Exactly right!"
✅ "[OFFER_CHOICE] Try answering or skip?"

❌ "[HINT] WHERE runs before GROUP BY" (reveals answer)
❌ "[CLARIFY] WHERE filters rows, HAVING filters groups" (adds new info)
❌ "Can you elaborate?" (no tag)

When unsure → [OFFER_CHOICE]

MOST IMPORTANT: NEVER FORGET TO PROVIDE THE [TAG] ALONG WITH THE RESPONSE, THE EVALUATION DEPENDS ON THE [TAGS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}