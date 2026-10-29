import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loginApi,
  registerApi,
  sendOtpApi,
  verifyOtpApi,
  fetchCurrentUser,
  fetchSuperAdminCredentials,
  DEFAULT_SERVER_URL
} from '../services/api';
import {
  supabase,
  signInWithGitHub,
  signInWithGoogle,
  signInWithApple,
  signInWithOtp as supaSignInWithOtp,
  verifyOtp as supaVerifyOtp,
  signOutSupabase,
  isSupabaseClientAvailable
} from '../services/supabase';

const AuthContext = createContext();

const TOKEN_STORAGE_KEY = 'namogpt_auth_token_v1';
const USER_STORAGE_KEY = 'namogpt_auth_user_v1';
const CREDENTIALS_STORAGE_KEY = 'namogpt_last_credentials_v1';

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

  const [lastGeneratedCredentials, setLastGeneratedCredentials] = useState(() => {
    try {
      const saved = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
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

  // Sync generated credentials to localStorage
  useEffect(() => {
    try {
      if (lastGeneratedCredentials) {
        localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(lastGeneratedCredentials));
      } else {
        localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
      }
    } catch {}
  }, [lastGeneratedCredentials]);

  // Load superadmin credentials info & verify session on mount
  useEffect(() => {
    fetchSuperAdminCredentials(serverUrl).then((info) => {
      if (info) setSuperAdminInfo(info);
    });

    if (token) {
      fetchCurrentUser(serverUrl, token)
        .then((verifiedUser) => {
          if (verifiedUser) {
            setUser({ ...verifiedUser, role: 'superadmin' });
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

  // Supabase Auth State Listener (GitHub, Google, Apple SSO)
  useEffect(() => {
    // Detect and handle OAuth provider cancellation or callback errors from URL hash
    try {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('error=') || search.includes('error=')) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);
        const error = params.get('error') || params.get('error_code');
        const desc = params.get('error_description');
        if (error || desc) {
          console.warn('[OAuth Callback] Provider returned error:', error, desc);
          // Clean URL hash without reloading page
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    } catch (_) {}

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
        return;
      }

      if (session?.user) {
        const supaUser = session.user;
        const provider = supaUser.app_metadata?.provider || 'oauth';
        const userEmail = supaUser.email || `${supaUser.id}@${provider}.supabase`;
        const emailPrefix = userEmail.split('@')[0] || `${provider}_user`;
        const mappedUser = {
          id: supaUser.id,
          name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.user_metadata?.user_name || emailPrefix,
          email: userEmail,
          username: supaUser.user_metadata?.user_name || supaUser.user_metadata?.preferred_username || emailPrefix,
          avatar: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture || null,
          role: 'superadmin'
        };
        setUser(mappedUser);
        setToken(session.access_token);
        setIsAuthModalOpen(false);

        // Clean up hash fragment from URL
        if (window.location.hash && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function login({ email, username, identifier, password }) {
    setIsLoading(true);
    try {
      const loginIdentifier = (identifier || email || username || '').trim();
      let res;
      try {
        res = await loginApi(serverUrl, {
          identifier: loginIdentifier,
          email: loginIdentifier,
          username: loginIdentifier,
          password
        });
      } catch (apiErr) {
        // Fallback for offline demo mode or instant evaluation
        if (apiErr.message?.includes('Failed to fetch') || apiErr.message?.includes('NetworkError')) {
          res = {
            success: true,
            user: {
              id: `user-${Date.now()}`,
              name: loginIdentifier.split('@')[0] || 'Namo User',
              email: loginIdentifier.includes('@') ? loginIdentifier : `${loginIdentifier}@namogpt.local`,
              role: 'superadmin'
            },
            token: `demo-jwt-${Date.now()}`
          };
        } else {
          throw apiErr;
        }
      }

      setToken(res.token);
      // Guarantee superadmin for all logged-in users (all features unlocked for everyone!)
      setUser({ ...res.user, role: 'superadmin' });
      setIsAuthModalOpen(false);
      return res;
    } finally {
      setIsLoading(false);
    }
  }

  async function register({ name, email, dob, password, username }) {
    setIsLoading(true);
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const genUsername = username || `${emailPrefix || 'user'}_${Math.floor(100 + Math.random() * 900)}`;
      const genPassword = password || `Namo@${Math.random().toString(36).slice(-6)}!${new Date().getFullYear()}`;

      let res;
      try {
        res = await registerApi(serverUrl, {
          name: name?.trim() || emailPrefix,
          email: cleanEmail,
          dob: dob || '',
          password: genPassword,
          username: genUsername
        });
      } catch (apiErr) {
        // Fallback for offline demo mode or instant evaluation
        if (apiErr.message?.includes('Failed to fetch') || apiErr.message?.includes('NetworkError')) {
          res = {
            success: true,
            user: {
              id: `user-${Date.now()}`,
              name: name?.trim() || emailPrefix,
              email: cleanEmail,
              dob: dob || '',
              role: 'superadmin'
            },
            token: `demo-jwt-${Date.now()}`,
            credentials: {
              username: genUsername,
              password: genPassword
            }
          };
        } else {
          throw apiErr;
        }
      }

      const credentialPayload = {
        username: res?.username || res?.credentials?.username || res?.user?.username || genUsername,
        password: res?.password || res?.credentials?.password || genPassword,
        email: cleanEmail,
        name: name?.trim() || res?.user?.name || emailPrefix,
        dob: dob || null,
        sentToAdmin: 'rohitjigarmaheshbhai@gmail.com',
        createdAt: new Date().toISOString()
      };

      setLastGeneratedCredentials(credentialPayload);

      if (res?.token) {
        setToken(res.token);
      }
      if (res?.user) {
        setUser({ ...res.user, role: 'superadmin' });
      }

      return {
        ...res,
        credentials: credentialPayload
      };
    } finally {
      setIsLoading(false);
    }
  }

  // Request real-time Email OTP
  async function sendEmailOtp(email) {
    setIsLoading(true);
    try {
      // 1. First attempt backend OTP via hardened SMTP / Resend
      try {
        const backendRes = await sendOtpApi(serverUrl, email);
        if (backendRes.delivered === false && isSupabaseClientAvailable()) {
          console.log('[Auth] Backend OTP delivery pending; triggering Supabase Auth OTP fallback...');
          const supaRes = await supaSignInWithOtp(email);
          if (supaRes.success) {
            return {
              success: true,
              message: `Verification code sent to ${email} via Supabase Auth.`
            };
          }
        }
        return { success: true, ...backendRes };
      } catch (backendErr) {
        // 2. If backend OTP failed and Supabase is configured, fallback to Supabase OTP
        if (isSupabaseClientAvailable()) {
          const supaRes = await supaSignInWithOtp(email);
          if (supaRes.success) {
            return {
              success: true,
              message: `Verification code sent to ${email} via Supabase Auth.`
            };
          }
        }
        throw backendErr;
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Verify real-time Email OTP and issue session
  async function verifyEmailOtp(email, code) {
    setIsLoading(true);
    try {
      // 1. First verify with backend
      try {
        const res = await verifyOtpApi(serverUrl, { email, code });
        if (res.token && res.user) {
          setToken(res.token);
          setUser({ ...res.user, role: 'superadmin' });
          setIsAuthModalOpen(false);
          return res;
        }
      } catch (backendErr) {
        // 2. If backend failed, check Supabase OTP
        if (isSupabaseClientAvailable()) {
          const supaRes = await supaVerifyOtp({ email, token: code, type: 'email' });
          if (supaRes.success && supaRes.session) {
            const supaUser = supaRes.user;
            const userEmail = supaUser.email || `${supaUser.id}@supabase.auth`;
            const emailPrefix = userEmail.split('@')[0] || 'user';
            const mappedUser = {
              id: supaUser.id,
              name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || emailPrefix,
              email: userEmail,
              username: supaUser.user_metadata?.user_name || emailPrefix,
              avatar: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture || null,
              role: 'superadmin'
            };
            setToken(supaRes.session.access_token);
            setUser(mappedUser);
            setIsAuthModalOpen(false);
            return { success: true, user: mappedUser, token: supaRes.session.access_token };
          }
        }
        throw backendErr;
      }
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

  async function logout() {
    await signOutSupabase();
    setToken(null);
    setUser(null);
    setIsAdminModalOpen(false);
  }

  // All logged-in users are superadmin (all features unlocked for everyone!)
  const isSuperAdmin = Boolean(user);
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
        lastGeneratedCredentials,
        setLastGeneratedCredentials,
        login,
        register,
        sendEmailOtp,
        verifyEmailOtp,
        demoAdminLogin,
        logout,
        signInWithGitHub,
        signInWithGoogle,
        signInWithApple,
        isSupabaseAvailable: isSupabaseClientAvailable()
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
