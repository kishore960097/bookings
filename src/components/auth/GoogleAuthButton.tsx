import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';

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

const RealGoogleButton: React.FC<GoogleAuthButtonProps> = ({ loading, onSuccess, onError }) => {
  const loginOAuth = useGoogleLogin({
    onSuccess: (tokenResponse) => onSuccess(tokenResponse),
    onError: () => onError({ message: 'Google sign-in was cancelled or failed.' }),
    flow: 'implicit',
  });

  return (
    <button
      type="button"
      id="google-signin-btn"
      onClick={() => {
        if (!loading) loginOAuth();
      }}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 font-bold text-sm transition-all rounded-xl shadow-lg hover:bg-slate-50 cursor-pointer"
      style={{
        height: 52,
        background: loading ? '#1e293b' : '#ffffff',
        color: loading ? '#94a3b8' : '#0f172a',
        border: '1px solid rgba(255,255,255,0.15)',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-slate-500 border-t-blue-500 rounded-full animate-spin" />
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
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const hasValidClientId = Boolean(clientId && clientId.includes('.apps.googleusercontent.com'));

  if (!hasValidClientId) {
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
        className="w-full flex items-center justify-center gap-3 font-bold text-sm transition-all rounded-xl shadow-lg hover:bg-slate-50 cursor-pointer"
        style={{
          height: 52,
          background: props.loading ? '#1e293b' : '#ffffff',
          color: props.loading ? '#94a3b8' : '#0f172a',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <GoogleIcon size={20} />
        <span>Continue with Google</span>
      </button>
    );
  }

  return <RealGoogleButton {...props} />;
};
