/**
 * NamoGPT Frontend Supabase Service
 * 
 * Supports Supabase Auth (GitHub OAuth, Google, Apple, Real-time Email OTP), real-time database sync,
 * and session state management.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (
  import.meta.env?.VITE_SUPABASE_URL ||
  window.__ENV__?.VITE_SUPABASE_URL ||
  ''
).trim();

const SUPABASE_ANON_KEY = (
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  window.__ENV__?.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('[Supabase Web] ⚡ Initialized client connected to:', SUPABASE_URL);
  } catch (err) {
    console.warn('[Supabase Web] Failed to initialize client:', err.message);
  }
} else {
  console.log('[Supabase Web] VITE_SUPABASE_URL not configured. Operating in local / REST server mode.');
}

/**
 * Check if Supabase client is available in frontend
 */
export function isSupabaseClientAvailable() {
  return Boolean(supabase);
}

/**
 * Sign in using GitHub OAuth via Supabase
 */
export async function signInWithGitHub() {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase URL & Anon Key not configured in frontend. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
        scopes: 'read:user user:email'
      }
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase Web] GitHub OAuth Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sign in using Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase URL & Anon Key not configured in frontend.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase Web] Google OAuth Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sign in using Apple OAuth via Supabase
 */
export async function signInWithApple() {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase URL & Anon Key not configured in frontend.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase Web] Apple OAuth Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Real-time Email OTP / Magic Link sign in via Supabase
 */
export async function signInWithOtp(email) {
  if (!supabase) return { success: false, error: 'Supabase client not initialized.' };
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase Web] Email OTP Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verify Real-time Email OTP code via Supabase
 */
export async function verifyOtp({ email, token, type = 'email' }) {
  if (!supabase) return { success: false, error: 'Supabase client not initialized.' };
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: String(token).trim(),
      type
    });
    if (error) throw error;
    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    console.error('[Supabase Web] Verify OTP Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sign out from Supabase Auth
 */
export async function signOutSupabase() {
  if (!supabase) return { success: true };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get current active session
 */
export async function getSupabaseSession() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}

export default {
  supabase,
  isSupabaseClientAvailable,
  signInWithGitHub,
  signInWithGoogle,
  signInWithApple,
  signInWithOtp,
  verifyOtp,
  signOutSupabase,
  getSupabaseSession
};
