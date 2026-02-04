import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useAppDispatch } from '../store';
import { loginSuccess, logout } from '../store/slices/authSlice';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export const AuthInitializer: React.FC = () => {
  const { getToken, isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const syncUser = async () => {
      if (isSignedIn && user) {
        try {
          const token = await getToken();
          if (token) {
            // Set default header for future requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Fetch user from our backend
            const response = await axios.get(`${API_BASE_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
              const userData = response.data.user;
              dispatch(
                loginSuccess({
                  user: userData,
                  token: token,
                })
              );

              // Auto-redirect if on public/auth pages
              const publicPaths = ['/', '/sign-in', '/sign-up', '/login', '/register'];
              const isPublicPage = publicPaths.some(path => location.pathname.startsWith(path) && location.pathname !== '/join');

              if (isPublicPage) {
                const dashboardPath = userData.userType === 'interviewer'
                  ? '/interviewer/dashboard'
                  : '/candidate/dashboard';
                navigate(dashboardPath, { replace: true });
              }
            }
          }
        } catch (error) {
          console.error('Failed to sync user:', error);
          // If 404, it means user exists in Clerk but not in our DB.
          // We might need to handle this via a redirection to onboarding.
        }
      } else if (!isSignedIn && !user) {
        // If Clerk says not signed in, ensure Redux is cleared
        dispatch(logout());
        delete axios.defaults.headers.common['Authorization'];
      }
    };

    syncUser();
  }, [isSignedIn, user, getToken, dispatch, navigate, location.pathname]);

  return null;
};
