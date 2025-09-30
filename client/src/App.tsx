// src/App.tsx
import React from 'react';
import { ConfigProvider } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store, persistor } from './store';
import { theme } from './styles/theme';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';
import InterviewChat from './pages/InterviewChat';
import { Admin } from './pages/Admin';
import { InterviewDetails } from './pages/InterviewDetails';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={theme}>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="interview" element={<InterviewChat />} />
              </Route>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/interview/:id" element={<InterviewDetails />} />
            </Routes>
          </Router>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
