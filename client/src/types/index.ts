// src/types/index.ts
export type UserType = 'interviewee' | 'interviewer';

export interface UserPreferences {
  jobRole?: string;
  experience?: string;
  industry?: string;
  companySize?: string;
  hiringNeeds?: string[];
}

export interface UIState {
  activeUserType: UserType | null;
  isLoading: boolean;
  selectedColumn: 'left' | 'right' | null;
}

export interface UserState {
  userType: UserType | null;
  preferences: UserPreferences;
  onboardingStep: number;
  isFirstTimeUser: boolean;
}

export interface SessionState {
  visitTimestamp: number;
  userJourney: string[];
  selectedFeatures: string[];
}

export interface RootState {
  ui: UIState;
  user: UserState;
  session: SessionState;
}