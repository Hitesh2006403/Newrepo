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

  const login = async (email, password, extraData = {}) => {
    const res = await api.login(email, password);
    const updatedUser = {
      ...res.user,
      ...extraData,
    };
    localStorage.setItem('sap_current_user_v1', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    return updatedUser;
  };

  const loginWithGoogle = async (targetRole = 'donor', googleProfile = null) => {
    const profile = googleProfile || {
      name: 'Hitesh Sharma',
      email: 'hiteshav2006@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };

    const allUsers = api.getAllUsers();
    let user = allUsers.find((u) => u.role === targetRole);
    if (user) {
      user = {
        ...user,
        name: profile.name,
        email: profile.email,
        authProvider: 'google',
        googleVerified: true,
        avatar: profile.avatar,
      };
    } else {
      user = {
        id: `user-google-${targetRole}-${Date.now()}`,
        name: profile.name,
        email: profile.email,
        role: targetRole,
        organizationName:
          targetRole === 'donor'
            ? 'Grand Hyatt Food Hub'
            : targetRole === 'recipient'
            ? 'Grace Hope Children Shelter'
            : targetRole === 'delivery'
            ? 'Rapid Thermal Fleet'
            : 'Central Command Operations',
        verified: true,
        authProvider: 'google',
        googleVerified: true,
        avatar: profile.avatar,
      };
    }
    localStorage.setItem('sap_current_user_v1', JSON.stringify(user));
    setCurrentUser(user);
    return user;
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
        loginWithGoogle,
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
