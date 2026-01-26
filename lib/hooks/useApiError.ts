'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { ApiError, parseApiError } from '@/components/ErrorBoundary';

interface UseApiErrorOptions {
  showToast?: boolean;
  defaultMessage?: string;
}

interface UseApiErrorReturn {
  error: ApiError | null;
  setError: (error: ApiError | null) => void;
  handleError: (response: Response, data?: any) => ApiError;
  clearError: () => void;
  isError: boolean;
}

export function useApiError(options: UseApiErrorOptions = {}): UseApiErrorReturn {
  const { showToast = true, defaultMessage } = options;
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();

  const handleError = useCallback((response: Response, data?: any): ApiError => {
    const apiError = parseApiError(response, data);
    
    setError(apiError);

    if (showToast) {
      toast.error(
        getErrorTitle(apiError.status),
        apiError.message || defaultMessage
      );
    }

    return apiError;
  }, [showToast, defaultMessage, toast]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    setError,
    handleError,
    clearError,
    isError: error !== null,
  };
}

function getErrorTitle(status: number): string {
  if (status >= 500) return 'Serverfel';
  if (status === 401) return 'Ej inloggad';
  if (status === 403) return 'Åtkomst nekad';
  if (status === 404) return 'Hittades inte';
  if (status === 422) return 'Valideringsfel';
  if (status === 429) return 'För många förfrågningar';
  return 'Ett fel uppstod';
}

// ============================================================================
// Async operation wrapper with error handling
// ============================================================================

interface AsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useAsyncOperation() {
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError, isError } = useApiError();
  const toast = useToast();

  const execute = useCallback(async <T>(
    operation: () => Promise<Response>,
    options: AsyncOptions<T> = {}
  ): Promise<T | null> => {
    setLoading(true);
    clearError();

    try {
      const response = await operation();
      
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const apiError = handleError(response, data);
        options.onError?.(apiError);
        return null;
      }

      const data = await response.json();
      
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const apiError: ApiError = {
        status: 0,
        message: err instanceof Error 
          ? err.message 
          : options.errorMessage || 'Ett nätverksfel uppstod',
      };
      
      handleError(new Response(null, { status: 0 }), apiError);
      options.onError?.(apiError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError, toast]);

  return {
    execute,
    loading,
    error,
    isError,
    clearError,
  };
}

// ============================================================================
// Form validation error handling
// ============================================================================

export interface ValidationErrors {
  [field: string]: string | undefined;
}

export function useFormErrors() {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setFieldError = useCallback((field: string, message: string | undefined) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const setFieldTouched = useCallback((field: string, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setAllTouched = useCallback(() => {
    const allTouched: Record<string, boolean> = {};
    Object.keys(errors).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
  }, [errors]);

  const getFieldError = useCallback((field: string): string | undefined => {
    return touched[field] ? errors[field] : undefined;
  }, [errors, touched]);

  const hasErrors = Object.values(errors).some(Boolean);

  return {
    errors,
    touched,
    setFieldError,
    setFieldTouched,
    clearFieldError,
    clearAllErrors,
    setAllTouched,
    getFieldError,
    hasErrors,
    setErrors,
  };
}

// ============================================================================
// Validation helpers
// ============================================================================

export const validators = {
  required: (value: any, message = 'Detta fält är obligatoriskt'): string | undefined => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return undefined;
  },

  email: (value: string, message = 'Ogiltig e-postadress'): string | undefined => {
    if (!value) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? undefined : message;
  },

  phone: (value: string, message = 'Ogiltigt telefonnummer'): string | undefined => {
    if (!value) return undefined;
    const phoneRegex = /^[\d\s\-+()]{6,}$/;
    return phoneRegex.test(value) ? undefined : message;
  },

  minLength: (min: number, message?: string) => (value: string): string | undefined => {
    if (!value) return undefined;
    return value.length >= min ? undefined : (message || `Måste vara minst ${min} tecken`);
  },

  maxLength: (max: number, message?: string) => (value: string): string | undefined => {
    if (!value) return undefined;
    return value.length <= max ? undefined : (message || `Får inte överstiga ${max} tecken`);
  },

  pattern: (regex: RegExp, message: string) => (value: string): string | undefined => {
    if (!value) return undefined;
    return regex.test(value) ? undefined : message;
  },

  number: (value: string, message = 'Måste vara ett tal'): string | undefined => {
    if (!value) return undefined;
    return !isNaN(Number(value)) ? undefined : message;
  },

  positiveNumber: (value: string, message = 'Måste vara ett positivt tal'): string | undefined => {
    if (!value) return undefined;
    const num = Number(value);
    return !isNaN(num) && num > 0 ? undefined : message;
  },

  orgNumber: (value: string, message = 'Ogiltigt organisationsnummer'): string | undefined => {
    if (!value) return undefined;
    // Swedish org number format: XXXXXX-XXXX or XXXXXXXXXX
    const cleanValue = value.replace(/\D/g, '');
    return cleanValue.length === 10 ? undefined : message;
  },

  url: (value: string, message = 'Ogiltig URL'): string | undefined => {
    if (!value) return undefined;
    try {
      new URL(value);
      return undefined;
    } catch {
      return message;
    }
  },
};



