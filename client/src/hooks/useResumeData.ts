import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './useAuth';
import { API_BASE_URL } from '../constants/api';

export const useResumeData = () => {
  const { token, isAuthenticated } = useAuth();
  const [resumeData, setResumeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResumeData = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setResumeData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/auth/resume`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setResumeData(response.data.resumeData);
      } else {
        setResumeData(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch resume data:', error);
      setError(error.response?.data?.message || 'Failed to fetch resume data');
      setResumeData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const updateResumeData = useCallback(async (newResumeData: any) => {
    if (!isAuthenticated || !token) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/auth/resume`, {
        resumeData: newResumeData
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setResumeData(newResumeData);
        return true;
      } else {
        throw new Error('Failed to update resume data');
      }
    } catch (error: any) {
      console.error('Failed to update resume data:', error);
      setError(error.response?.data?.message || 'Failed to update resume data');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchResumeData();
  }, [fetchResumeData]);

  return {
    resumeData,
    loading,
    error,
    fetchResumeData,
    updateResumeData,
    hasResume: !!resumeData
  };
};
