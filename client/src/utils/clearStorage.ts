// Utility to clear Redux persist storage
export const clearReduxStorage = () => {
  // Clear localStorage items related to Redux persist
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('persist:') || key.includes('redux'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('Redux persist storage cleared');
};

// Clear storage on app start if needed
if (typeof window !== 'undefined') {
  // Check if we need to clear storage (e.g., if there's an "interview" key in old state)
  const persistKey = 'persist:root';
  const persistedState = localStorage.getItem(persistKey);
  
  if (persistedState) {
    try {
      const parsed = JSON.parse(persistedState);
      if (parsed && typeof parsed === 'object' && 'interview' in parsed) {
        console.log('Clearing old Redux state with interview key');
        clearReduxStorage();
      }
    } catch (error) {
      // If parsing fails, clear the storage anyway
      clearReduxStorage();
    }
  }
}



