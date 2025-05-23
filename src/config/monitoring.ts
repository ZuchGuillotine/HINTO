import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Amplitude from 'amplitude-react-native';

// Initialize Sentry
export const initSentry = () => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      // Enable performance monitoring
      tracesSampleRate: 1.0,
      // Enable session replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
};

// Initialize Amplitude
export const initAmplitude = () => {
  Amplitude.getInstance().init(process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY);
  
  // Set default user properties
  Amplitude.getInstance().setUserProperties({
    app_version: process.env.EXPO_PUBLIC_APP_VERSION,
    platform: Platform.OS,
  });
};

// Helper to log errors to both services
export const logError = (error: Error, context?: Record<string, any>) => {
  // Log to Sentry with context
  Sentry.captureException(error, {
    extra: context,
  });

  // Log to Amplitude
  Amplitude.getInstance().logEvent('error', {
    error_message: error.message,
    error_name: error.name,
    ...context,
  });
};

// Helper to log events to Amplitude
export const logEvent = (eventName: string, properties?: Record<string, any>) => {
  Amplitude.getInstance().logEvent(eventName, properties);
}; 