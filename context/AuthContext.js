import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import {
  validateEmail,
  validatePasswordNotEmpty,
  validatePasswordStrength,
  validatePasswordsMatch,
  mapAuthError,
} from '../utils/validators';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  // ─── Session initialization ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            fetchProfile(currentSession.user.id);
          }
        }
      } catch (_err) {
        // Silent fail — session will initialize from auth state listener
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (newSession?.user) {
          fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── Profile fetching ─────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found — expected for new users
        return;
      }
      setProfile(data || null);
    } catch (_err) {
      // Silent fail — profile fetch is non-critical
    }
  }, []);

  // ─── Guard against double submissions ─────────────────────────────
  const withSubmitGuard = useCallback(async (fn) => {
    if (isSubmittingRef.current) {
      return { error: 'Please wait, processing your request...' };
    }
    isSubmittingRef.current = true;
    setAuthLoading(true);
    try {
      return await fn();
    } finally {
      isSubmittingRef.current = false;
      setAuthLoading(false);
    }
  }, []);

  // ─── LOGIN ────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    return withSubmitGuard(async () => {
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) return { error: emailCheck.error };

      const pwCheck = validatePasswordNotEmpty(password);
      if (!pwCheck.valid) return { error: pwCheck.error };

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return { error: mapAuthError(error) };
      return { data, error: null };
    });
  }, [withSubmitGuard]);

  // ─── SIGNUP ───────────────────────────────────────────────────────
  const signup = useCallback(async (email, password, confirmPassword) => {
    return withSubmitGuard(async () => {
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) return { error: emailCheck.error };

      const strengthCheck = validatePasswordStrength(password);
      if (!strengthCheck.valid) return { error: strengthCheck.error };

      const matchCheck = validatePasswordsMatch(password, confirmPassword);
      if (!matchCheck.valid) return { error: matchCheck.error };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: 'heatguard://auth',
        },
      });

      if (error) return { error: mapAuthError(error) };

      // Insert row into profiles table
      if (data?.user) {
        const username = email.trim().split('@')[0];
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          username,
          avatar_url: null,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (profileError) {
          // Non-critical — profile can be created later
        }
      }

      return { data, error: null };
    });
  }, [withSubmitGuard]);

  // ─── LOGOUT ───────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    return withSubmitGuard(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: mapAuthError(error) };
      setProfile(null);
      return { error: null };
    });
  }, [withSubmitGuard]);

  // ─── RESET PASSWORD ───────────────────────────────────────────────
  const resetPassword = useCallback(async (email) => {
    return withSubmitGuard(async () => {
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) return { error: emailCheck.error };

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'heatguard://auth',
      });

      if (error) return { error: mapAuthError(error) };
      return { error: null };
    });
  }, [withSubmitGuard]);

  // ─── UPDATE PROFILE ───────────────────────────────────────────────
  const updateProfile = useCallback(async (data) => {
    if (!user) return { error: 'You must be logged in to update your profile' };

    return withSubmitGuard(async () => {
      const updates = {
        ...data,
        id: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' })
        .select()
        .single();

      if (error) return { error: mapAuthError(error) };
      setProfile(updatedProfile);
      return { data: updatedProfile, error: null };
    });
  }, [user, withSubmitGuard]);

  // ─── DELETE ACCOUNT ───────────────────────────────────────────────
  const deleteAccount = useCallback(async () => {
    if (!user) return { error: 'You must be logged in to delete your account' };

    return withSubmitGuard(async () => {
      // 1. Delete profile row
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        return { error: 'Failed to delete profile data. Please try again.' };
      }

      // 2. Sign out (actual user deletion requires server-side admin call 
      //    or an RPC function — we sign out to clear client state)
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) return { error: mapAuthError(signOutError) };

      setProfile(null);
      return { error: null };
    });
  }, [user, withSubmitGuard]);

  // ─── RESEND VERIFICATION ──────────────────────────────────────────
  const resendVerification = useCallback(async () => {
    if (!user?.email) return { error: 'No email address found' };

    return withSubmitGuard(async () => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) return { error: mapAuthError(error) };
      return { error: null };
    });
  }, [user, withSubmitGuard]);

  // ─── REFRESH PROFILE ─────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ─── CONTEXT VALUE ────────────────────────────────────────────────
  const value = {
    // State
    session,
    user,
    profile,
    loading,
    authLoading,
    isVerified: !!user?.email_confirmed_at,

    // Actions
    login,
    signup,
    logout,
    resetPassword,
    updateProfile,
    deleteAccount,
    resendVerification,
    refreshProfile,
    uploadAvatar,
  };

  // ─── UPLOAD AVATAR ─────────────────────────────────────────────
  async function uploadAvatar(uri) {
    if (!user) return { error: 'Not authenticated' };

    try {
      setAuthLoading(true);

      let fileBody;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileBody = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        fileBody = decode(base64);
      }

      const fileExt = uri.split('.').pop().toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileBody, {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with the new public URL
      return await updateProfile({ avatar_url: publicUrl });

    } catch (error) {
      console.error('Error uploading avatar:', error);
      return { error: error.message || 'Failed to upload image' };
    } finally {
      setAuthLoading(false);
    }
  }

  if (loading) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
