import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { InterviewLink } from '../../types';
import { API_BASE_URL } from '../../constants/api';

interface DashboardState {
    links: InterviewLink[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
    cacheExpiry: number; // 30 minutes in milliseconds
}

const initialState: DashboardState = {
    links: [],
    loading: false,
    error: null,
    lastFetched: null,
    cacheExpiry: 30 * 60 * 1000, // 30 minutes
};

// Async thunk to fetch dashboard data with caching
export const fetchDashboardData = createAsyncThunk(
    'dashboard/fetchData',
    async (arg: { token: string; force?: boolean }, { getState, rejectWithValue }) => {
        const { token, force = false } = arg;
        const state = getState() as any;
        const { links, lastFetched, cacheExpiry } = state.dashboard;

        // Cache check
        const now = Date.now();
        const isCacheValid = lastFetched && (now - lastFetched < cacheExpiry);

        if (!force && isCacheValid && links.length > 0) {
            console.log('📦 [Dashboard] Using cached dashboard data');
            return { links, cached: true };
        }

        try {
            console.log('⬇️ [Dashboard] Fetching new data from API...');
            const response = await axios.get(`${API_BASE_URL}/interviewer/links`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data.success) {
                return { links: response.data.links, cached: false };
            } else {
                return rejectWithValue(response.data.message || 'Failed to fetch links');
            }
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch links');
        }
    }
);

const dashboardSlice = createSlice({
    name: 'dashboard',
    initialState,
    reducers: {
        clearDashboardData: (state) => {
            state.links = [];
            state.lastFetched = null;
            state.error = null;
        },
        updateLink: (state, action: PayloadAction<InterviewLink>) => {
            const index = state.links.findIndex(link => link.id === action.payload.id);
            if (index !== -1) {
                state.links[index] = action.payload;
            }
        },
        removeLink: (state, action: PayloadAction<number>) => {
            state.links = state.links.filter(link => link.id !== action.payload);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardData.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDashboardData.fulfilled, (state, action) => {
                state.loading = false;
                state.links = action.payload.links;
                if (!action.payload.cached) {
                    state.lastFetched = Date.now();
                }
            })
            .addCase(fetchDashboardData.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearDashboardData, updateLink, removeLink } = dashboardSlice.actions;
export default dashboardSlice.reducer;
