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

      // Call logout endpoint if token exists (optional, for server-side cleanup)
      if (token) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  }, [dispatch, token, signOut]);

  const getCurrentUser = useCallback(async () => {
    try {
      if (!token) {
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
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
  }, [dispatch, token]);

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
