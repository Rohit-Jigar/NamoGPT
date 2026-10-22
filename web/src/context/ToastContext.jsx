import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({
    type = 'info', // 'info' | 'success' | 'warning' | 'error'
    title = '',
    message = '',
    action = null, // { label: string, onClick: () => void }
    duration = 5000, // 0 for persistent
    dismissible = true
  }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast = {
      id,
      type,
      title,
      message,
      action,
      duration,
      dismissible,
      createdAt: Date.now()
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  // Specialized edge-case helpers as requested by production resilience specs
  const showFileUploadError = useCallback((fileName, reason, sizeMb = null) => {
    let message = '';
    if (reason === 'size') {
      message = `"${fileName}" (${sizeMb ? sizeMb.toFixed(1) + 'MB' : '>20MB'}) exceeds the maximum allowed file size of 20MB. Please upload a smaller file or split large datasets.`;
    } else if (reason === 'type') {
      message = `"${fileName}" has an unsupported file format. Supported formats: Images (PNG, JPG, WEBP), Documents (PDF, TXT, MD, CSV, JSON, DOCX).`;
    } else {
      message = `Could not process "${fileName}": ${reason || 'Unknown error'}. Please try again.`;
    }

    return addToast({
      type: 'error',
      title: 'File Upload Rejected',
      message,
      duration: 7000
    });
  }, [addToast]);

  const showTimeoutError = useCallback(({ onRetry } = {}) => {
    return addToast({
      type: 'warning',
      title: 'Gateway Timeout (504)',
      message: 'The upstream model provider took too long to respond. The connection was terminated to prevent hanging.',
      action: onRetry ? {
        label: 'Retry Request',
        onClick: onRetry
      } : null,
      duration: 10000
    });
  }, [addToast]);

  const showCopySuccess = useCallback((customMessage = 'Copied to clipboard!') => {
    return addToast({
      type: 'success',
      title: 'Copied',
      message: customMessage,
      duration: 2500
    });
  }, [addToast]);

  const showMicError = useCallback((errorType) => {
    let title = 'Speech Recognition Error';
    let message = 'An error occurred while accessing voice input.';

    if (errorType === 'not-allowed' || errorType === 'permission-denied') {
      title = 'Microphone Access Denied';
      message = 'Please allow microphone permissions in your browser address bar settings to use voice dictation.';
    } else if (errorType === 'no-speech') {
      title = 'No Speech Detected';
      message = 'No voice was heard. Please check your microphone input level and try speaking again.';
    } else if (errorType === 'network') {
      title = 'Speech Network Error';
      message = 'Speech-to-text service network disconnected. Check your internet connection.';
    } else if (errorType === 'not-supported') {
      title = 'Speech Not Supported';
      message = 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
    }

    return addToast({
      type: 'error',
      title,
      message,
      duration: 6000
    });
  }, [addToast]);

  const success = useCallback((message, title = 'Success') => {
    return addToast({ type: 'success', title, message, duration: 4000 });
  }, [addToast]);

  const error = useCallback((message, title = 'Error', action = null) => {
    return addToast({ type: 'error', title, message, action, duration: 7000 });
  }, [addToast]);

  const warning = useCallback((message, title = 'Warning', action = null) => {
    return addToast({ type: 'warning', title, message, action, duration: 6000 });
  }, [addToast]);

  const info = useCallback((message, title = 'Notice') => {
    return addToast({ type: 'info', title, message, duration: 5000 });
  }, [addToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        showFileUploadError,
        showTimeoutError,
        showCopySuccess,
        showMicError,
        success,
        error,
        warning,
        info
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
