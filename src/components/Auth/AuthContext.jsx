import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const decodeToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    if (!payload.id || !payload.email) return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
};

const getInitialUser = () => {
  const token = localStorage.getItem('token');
  if (token) {
    const decoded = decodeToken(token);
    if (decoded) return decoded;
    localStorage.removeItem('token');
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);

  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = decodeToken(token);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
