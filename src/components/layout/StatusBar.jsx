'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle, Eye, Users } from 'lucide-react';
import styles from './StatusBar.module.css';

/**
 * Enterprise Clinical StatusBar
 * Displays persistent clinical verification advisory, system telemetry, and platform status.
 *
 * @param {object} props
 * @param {boolean} props.collapsed - Whether sidebar is collapsed
 */
export default function StatusBar({ collapsed, standalone = false }) {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (status === 'loading') {
      return undefined;
    }
    if (status === 'unauthenticated') {
      setAnalytics(null);
    }

    let cancelled = false;
    const loadAnalytics = async () => {
      try {
        if (status === 'authenticated') {
          // The API requires a valid session and de-duplicates this browser once per day.
          await fetch('/api/analytics/visit', { method: 'POST', cache: 'no-store' });
        }
        const response = await fetch(isAdmin ? '/api/analytics/stats' : '/api/analytics/public', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setAnalytics(data);
      } catch {
        // Analytics should not interfere with the clinical workspace if unavailable.
      }
    };

    loadAnalytics();
    return () => { cancelled = true; };
  }, [status, isAdmin]);

  const togglePublicDisplay = async () => {
    if (!isAdmin || !analytics || savingSetting) return;
    setSavingSetting(true);
    try {
      const response = await fetch('/api/analytics/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicDisplayEnabled: !analytics.publicDisplayEnabled }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setAnalytics((current) => current ? { ...current, publicDisplayEnabled: data.publicDisplayEnabled } : current);
    } catch {
      // Leave the previous setting visible if the request fails.
    } finally {
      setSavingSetting(false);
    }
  };

  const showViewerCount = isAdmin || analytics?.enabled === true;
  const displayedCount = isAdmin ? analytics?.visitorsToday : analytics?.viewersToday;

  if (standalone && !showViewerCount) return null;

  return (
    <footer className={[
      styles.statusbar,
      collapsed && styles.sidebarCollapsed,
      standalone && styles.standalone,
    ].filter(Boolean).join(' ')}>
      {!standalone && (
        <div className={styles.center}>
          <AlertCircle size={12} className={styles.warningIcon} />
          <span className={styles.disclaimerText}>
            AI findings support review and education. Confirm clinical decisions with a qualified dental professional.
          </span>
        </div>
      )}
      {showViewerCount && (
        <div className={styles.analytics}>
          <button
            type="button"
            className={styles.analyticsButton}
            onClick={() => isAdmin && setPopoverOpen((open) => !open)}
            aria-label={isAdmin ? 'Open visitor statistics' : `Today's viewers: ${displayedCount ?? 0}`}
            aria-expanded={isAdmin ? popoverOpen : undefined}
            title={isAdmin ? 'Visitor statistics' : "Today's viewers"}
          >
            <Eye size={14} />
            <span>{displayedCount ?? (isAdmin ? 'Visitors' : '…')}</span>
          </button>
          {isAdmin && popoverOpen && (
            <section className={styles.analyticsPopover} aria-label="Visitor statistics">
              <strong>Site visitors</strong>
              <div className={styles.analyticsStat}>
                <Users size={15} />
                <span>Today</span>
                <b>{analytics?.visitorsToday ?? '—'}</b>
              </div>
              <div className={styles.analyticsStat}>
                <Eye size={15} />
                <span>Unique browsers</span>
                <b>{analytics?.totalUniqueVisitors ?? '—'}</b>
              </div>
              <label className={styles.publicToggle}>
                <input
                  type="checkbox"
                  checked={Boolean(analytics?.publicDisplayEnabled)}
                  onChange={togglePublicDisplay}
                  disabled={savingSetting || !analytics}
                />
                <span>Show today’s count to everyone</span>
              </label>
              <small>Browsers are counted once per day. Counts are approximate.</small>
            </section>
          )}
        </div>
      )}
    </footer>
  );
}
