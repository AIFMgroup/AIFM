'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Error Fallback Component
// ============================================================================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const [copied, setCopied] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const errorDetails = `
Error: ${error?.message || 'Unknown error'}
${error?.stack || ''}

Component Stack:
${errorInfo?.componentStack || 'Not available'}

URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}
Time: ${new Date().toISOString()}
User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
  `.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Något gick fel
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          Ett oväntat fel uppstod. Försök ladda om sidan eller gå tillbaka till startsidan.
          Om problemet kvarstår, kontakta support.
        </p>

        {/* Error Message (if available) */}
        {error?.message && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-left">
            <p className="text-sm font-medium text-red-800 mb-1">Felmeddelande:</p>
            <p className="text-sm text-red-700 font-mono break-words">{error.message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2d2a26] text-white rounded-xl font-medium hover:bg-[#3d3a36] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Ladda om sidan
          </button>
          <a
            href="/overview"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Gå till startsidan
          </a>
        </div>

        {/* Show Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {showDetails ? 'Dölj teknisk information' : 'Visa teknisk information'}
        </button>

        {/* Technical Details */}
        {showDetails && (
          <div className="mt-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teknisk information
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Kopierat!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Kopiera
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-gray-900 text-gray-100 text-xs rounded-xl overflow-x-auto max-h-48">
              {errorDetails}
            </pre>
          </div>
        )}

        {/* Reset button if handler provided */}
        {onReset && (
          <button
            onClick={onReset}
            className="mt-4 text-sm text-[#c0a280] hover:underline"
          >
            Försök igen utan att ladda om
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// API Error Handler
// ============================================================================

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export function parseApiError(response: Response, data?: any): ApiError {
  const statusMessages: Record<number, string> = {
    400: 'Ogiltig förfrågan. Kontrollera dina uppgifter och försök igen.',
    401: 'Du är inte inloggad. Vänligen logga in igen.',
    403: 'Du har inte behörighet att utföra denna åtgärd.',
    404: 'Resursen kunde inte hittas.',
    408: 'Förfrågan tog för lång tid. Försök igen.',
    409: 'Det finns en konflikt med den aktuella resursen.',
    422: 'Uppgifterna kunde inte bearbetas. Kontrollera formuläret.',
    429: 'För många förfrågningar. Vänta en stund och försök igen.',
    500: 'Ett serverfel uppstod. Vi arbetar på att lösa problemet.',
    502: 'Servern är tillfälligt otillgänglig. Försök igen senare.',
    503: 'Tjänsten är tillfälligt otillgänglig. Försök igen senare.',
    504: 'Servern svarade inte i tid. Försök igen.',
  };

  return {
    status: response.status,
    message: data?.message || statusMessages[response.status] || 'Ett oväntat fel uppstod.',
    code: data?.code,
    details: data?.details,
  };
}

// ============================================================================
// Error Display Components
// ============================================================================

interface ErrorMessageProps {
  error: ApiError | Error | string;
  className?: string;
  showIcon?: boolean;
  onRetry?: () => void;
}

export function ErrorMessage({ error, className = '', showIcon = true, onRetry }: ErrorMessageProps) {
  const message = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : error.message;

  return (
    <div className={`flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl ${className}`}>
      {showIcon && (
        <div className="flex-shrink-0 w-5 h-5 text-red-500 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800">Ett fel uppstod</p>
        <p className="text-sm text-red-700 mt-0.5">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
          >
            Försök igen
          </button>
        )}
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className = '' }: InlineErrorProps) {
  return (
    <p className={`text-sm text-red-600 flex items-center gap-1.5 ${className}`}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  );
}

// ============================================================================
// Form Field Error
// ============================================================================

interface FieldErrorProps {
  error?: string;
  touched?: boolean;
}

export function FieldError({ error, touched }: FieldErrorProps) {
  if (!error || !touched) return null;
  
  return (
    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      {error}
    </p>
  );
}

// ============================================================================
// Empty State with Error
// ============================================================================

interface ErrorEmptyStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorEmptyState({ 
  title = 'Kunde inte ladda data', 
  message = 'Ett fel uppstod när vi försökte hämta informationen.',
  onRetry,
  className = ''
}: ErrorEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="w-16 h-16 mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Network Error Component
// ============================================================================

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 mb-4 bg-amber-100 rounded-2xl flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">Ingen nätverksanslutning</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
        Kontrollera din internetanslutning och försök igen.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      )}
    </div>
  );
}
