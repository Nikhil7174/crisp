import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../constants/api';

export interface Candidate {
    id: number;
    session_id: string;
    candidate_name: string;
    candidate_email: string;
    candidate_phone: string;
    start_time: string;
    end_time: string;
    duration: number;
    score: number;
    total_questions: number;
    correct_answers: number;
    time_spent: number;
    strengths: string[];
    areasForImprovement: string[];
    overall_feedback: string;
    detailed_answers: any[];
    question_analysis: any[];
    created_at: string;
    finalEvaluation?: {
        totalScore: number;
        duration: number;
        llmEvaluation?: {
            overall: {
                score: number;
            };
        } | null;
    } | null;
}

interface LinkInfo {
    title: string;
    description?: string;
}

interface CandidateData {
    candidates: Candidate[];
    linkInfo: LinkInfo | null;
    statistics: {
        totalCandidates: number;
        averageScore: number;
        completedInterviews: number;
    };
    lastFetch: number;
    loading: boolean;
    error: string | null;
}

interface CandidatesState {
    byLinkId: Record<string, CandidateData>;
    cacheExpiry: number; // 5 minutes in milliseconds
}

const initialState: CandidatesState = {
    byLinkId: {},
    cacheExpiry: 5 * 60 * 1000, // 5 minutes
};

// Async thunk to fetch candidates for a specific link
export const fetchCandidates = createAsyncThunk(
    'candidates/fetchCandidates',
    async (arg: { linkId: string; token: string; force?: boolean }, { getState, rejectWithValue }) => {
        const { linkId, token, force = false } = arg;
        const state = getState() as any;
        const linkData = state.candidates.byLinkId[linkId];
        const { cacheExpiry } = state.candidates;

        // Cache check
        const now = Date.now();
        const isCacheValid = linkData?.lastFetch && (now - linkData.lastFetch < cacheExpiry);

        if (!force && isCacheValid && linkData?.candidates?.length > 0) {
            console.log(`📦 [Candidates] Using cached data for link ${linkId}`);
            return { linkId, ...linkData, cached: true };
        }

        try {
            console.log(`⬇️ [Candidates] Fetching data for link ${linkId}...`);
            const response = await fetch(`${API_BASE_URL}/interviewer/links/${linkId}/candidates`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.success) {
                const candidateList = Array.isArray(data.candidates) ? data.candidates : [];

                // Calculate statistics
                const completedInterviews = candidateList.filter((c: Candidate) => c.end_time).length;

                const scores: number[] = [];
                candidateList.forEach((c: Candidate) => {
                    if (!c.end_time) return;

                    let score: number | null = null;
                    if (c.finalEvaluation?.llmEvaluation?.overall?.score !== null &&
                        c.finalEvaluation?.llmEvaluation?.overall?.score !== undefined) {
                        score = c.finalEvaluation.llmEvaluation.overall.score;
                    } else if (c.finalEvaluation?.totalScore !== null &&
                        c.finalEvaluation?.totalScore !== undefined) {
                        score = c.finalEvaluation.totalScore;
                    } else if (c.score !== null && c.score !== undefined) {
                        score = c.score;
                    }

                    if (score !== null && score !== undefined) {
                        scores.push(score);
                    }
                });

                const averageScore = scores.length > 0
                    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
                    : 0;

                return {
                    linkId,
                    candidates: candidateList,
                    linkInfo: data.link,
                    statistics: {
                        totalCandidates: candidateList.length,
                        averageScore,
                        completedInterviews,
                    },
                    cached: false,
                };
            } else {
                return rejectWithValue(data.message || 'Failed to fetch candidates');
            }
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch candidates');
        }
    }
);

const candidatesSlice = createSlice({
    name: 'candidates',
    initialState,
    reducers: {
        clearCandidatesCache: (state) => {
            state.byLinkId = {};
        },
        clearLinkCache: (state, action: PayloadAction<string>) => {
            delete state.byLinkId[action.payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCandidates.pending, (state, action) => {
                const { linkId } = action.meta.arg;
                if (!state.byLinkId[linkId]) {
                    state.byLinkId[linkId] = {
                        candidates: [],
                        linkInfo: null,
                        statistics: {
                            totalCandidates: 0,
                            averageScore: 0,
                            completedInterviews: 0,
                        },
                        lastFetch: 0,
                        loading: true,
                        error: null,
                    };
                } else {
                    state.byLinkId[linkId].loading = true;
                    state.byLinkId[linkId].error = null;
                }
            })
            .addCase(fetchCandidates.fulfilled, (state, action) => {
                const { linkId, candidates, linkInfo, statistics, cached } = action.payload;
                state.byLinkId[linkId] = {
                    candidates,
                    linkInfo,
                    statistics,
                    lastFetch: cached ? state.byLinkId[linkId]?.lastFetch || Date.now() : Date.now(),
                    loading: false,
                    error: null,
                };
            })
            .addCase(fetchCandidates.rejected, (state, action) => {
                const { linkId } = action.meta.arg;
                if (state.byLinkId[linkId]) {
                    state.byLinkId[linkId].loading = false;
                    state.byLinkId[linkId].error = action.payload as string;
                }
            });
    },
});

export const { clearCandidatesCache, clearLinkCache } = candidatesSlice.actions;
export default candidatesSlice.reducer;
