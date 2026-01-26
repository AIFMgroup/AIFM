/**
 * Session Timeout Manager
 * 
 * Hanterar automatisk utloggning vid inaktivitet.
 * Visar varning innan sessionen går ut.
 */

export interface SessionTimeoutConfig {
  timeoutMs: number;          // Total session timeout (default: 30 min)
  warningMs: number;          // Time before timeout to show warning (default: 5 min)
  checkIntervalMs: number;    // How often to check (default: 30 sec)
  onWarning?: () => void;     // Called when warning should show
  onTimeout?: () => void;     // Called when session times out
  onActivity?: () => void;    // Called on user activity
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  timeoutMs: 30 * 60 * 1000,      // 30 minutes
  warningMs: 5 * 60 * 1000,       // 5 minute warning
  checkIntervalMs: 30 * 1000,     // Check every 30 seconds
};

const STORAGE_KEY = 'aifm_last_activity';
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
];

class SessionTimeoutManager {
  private config: SessionTimeoutConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private warningShown = false;
  private listeners: Array<() => void> = [];

  constructor(config: Partial<SessionTimeoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring session activity
   */
  start(): void {
    if (typeof window === 'undefined') return;

    // Set initial activity
    this.recordActivity();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      const handler = this.throttle(() => this.recordActivity(), 1000);
      window.addEventListener(event, handler, { passive: true });
      this.listeners.push(() => window.removeEventListener(event, handler));
    });

    // Start check interval
    this.checkInterval = setInterval(() => this.checkTimeout(), this.config.checkIntervalMs);

    // Listen for activity from other tabs
    window.addEventListener('storage', this.handleStorageEvent);
    this.listeners.push(() => window.removeEventListener('storage', this.handleStorageEvent));

    // Check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkTimeout();
      }
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }

  /**
   * Record user activity
   */
  recordActivity(): void {
    if (typeof window === 'undefined') return;
    
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, now.toString());
    this.warningShown = false;
    this.config.onActivity?.();
  }

  /**
   * Get time remaining until timeout
   */
  getTimeRemaining(): number {
    const lastActivity = this.getLastActivity();
    const elapsed = Date.now() - lastActivity;
    return Math.max(0, this.config.timeoutMs - elapsed);
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return this.getTimeRemaining() <= 0;
  }

  /**
   * Check if warning should be shown
   */
  shouldShowWarning(): boolean {
    const remaining = this.getTimeRemaining();
    return remaining > 0 && remaining <= this.config.warningMs;
  }

  /**
   * Extend session (call after user confirms to stay logged in)
   */
  extendSession(): void {
    this.recordActivity();
  }

  private getLastActivity(): number {
    if (typeof window === 'undefined') return Date.now();
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  }

  private checkTimeout = (): void => {
    if (this.isExpired()) {
      this.stop();
      this.config.onTimeout?.();
      return;
    }

    if (this.shouldShowWarning() && !this.warningShown) {
      this.warningShown = true;
      this.config.onWarning?.();
    }
  };

  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      // Activity in another tab - reset warning
      this.warningShown = false;
    }
  };

  private throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
  ): T {
    let lastCall = 0;
    return ((...args: unknown[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    }) as T;
  }
}

// Singleton instance
let instance: SessionTimeoutManager | null = null;

export function getSessionManager(config?: Partial<SessionTimeoutConfig>): SessionTimeoutManager {
  if (!instance) {
    instance = new SessionTimeoutManager(config);
  }
  return instance;
}

export function startSessionTimeout(config?: Partial<SessionTimeoutConfig>): SessionTimeoutManager {
  const manager = getSessionManager(config);
  manager.start();
  return manager;
}

export function stopSessionTimeout(): void {
  instance?.stop();
}

export function extendSession(): void {
  instance?.extendSession();
}

export function getTimeRemaining(): number {
  return instance?.getTimeRemaining() ?? 0;
}

// Format time remaining for display
export function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes} min ${seconds} sek`;
  }
  return `${seconds} sekunder`;
}















