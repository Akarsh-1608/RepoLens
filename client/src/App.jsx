import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import RepositoryPage from './pages/RepositoryPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#16161f',
            color: '#e2e8f0',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#16161f' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#16161f' },
          },
        }}
      />
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/repositories/:id" element={<RepositoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
