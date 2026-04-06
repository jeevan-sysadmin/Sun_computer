import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard"; // You'll need to create this

function App() {
  // Check localStorage on initial render to determine login state and role
  const [authState, setAuthState] = React.useState(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    const loggedInFlag = localStorage.getItem('isLoggedIn');
    const role = localStorage.getItem('userRole');
    
    return {
      isLoggedIn: !!(token && userData && loggedInFlag === 'true'),
      role: role || 'user',
      isLoading: false
    };
  });

  const handleLoginSuccess = (role: string = 'user') => {
    setAuthState({
      isLoggedIn: true,
      role: role,
      isLoading: false
    });
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    
    setAuthState({
      isLoggedIn: false,
      role: 'user',
      isLoading: false
    });
  };

  // Protected route component with role check
  const ProtectedRoute = ({ 
    children, 
    requiredRole = 'user' 
  }: { 
    children: React.ReactNode;
    requiredRole?: 'user' | 'admin' | 'both';
  }) => {
    // Check auth status on every render
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    const loggedInFlag = localStorage.getItem('isLoggedIn');
    const role = localStorage.getItem('userRole');
    
    const isAuthenticated = !!(token && userData && loggedInFlag === 'true');
    const hasAccess = requiredRole === 'both' || role === requiredRole || role === 'admin';

    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }

    if (!hasAccess) {
      // Redirect to appropriate dashboard based on role
      if (role === 'admin') {
        return <Navigate to="/admin-dashboard" />;
      } else {
        return <Navigate to="/dashboard" />;
      }
    }

    return <>{children}</>;
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              authState.isLoggedIn ? 
              (authState.role === 'admin' ? 
                <Navigate to="/admin-dashboard" /> : 
                <Navigate to="/dashboard" />
              ) : 
              <Login onLoginSuccess={handleLoginSuccess} />
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requiredRole="user">
                <Dashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/" 
            element={
              authState.isLoggedIn ? 
              (authState.role === 'admin' ? 
                <Navigate to="/admin-dashboard" /> : 
                <Navigate to="/dashboard" />
              ) : 
              <Navigate to="/login" />
            } 
          />
          
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;