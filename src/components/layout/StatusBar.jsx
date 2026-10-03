'use client';
import { AlertCircle } from 'lucide-react';
import styles from './StatusBar.module.css';

/**
 * Enterprise Clinical StatusBar
 * Displays persistent clinical verification advisory, system telemetry, and platform status.
 *
 * @param {object} props
 * @param {boolean} props.collapsed - Whether sidebar is collapsed
 */
export default function StatusBar({ collapsed }) {
  return (
    <footer className={`${styles.statusbar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.center}>
        <AlertCircle size={12} className={styles.warningIcon} />
        <span className={styles.disclaimerText}>
          AI findings support review and education. Confirm clinical decisions with a qualified dental professional.
        </span>
      </div>
    </footer>
  );
}
