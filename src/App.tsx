import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthHeader } from '@/components/auth';
import HomePage from '@/pages/HomePage';
import PlansPage from '@/pages/PlansPage';
import AdminPage from '@/pages/AdminPage';
import '@/components/admin/slider-styles.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
