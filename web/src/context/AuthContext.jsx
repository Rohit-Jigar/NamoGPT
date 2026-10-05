import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loginApi,
  registerApi,
  fetchCurrentUser,
  fetchSuperAdminCredentials,
  DEFAULT_SERVER_URL
} from '../services/api';

const AuthContext = createContext();

const TOKEN_STORAGE_KEY = 'namogpt_auth_token_v1';
const USER_STORAGE_KEY = 'namogpt_auth_user_v1';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [superAdminInfo, setSuperAdminInfo] = useState({
    email: 'admin@namogpt.com',
    password: 'Admin@NamoGPT2026!',
    role: 'superadmin',
    name: 'Super Admin'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  // Sync token to localStorage
  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {}
  }, [token]);

  // Sync user to localStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {}
  }, [user]);

  // Load superadmin credentials info & verify session on mount
  useEffect(() => {
    fetchSuperAdminCredentials(serverUrl).then((info) => {
      if (info) setSuperAdminInfo(info);
    });

    if (token) {
      fetchCurrentUser(serverUrl, token)
        .then((verifiedUser) => {
          if (verifiedUser) {
            setUser(verifiedUser);
          } else {
            // Token expired or invalid
            setToken(null);
            setUser(null);
          }
        })
        .catch(() => {
          // If server is temporarily unreachable, preserve offline user state
        });
    }
  }, [serverUrl]);

  async function login({ email, password }) {
    setIsLoading(true);
    try {
      const res = await loginApi(serverUrl, { email, password });
      setToken(res.token);
      setUser(res.user);
      setIsAuthModalOpen(false);
      return res;
    } finally {
      setIsLoading(false);
    }
  }

  async function register({ name, email, password }) {
    setIsLoading(true);
    try {
      const res = await registerApi(serverUrl, { name, email, password });
      setToken(res.token);
      setUser(res.user);
      setIsAuthModalOpen(false);
      return res;
    } finally {
      setIsLoading(false);
    }
  }

  async function demoAdminLogin() {
    return login({
      email: superAdminInfo.email,
      password: superAdminInfo.password
    });
  }

  function logout() {
    setToken(null);
    setUser(null);
    setIsAdminModalOpen(false);
  }

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isSuperAdmin,
        isLoading,
        superAdminInfo,
        serverUrl,
        setServerUrl,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isAdminModalOpen,
        setIsAdminModalOpen,
        login,
        register,
        demoAdminLogin,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
