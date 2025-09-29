// src/hooks/api/useResumeUpload.ts
import { useCallback } from 'react';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  setResumeData, 
  setDetailedResumeData, 
  setUploading, 
  setLoading, 
  setError 
} from '../../store/slices/interviewSlice';
import SessionManager from '../../services/SessionManager';
import type { ResumeData, DetailedResumeData } from '../../types';

const API_BASE_URL = 'http://localhost:3001/api';

export const useResumeUpload = () => {
  const dispatch = useAppDispatch();
  const { resumeData, detailedResumeData, uploading, loading, error } = useAppSelector(state => state.interview);

  const uploadResume = useCallback(async (file: File) => {
    try {
      dispatch(setUploading(true));
      dispatch(setError(null));

      console.log('Uploading file:', file.name, file.type, file.size);

      const formData = new FormData();
      formData.append('resume', file);

      console.log('Sending request to:', `${API_BASE_URL}/upload/resume`);

      const response = await axios.post(`${API_BASE_URL}/upload/resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response received:', response.data);

      if (response.data.success) {
        const resumeData: ResumeData = response.data.resumeData;
        const detailedResumeData: DetailedResumeData = response.data.detailedResumeData;
        
        console.log('Parsed resume data:', resumeData);
        console.log('Detailed resume data:', detailedResumeData);
        
        dispatch(setResumeData(resumeData));
        dispatch(setDetailedResumeData(detailedResumeData));
        
        // Save to session
        SessionManager.saveSession({
          resumeData,
          detailedResumeData,
          timestamp: Date.now()
        });
        
        return { resumeData, detailedResumeData };
      } else {
        throw new Error('Upload failed: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload resume';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    } finally {
      dispatch(setUploading(false));
    }
  }, [dispatch]);

  const collectMissingInfo = useCallback(async (info: { name: string; email: string; phone: string }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      console.log('Collecting missing info:', info);

      // Send the data in the format the backend expects
      const response = await axios.post(`${API_BASE_URL}/upload/collect-info`, {
        name: info.name,
        email: info.email,
        phone: info.phone,
        resumeData: resumeData
      });

      console.log('Collect info response:', response.data);

      if (response.data.success) {
        const updatedResumeData: ResumeData = response.data.resumeData;
        const updatedDetailedResumeData: DetailedResumeData = response.data.detailedResumeData;
        
        dispatch(setResumeData(updatedResumeData));
        dispatch(setDetailedResumeData(updatedDetailedResumeData));
        
        // Update session
        SessionManager.saveSession({
          resumeData: updatedResumeData,
          detailedResumeData: updatedDetailedResumeData,
          timestamp: Date.now()
        });
        
        return { resumeData: updatedResumeData, detailedResumeData: updatedDetailedResumeData };
      } else {
        throw new Error('Info collection failed: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Collect info error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to collect missing info';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, resumeData]);

  const isDataFresh = useCallback(() => {
    const session = SessionManager.getLastSession();
    if (!session) return false;
    
    const oneHour = 60 * 60 * 1000;
    return Date.now() - session.timestamp < oneHour;
  }, []);

  const getCachedResumeData = useCallback(() => {
    const session = SessionManager.getLastSession();
    return session?.resumeData || null;
  }, []);

  const getCachedDetailedData = useCallback(() => {
    const session = SessionManager.getLastSession();
    return session?.detailedResumeData || null;
  }, []);

  const clearResumeCache = useCallback(() => {
    SessionManager.clearSession();
  }, []);

  const restoreSession = useCallback(() => {
    const session = SessionManager.getLastSession();
    if (session && SessionManager.isSessionValid(session)) {
      dispatch(setResumeData(session.resumeData));
      dispatch(setDetailedResumeData(session.detailedResumeData));
      return session;
    }
    return null;
  }, [dispatch]);

  return {
    resumeData,
    detailedResumeData,
    uploading,
    loading,
    error,
    uploadResume,
    collectMissingInfo,
    isDataFresh,
    getCachedResumeData,
    getCachedDetailedData,
    clearResumeCache,
    restoreSession
  };
};
