import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminApp from './features/admin/AdminApp';
import './global.css';

const currentPath = location.pathname.replace(/\/+$/, '');
const root = currentPath === '/adminX' || currentPath.endsWith('/adminX')
  ? <AdminApp />
  : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {root}
  </StrictMode>,
);
