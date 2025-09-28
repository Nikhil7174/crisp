// src/hooks/api/useResumeUpload.ts
import { useState, useCallback } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  setResumeData, 
  setDetailedResumeData, 
  setUploading, 
  setLoading, 
  setError,
  clearCache 
} from '../../store/slices/interviewSlice';
import { sessionManager } from '../../services/SessionManager';
import type { ResumeData, DetailedResumeData } from '../../types';

interface ResumeUploadResponse {
  success: boolean;
  data: ResumeData;
  detailedData?: DetailedResumeData;
  missingFields: string[];
  message: string;
  error?: string;
}

interface CollectInfoResponse {
  success: boolean;
  data: DetailedResumeData;
  message: string;
  error?: string;
}

// Axios instance with interceptors
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for loading states
apiClient.interceptors.request.use(
  (config) => {
    // Add loading indicator if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.error || error.message || 'An error occurred';
    message.error(errorMessage);
    return Promise.reject(error);
  }
);

export const useResumeUpload = () => {
  const dispatch = useAppDispatch();
  const { 
    resumeData, 
    detailedResumeData, 
    resumeUploadTimestamp, 
    cacheExpiry,
    isUploading,
    isLoading,
    error 
  } = useAppSelector(state => state.interview);

  const uploadResume = useCallback(async (file: File): Promise<ResumeUploadResponse | null> => {
    dispatch(setUploading(true));
    dispatch(setError(null));
    
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await apiClient.post('/upload/resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const result: ResumeUploadResponse = response.data;

      if (result.success) {
        // Store basic resume data in Redux
        dispatch(setResumeData(result.data));
        
        // Store detailed data if available
        if (result.detailedData) {
          dispatch(setDetailedResumeData(result.detailedData));
        }
        
        // Save to session manager for persistence
        sessionManager.saveSession({
          sessionId: `temp-${Date.now()}`,
          resumeData: result.data,
          detailedResumeData: result.detailedData || {} as DetailedResumeData,
          interviewSession: {} as any, // Will be populated when interview starts
          chatMessages: [],
          createdAt: Date.now()
        });
        
        message.success('Resume uploaded successfully!');
      } else {
        dispatch(setError(result.error || 'Failed to upload resume'));
        message.error(result.error || 'Failed to upload resume');
      }

      return result;
    } catch (error) {
      const errorMessage = 'Failed to upload resume';
      dispatch(setError(errorMessage));
      return null;
    } finally {
      dispatch(setUploading(false));
    }
  }, [dispatch]);

  const collectMissingInfo = useCallback(async (values: any, resumeData: ResumeData): Promise<CollectInfoResponse | null> => {
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const response = await apiClient.post('/upload/collect-info', {
        ...values,
        resumeData: resumeData
      });

      const result: CollectInfoResponse = response.data;

      if (result.success) {
        // Store the complete detailed resume data
        dispatch(setDetailedResumeData(result.data));
        
        // Update session manager
        const currentSession = sessionManager.getLastSession();
        if (currentSession) {
          sessionManager.saveSession({
            ...currentSession,
            detailedResumeData: result.data
          });
        }
        
        message.success('Information collected successfully!');
      } else {
        dispatch(setError(result.error || 'Failed to collect information'));
        message.error(result.error || 'Failed to collect information');
      }

      return result;
    } catch (error) {
      const errorMessage = 'Failed to collect information';
      dispatch(setError(errorMessage));
      return null;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // Check if cached data is still fresh
  const isDataFresh = useCallback((): boolean => {
    if (!resumeUploadTimestamp) return false;
    return (Date.now() - resumeUploadTimestamp) < cacheExpiry;
  }, [resumeUploadTimestamp, cacheExpiry]);

  // Get cached resume data if fresh, otherwise return null
  const getCachedResumeData = useCallback((): ResumeData | null => {
    return isDataFresh() ? resumeData : null;
  }, [isDataFresh, resumeData]);

  // Get cached detailed resume data if fresh, otherwise return null
  const getCachedDetailedData = useCallback((): DetailedResumeData | null => {
    return isDataFresh() ? detailedResumeData : null;
  }, [isDataFresh, detailedResumeData]);

  // Clear cache manually
  const clearResumeCache = useCallback(() => {
    dispatch(clearCache());
    sessionManager.clearSession();
  }, [dispatch]);

  // Restore session from localStorage
  const restoreSession = useCallback(() => {
    const session = sessionManager.getLastSession();
    if (session && sessionManager.isSessionValid(session)) {
      dispatch(setResumeData(session.resumeData));
      dispatch(setDetailedResumeData(session.detailedResumeData));
      return session;
    }
    return null;
  }, [dispatch]);

  return {
    uploadResume,
    collectMissingInfo,
    uploading: isUploading,
    loading: isLoading,
    error,
    resumeData: getCachedResumeData(),
    detailedResumeData: getCachedDetailedData(),
    isDataFresh: isDataFresh(),
    clearResumeCache,
    restoreSession,
  };
};
