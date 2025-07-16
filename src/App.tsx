import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthHeader } from '@/components/auth';
import HomePage from '@/pages/HomePage';
import PlansPage from '@/pages/PlansPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plans" element={<PlansPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
