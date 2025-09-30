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

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={theme}>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/interview" element={<InterviewChat />} />
              </Routes>
            </Layout>
          </Router>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
