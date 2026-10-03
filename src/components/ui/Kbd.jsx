import clsx from 'clsx';
import styles from './Kbd.module.css';

/**
 * Keyboard shortcut hint. Renders as a small mono-font key cap.
 * @param {object} props
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Kbd({ className, children, ...rest }) {
  return (
    <kbd className={clsx(styles.kbd, className)} {...rest}>
      {children}
    </kbd>
  );
}
