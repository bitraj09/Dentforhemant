import clsx from 'clsx';
import styles from './Badge.module.css';

/**
 * @typedef {'neutral' | 'ok' | 'watch' | 'warn' | 'critical' | 'primary'} BadgeVariant
 * @typedef {'sm' | 'md'} BadgeSize
 */

/**
 * Badge for status labels, severity indicators, and counts.
 * @param {object} props
 * @param {BadgeVariant} [props.variant='neutral']
 * @param {BadgeSize} [props.size='sm']
 * @param {React.ReactNode} [props.icon] - Leading icon
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Badge({ variant = 'neutral', size = 'sm', icon, className, children, ...rest }) {
  return (
    <span className={clsx(styles.badge, styles[variant], styles[size], className)} {...rest}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
