import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[QGo ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#FFFFFF',
          color: '#171717',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '1px solid rgba(23,23,23,0.1)',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(232,52,42,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#E8342A',
              fontSize: '24px',
              fontWeight: 'bold',
            }}>
              !
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              The application encountered an unexpected issue while rendering.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: '#F7F7F8',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#A81818',
                marginBottom: '20px',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(23,23,23,0.15)',
                  background: '#FFFFFF',
                  color: '#171717',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#E8342A',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
