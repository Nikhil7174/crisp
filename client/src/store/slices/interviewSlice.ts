// src/store/slices/interviewSlice.ts
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ResumeData, DetailedResumeData, InterviewSession, ChatMessage } from '../../types';

interface InterviewState {
  // Resume Data
  resumeData: ResumeData | null;
  detailedResumeData: DetailedResumeData | null;
  resumeUploadTimestamp: number | null;
  
  // Interview Session
  currentSession: InterviewSession | null;
  sessionHistory: InterviewSession[];
  
  // Chat Messages
  chatMessages: ChatMessage[];
  
  // Loading States
  isLoading: boolean;
  isUploading: boolean;
  isStartingInterview: boolean;
  isSubmittingAnswer: boolean;
  
  // Error States
  error: string | null;
  
  // Cache Management
  lastDataFetch: number | null;
  cacheExpiry: number; // 30 minutes in milliseconds
}

const initialState: InterviewState = {
  resumeData: null,
  detailedResumeData: null,
  resumeUploadTimestamp: null,
  currentSession: null,
  sessionHistory: [],
  chatMessages: [],
  isLoading: false,
  isUploading: false,
  isStartingInterview: false,
  isSubmittingAnswer: false,
  error: null,
  lastDataFetch: null,
  cacheExpiry: 30 * 60 * 1000, // 30 minutes
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    // Resume Upload Actions
    setResumeData: (state, action: PayloadAction<ResumeData>) => {
      state.resumeData = action.payload;
      state.resumeUploadTimestamp = Date.now();
      state.error = null;
    },
    
    setDetailedResumeData: (state, action: PayloadAction<DetailedResumeData>) => {
      state.detailedResumeData = action.payload;
      state.lastDataFetch = Date.now();
    },
    
    // Loading States
    setUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setStartingInterview: (state, action: PayloadAction<boolean>) => {
      state.isStartingInterview = action.payload;
    },
    
    setSubmittingAnswer: (state, action: PayloadAction<boolean>) => {
      state.isSubmittingAnswer = action.payload;
    },
    
    // Interview Session Actions
    setCurrentSession: (state, action: PayloadAction<InterviewSession>) => {
      state.currentSession = action.payload;
      state.sessionHistory.push(action.payload);
    },
    
    updateSession: (state, action: PayloadAction<Partial<InterviewSession>>) => {
      if (state.currentSession) {
        state.currentSession = { ...state.currentSession, ...action.payload };
      }
    },
    
    // Chat Messages
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chatMessages.push(action.payload);
    },
    
    setChatMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.chatMessages = action.payload;
    },
    
    // Error Handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    // Cache Management
    clearCache: (state) => {
      state.resumeData = null;
      state.detailedResumeData = null;
      state.resumeUploadTimestamp = null;
      state.lastDataFetch = null;
    },
    
    // Reset Actions
    resetInterview: () => initialState,
    
    resetSession: (state) => {
      state.currentSession = null;
      state.chatMessages = [];
      state.error = null;
    },
  },
});

export const {
  setResumeData,
  setDetailedResumeData,
  setUploading,
  setLoading,
  setStartingInterview,
  setSubmittingAnswer,
  setCurrentSession,
  updateSession,
  addChatMessage,
  setChatMessages,
  setError,
  clearCache,
  resetInterview,
  resetSession,
} = interviewSlice.actions;

export default interviewSlice.reducer;
