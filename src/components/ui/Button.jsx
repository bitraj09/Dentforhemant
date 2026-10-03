import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

/**
 * @typedef {'primary' | 'outline' | 'ghost' | 'danger'} ButtonVariant
 * @typedef {'sm' | 'md' | 'lg' | 'icon'} ButtonSize
 */

/**
 * Button primitive with consistent styling across the app.
 * @param {object} props
 * @param {ButtonVariant} [props.variant='primary']
 * @param {ButtonSize} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {React.ReactNode} [props.icon] - Leading icon element
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        styles.btn,
        styles[variant],
        styles[size],
        loading && styles.loading,
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={styles.icon} aria-hidden="true">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
});

export default Button;
