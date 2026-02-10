import { useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useAppDispatch } from '../store';
import { loginSuccess, logout } from '../store/slices/authSlice';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const AuthInitializer: React.FC = () => {
  const { getToken, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const dispatch = useAppDispatch();
  const [syncAttempts, setSyncAttempts] = useState(0);

  useEffect(() => {
    const syncUserWithBackend = async () => {
      if (!isSignedIn || !clerkUser) {
        // Clear Redux state if not signed in
        dispatch(logout());
        delete axios.defaults.headers.common['Authorization'];
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          console.error('[Auth] No token available');
          return;
        }

        // Set default header for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        console.log('[Auth] Syncing user with backend...');

        // Try to fetch user from backend
        const response = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          const userData = response.data.user;
          console.log('[Auth] ✅ User synced successfully:', userData.email);

          dispatch(
            loginSuccess({
              user: userData,
              token: token,
            })
          );

          // Reset retry counter on success
          setSyncAttempts(0);
        }
      } catch (error: any) {
        console.error('[Auth] Sync error:', error.response?.status, error.message);

        // If user not found (404), it means backend hasn't created the user yet
        if (error.response?.status === 404 && syncAttempts < MAX_RETRIES) {
          console.log(`[Auth] User not found in backend. Retry ${syncAttempts + 1}/${MAX_RETRIES} in ${RETRY_DELAY}ms...`);

          setSyncAttempts(prev => prev + 1);

          // Retry after delay
          setTimeout(() => {
            syncUserWithBackend();
          }, RETRY_DELAY * (syncAttempts + 1)); // Exponential backoff
        } else if (error.response?.status === 404) {
          console.error('[Auth] ❌ Max retries reached. User still not found in backend.');
          console.error('[Auth] This likely means the Clerk webhook failed to create the user.');
          // Don't logout - let the user stay signed in to Clerk
          // The dashboard will show an error state
        } else if (error.response?.status === 401) {
          console.error('[Auth] ❌ Unauthorized. Logging out...');
          dispatch(logout());
        }
      }
    };

    syncUserWithBackend();
  }, [isSignedIn, clerkUser, getToken, dispatch, syncAttempts]);

  return null;
};
