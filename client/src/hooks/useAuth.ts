import { useCallback } from 'react';
import axios from 'axios';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAppDispatch, useAppSelector } from '../store';
import { setUser, logout as logoutAction } from '../store/slices/authSlice';
import { API_BASE_URL } from '../constants/api';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated, loading, error } = useAppSelector((state) => state.auth);
  const { signOut } = useClerk();
  const { getToken } = useClerkAuth();

  const logout = useCallback(async () => {
    try {
      // Sign out from Clerk
      await signOut();

      // Call logout endpoint with a fresh token if possible (optional, for server-side cleanup)
      const apiToken = await getToken();
      const effectiveToken = apiToken || token;

      if (effectiveToken) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${effectiveToken}`,
            },
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  }, [dispatch, token, signOut, getToken]);

  const getCurrentUser = useCallback(async () => {
    try {
      const freshToken = await getToken();
      if (!freshToken) {
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
        },
      });

      if (response.data.success) {
        dispatch(setUser(response.data.user));
      }
    } catch (error) {
      console.error('Get current user error:', error);
      // If token is invalid, logout
      dispatch(logoutAction());
    }
  }, [dispatch, getToken]);

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    logout,
    getCurrentUser,
    getFreshToken: getToken,
  };
};
