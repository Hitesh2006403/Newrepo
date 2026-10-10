import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = api.getCurrentUser();
    setCurrentUser(user);
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setCurrentUser(res.user);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    setCurrentUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('sap_current_user_v1');
    // Switch to first donor or null
    const allUsers = api.getAllUsers();
    setCurrentUser(allUsers[0]);
  };

  // Switch role seamlessly (ideal for hackathon presentation and testing all 4 roles)
  const switchRole = (targetRole) => {
    const allUsers = api.getAllUsers();
    const match = allUsers.find((u) => u.role === targetRole);
    if (match) {
      const switched = api.switchUser(match.id);
      setCurrentUser(switched);
      return switched;
    }
  };

  const allUsers = api.getAllUsers();

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'donor',
        loading,
        login,
        register,
        logout,
        switchRole,
        allUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
