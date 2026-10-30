import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { CustomerProfile } from '@/types/customer';
import { toast } from 'sonner';

export type AuthModalMode = 'choice' | 'signin' | 'register' | 'forgot' | 'complete-profile';

interface AuthContextType {
  user: User | null;
  profile: CustomerProfile | null;
  loading: boolean;
  isGuest: boolean;
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode, onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  continueAsGuest: () => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileData: (data: Partial<CustomerProfile>) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_STORAGE_KEY = 'ashmawy_order_as_guest';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(GUEST_STORAGE_KEY) === 'true';
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('choice');
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

  const openAuthModal = useCallback((mode: AuthModalMode = 'choice', onSuccess?: () => void) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    if (onSuccess) {
      setOnSuccessCallback(() => onSuccess);
    } else {
      setOnSuccessCallback(null);
    }
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setOnSuccessCallback(null);
  }, []);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    try {
      sessionStorage.setItem(GUEST_STORAGE_KEY, 'true');
    } catch {}
    closeAuthModal();
    if (onSuccessCallback) {
      onSuccessCallback();
    }
  }, [closeAuthModal, onSuccessCallback]);

  // Load and sync customer profile from Firestore
  const loadProfile = useCallback(async (firebaseUser: User): Promise<CustomerProfile | null> => {
    if (!db) return null;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const p: CustomerProfile = {
          uid: firebaseUser.uid,
          displayName: data['displayName'] || data['name'] || firebaseUser.displayName || 'عميل عشماوي',
          email: data['email'] || firebaseUser.email || '',
          phone: data['phone'] || '',
          defaultAddress: data['defaultAddress'] || data['address'] || '',
          createdAt: data['createdAt'] || data['created_at'] || new Date().toISOString(),
          updatedAt: data['updatedAt'] || data['updated_at'] || new Date().toISOString(),
        };
        setProfile(p);
        return p;
      }

      // Check legacy user_profiles if needed
      const legacyRef = doc(db, 'user_profiles', firebaseUser.uid);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const data = legacySnap.data();
        const p: CustomerProfile = {
          uid: firebaseUser.uid,
          displayName: data['displayName'] || data['name'] || firebaseUser.displayName || 'عميل عشماوي',
          email: data['email'] || firebaseUser.email || '',
          phone: data['phone'] || '',
          defaultAddress: data['defaultAddress'] || data['address'] || '',
          createdAt: data['createdAt'] || data['created_at'] || new Date().toISOString(),
          updatedAt: data['updatedAt'] || data['updated_at'] || new Date().toISOString(),
        };
        setProfile(p);
        // Copy to users/{uid}
        await setDoc(userRef, p, { merge: true });
        return p;
      }

      // First-time profile creation (e.g. Google Sign-In)
      const newProfile: CustomerProfile = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'عميل عشماوي',
        email: firebaseUser.email || '',
        phone: '',
        defaultAddress: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userRef, newProfile, { merge: true });
      setProfile(newProfile);
      return newProfile;
    } catch (err) {
      if (err?.code !== 'permission-denied') { console.warn('[AuthProvider] Error loading user profile:', err); }
      // Fallback in-memory profile
      const fallback: CustomerProfile = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'عميل عشماوي',
        email: firebaseUser.email || '',
        phone: '',
        defaultAddress: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfile(fallback);
      return fallback;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setIsGuest(false);
        try {
          sessionStorage.removeItem(GUEST_STORAGE_KEY);
        } catch {}
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      console.warn('[AuthProvider] Failed to get ID token:', err);
      return null;
    }
  }, [user]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    if (!auth) throw new Error('خدمة المصادقة غير مهيأة.');
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await loadProfile(cred.user);
    closeAuthModal();
    toast.success('تم تسجيل الدخول بنجاح! مرحباً بك.');
    if (onSuccessCallback) onSuccessCallback();
  }, [closeAuthModal, loadProfile, onSuccessCallback]);

  const registerWithEmail = useCallback(async (name: string, email: string, pass: string) => {
    if (!auth) throw new Error('خدمة المصادقة غير مهيأة.');
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    try {
      await firebaseUpdateProfile(cred.user, { displayName: name.trim() });
    } catch {}

    const newProfile: CustomerProfile = {
      uid: cred.user.uid,
      displayName: name.trim(),
      email: cred.user.email || email.trim(),
      phone: '',
      defaultAddress: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      try {
        await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      } catch (err) {
        console.warn('[AuthProvider] Error creating firestore user doc:', err);
      }
    }
    setProfile(newProfile);

    // Prompt for missing phone and address if creating account
    setAuthModalMode('complete-profile');
    toast.success('تم إنشاء الحساب بنجاح! أهلاً بك في عائلة عشماوي.');
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error('خدمة المصادقة غير مهيأة.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const p = await loadProfile(cred.user);

    // If phone or defaultAddress is missing, suggest completing profile
    if (!p?.phone || !p?.defaultAddress) {
      setAuthModalMode('complete-profile');
    } else {
      closeAuthModal();
      if (onSuccessCallback) onSuccessCallback();
    }
    toast.success('تم تسجيل الدخول بحساب Google بنجاح!');
  }, [closeAuthModal, loadProfile, onSuccessCallback]);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!auth) throw new Error('خدمة المصادقة غير مهيأة.');
    await sendPasswordResetEmail(auth, email.trim());
    toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
  }, []);

  const signOut = useCallback(async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setProfile(null);
    setIsGuest(false);
    try {
      sessionStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {}
    toast.info('تم تسجيل الخروج بنجاح.');
  }, []);

  const updateProfileData = useCallback(async (data: Partial<CustomerProfile>) => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً.');

    const updated: CustomerProfile = {
      uid: user.uid,
      displayName: data.displayName ?? profile?.displayName ?? user.displayName ?? '',
      email: user.email || profile?.email || '',
      phone: data.phone ?? profile?.phone ?? '',
      defaultAddress: data.defaultAddress ?? profile?.defaultAddress ?? '',
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update in Firestore
    if (db) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, updated, { merge: true });
    }

    // Update displayName in auth user if modified
    if (data.displayName && data.displayName !== user.displayName) {
      try {
        await firebaseUpdateProfile(user, { displayName: data.displayName });
      } catch {}
    }

    setProfile(updated);
    toast.success('تم تحديث بياناتك بنجاح.');
  }, [user, profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isGuest,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        continueAsGuest,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        signOut,
        updateProfileData,
        getIdToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

