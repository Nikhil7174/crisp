// src/App.tsx
import React from 'react';
import { ConfigProvider } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { theme } from './styles/theme';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={theme}>
          <Layout>
            <Home />
          </Layout>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;