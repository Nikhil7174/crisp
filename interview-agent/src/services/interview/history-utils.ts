import { log } from '@livekit/agents';

export function extractConversationHistory(chatCtx: any) {
    if (!chatCtx || !chatCtx.items) {
        log().warn('extractConversationHistory: chatCtx or items missing');
        return [];
    }

    const allItems = chatCtx.items;
    log().info(`extractConversationHistory: Processing ${allItems.length} items`);

    const messages = allItems.filter((item: any) => {
        // We only want messages with a role
        if (!item.role) return false;

        const content = (item.textContent || item.content || '').trim();

        // Skip completely empty messages
        if (!content) return false;

        // Filter out turn prompts (which use # CONTEXT)
        if (content.includes('# CONTEXT')) {
            return false;
        }

        // Keep everything else
        return true;
    });

    log().info(`extractConversationHistory: Extracted ${messages.length} valid messages`);

    return messages.map((msg: any) => {
        // Determine timestamp
        const ts = msg.createdAt || 0;

        return {
            role: msg.role,
            content: msg.textContent || msg.content || '',
            timestamp: ts,
            interrupted: msg.interrupted,
            metadata: {
                source: 'livekit',
            }
        };
    });
}

export function generateCompleteHistory(
    chatCtx: any,
    nonVerbalEvents: any[], // From state.conversationHistory
    questions: any[],
    problems: any[]
) {
    // 1. Get verbal messages from ChatContext
    const verbalMessages = extractConversationHistory(chatCtx);

    // 2. Format non-verbal events (converting Date to timestamp)
    const nonVerbalMessages = (nonVerbalEvents || []).map(evt => {
        const ts = evt.timestamp instanceof Date ? evt.timestamp.getTime() : (evt.timestamp || 0);
        return {
            role: evt.role,
            content: evt.content,
            timestamp: ts,
            metadata: {
                ...(evt.metadata || {}),
                source: 'state_provider'
            }
        };
    });

    // 3. Combine and sort
    const allMessages = [...verbalMessages, ...nonVerbalMessages];
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // 4. Deduplicate and enrich
    const verbalToSkip = new Set<any>();

    // Pass 1: Identify verbal assistant messages to skip (duplicates of state_provider ones)
    for (const msg of allMessages) {
        if (msg.metadata?.source === 'livekit' && msg.role === 'assistant') {
            const hasSimilarInState = allMessages.some(other =>
                other.metadata?.source === 'state_provider' &&
                other.role === 'assistant' &&
                Math.abs(other.timestamp - msg.timestamp) < 30000 && // 30 second window
                (other.content.includes(msg.content) || msg.content.includes(other.content))
            );
            if (hasSimilarInState) {
                verbalToSkip.add(msg);
            }
        }
    }

    const finalHistory: any[] = [];
    let currentQuestionId: string | null = null;
    let currentProblemId: string | null = null;

    for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];

        if (verbalToSkip.has(msg)) {
            continue;
        }

        // Track current question/problem from state provider markers
        if (msg.metadata?.source === 'state_provider') {
            if (msg.metadata.type === 'question') {
                currentQuestionId = msg.metadata.questionId;
                currentProblemId = null;
            } else if (msg.metadata.type === 'coding_problem' || msg.metadata.type === 'problem') {
                currentProblemId = msg.metadata.problemId;
                currentQuestionId = null;
            }
        }

        // Attach current IDs to verbal messages
        if (msg.metadata?.source === 'livekit') {
            msg.metadata.questionId = currentQuestionId;
            msg.metadata.problemId = currentProblemId;
            msg.metadata.section = currentProblemId ? 'coding' : 'theoretical';
            msg.metadata.type = msg.role === 'user' ? 'answer' : 'response';
        }

        finalHistory.push(msg);
    }

    return finalHistory;
}

function inferSection(msg: any, problems: any[]) {
    const content = (msg.content || '').toLowerCase();

    if (content.includes('coding') || content.includes('complexity') || content.includes('algorithm')) {
        return 'coding';
    }

    return 'theoretical'; // Default
}

function findActiveQuestion(timestamp: number, questions: any[]) {
    return null;
}

function findActiveProblem(timestamp: number, problems: any[]) {
    return null;
}
