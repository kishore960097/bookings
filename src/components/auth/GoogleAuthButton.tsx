import React from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../lib/firebase';

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface GoogleAuthButtonProps {
  role: 'consumer' | 'owner';
  loading: boolean;
  onSuccess: (tokenResponse: any) => void;
  onError: (error: { message: string }) => void;
}

/**
 * Maps Google Sign-In numeric error codes to actionable human-readable messages.
 * These codes come from the Google Play Services GoogleSignInStatusCodes class.
 */
function mapGoogleSignInErrorCode(code: string | number, message: string): string {
  const c = String(code);
  // Error 16: SIGN_IN_FAILED — most common cause is missing Android OAuth client in google-services.json
  // or SHA-1 fingerprint not registered in Firebase Console.
  if (c === '16') {
    return (
      'Google Sign-In could not be completed (error 16: SIGN_IN_FAILED). ' +
      'This usually means the Android OAuth client ID is missing from google-services.json, ' +
      'or your app\'s SHA-1 fingerprint has not been registered in Firebase Console. ' +
      'Go to Firebase Console → Project Settings → Your Android app → Add SHA-1 fingerprint, ' +
      'then download the updated google-services.json.'
    );
  }
  if (c === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'your mobile IP';
    return `This domain or IP (${host}) is not in your Firebase Authorized Domains. To enable Google Sign-In on this mobile device: open Firebase Console → Authentication → Settings → Authorized domains → Add '${host}'. You can also continue using the Mobile Number option below.`;
  }
  if (c === '10') return 'Google Sign-In failed: developer error. Verify SHA-1 fingerprint and OAuth client in Firebase Console.';
  if (c === '12501') return 'Google Sign-In was cancelled.';
  if (c === '12500') return 'Google Sign-In failed. Please try again.';
  if (c === '7') return 'Google Sign-In failed: network error. Check your internet connection.';
  if (message) return message;
  return `Google Sign-In failed (code ${code}).`;
}

const RealGoogleButton: React.FC<GoogleAuthButtonProps> = ({ role, loading, onSuccess, onError }) => {
  const beginGoogleSignIn = async () => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative && !isFirebaseConfigured) {
      onError({ message: 'Google sign-in is unavailable because Firebase is not configured.' });
      return;
    }

    try {
      if (isNative) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

        let result: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>> | null = null;
        try {
          // Credential Manager returns a Firebase ID token directly.  The legacy
          // GoogleSignInClient path also tries to obtain a Google API access token,
          // which can fail with the opaque Google Play services "Account reauth"
          // status even after account selection.  QGo only needs Firebase's ID
          // token, so avoid that unnecessary request on current Android devices.
          result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true });
        } catch (firstErr: unknown) {
          console.warn('[QGo Auth] Credential Manager Google Sign-In failed; trying legacy intent:', firstErr);
          try {
            // Retain a compatibility fallback for devices without Credential Manager.
            result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
          } catch (nativeErr: unknown) {
            const errObj = nativeErr as any;
            const rawCode = errObj?.code ?? errObj?.errorCode ?? errObj?.error?.code ?? '';
            const rawMsg  = errObj?.message ?? errObj?.error?.message ?? String(nativeErr);
            console.error('[QGo Auth] Native Google Sign-In raw error:', {
              code: rawCode,
              message: rawMsg,
              full: nativeErr,
            });
            const humanMsg = mapGoogleSignInErrorCode(rawCode, rawMsg);
            onError({ message: humanMsg });
            return;
          }
        }

        const idToken = result.credential?.idToken;
        if (idToken) {
          onSuccess({ credential: idToken });
          return;
        }

        // Fallback: retrieve the current user's ID token after sign-in
        try {
          const tokenRes = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
          if (tokenRes?.token) {
            onSuccess({ credential: tokenRes.token });
            return;
          }
        } catch (tokenErr) {
          console.warn('[QGo Auth] getIdToken fallback failed:', tokenErr);
        }

        throw new Error('No ID token returned from Google Sign-In. Please try again.');
      }

      // Web: use popup flow with mobile redirect fallback
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const isMobileDevice =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        onSuccess({ credential: idToken });
        return;
      } catch (popupErr: any) {
        if (
          isMobileDevice ||
          popupErr?.code === 'auth/popup-blocked' ||
          popupErr?.code === 'auth/cancelled-popup-request' ||
          popupErr?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          console.log('[QGo Auth] Mobile popup blocked, falling back to redirect flow');
          localStorage.setItem('qgo_pending_role', role);
          const { signInWithRedirect } = await import('firebase/auth');
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (error: unknown) {
      const errObj = error as any;
      const code = errObj?.code ?? '';
      const message = errObj?.message ?? '';
      console.warn('[QGo Auth] Google sign-in error:', code, message, error);

      if (
        code === 'auth/popup-closed-by-user' ||
        code === '12501' ||
        message.toLowerCase().includes('cancel')
      ) {
        onError({ message: 'Google sign-in was cancelled.' });
      } else if (
        Capacitor.isNativePlatform() &&
        (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/popup-blocked')
      ) {
        onError({
          message:
            'Google Sign-In on Android requires adding google-services.json and your SHA-1 fingerprint in the Firebase Console.',
        });
      } else {
        onError({
          message: mapGoogleSignInErrorCode(code, message && !message.includes('[object') ? message : ''),
        });
      }
    }
  };

  return (
    <button
      type="button"
      id="google-signin-btn"
      onClick={() => {
        if (!loading) void beginGoogleSignIn();
      }}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 font-bold text-sm transition-colors duration-150 rounded-xl hover:bg-[#E8E8EA] cursor-pointer"
      style={{
        height: 52,
        background: '#F0F0F2',
        color: loading ? 'rgba(10,10,10,0.40)' : '#0A0A0A',
        border: '1px solid rgba(10,10,10,0.08)',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-[rgba(11,11,11,0.12)] border-t-[#0B0B0B] rounded-full animate-spin" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleIcon size={20} />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
};

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = (props) => {
  const clientId: string = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
  const hasValidClientId = Boolean(clientId && clientId.includes('.apps.googleusercontent.com'));

  if (!Capacitor.isNativePlatform() && !hasValidClientId && !isFirebaseConfigured) {
    return (
      <button
        type="button"
        id="google-signin-btn-disabled"
        onClick={() => {
          if (!props.loading) {
            props.onError({
              message: 'Google Sign-In is not configured. Please add your Client ID to the .env file.',
            });
          }
        }}
        disabled={props.loading}
        className="w-full flex items-center justify-center gap-3 font-bold text-sm transition-colors duration-150 rounded-xl hover:bg-[#E8E8EA] cursor-pointer"
        style={{
          height: 52,
          background: '#F0F0F2',
          color: props.loading ? 'rgba(10,10,10,0.40)' : '#0A0A0A',
          border: '1px solid rgba(10,10,10,0.08)',
        }}
      >
        <GoogleIcon size={20} />
        <span>Continue with Google</span>
      </button>
    );
  }

  return <RealGoogleButton {...props} />;
};
