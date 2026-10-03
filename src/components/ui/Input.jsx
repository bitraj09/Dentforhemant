import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

/**
 * Input primitive with label, leading icon, helper text, and error state.
 * @param {object} props
 * @param {string} [props.label]
 * @param {React.ReactNode} [props.icon] - Leading icon element
 * @param {string} [props.helperText]
 * @param {string} [props.error]
 * @param {string} [props.className]
 * @param {'sm' | 'md'} [props.size='md']
 */
const Input = forwardRef(function Input(
  { label, icon, helperText, error, className, size = 'md', id, ...rest },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={clsx(styles.group, className)}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={clsx(styles.wrap, icon && styles.hasIcon, error && styles.hasError, styles[size])}>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={!!error}
          {...rest}
        />
      </div>
      {(error || helperText) && (
        <span className={clsx(styles.helper, error && styles.errorText)}>
          {error || helperText}
        </span>
      )}
    </div>
  );
});

export default Input;
