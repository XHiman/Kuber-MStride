import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminApp from './features/admin/AdminApp';
import './global.css';

const root = location.pathname.replace(/\/+$/, '') === '/adminX'
  ? <AdminApp />
  : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
);
