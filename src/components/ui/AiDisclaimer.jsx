import styles from './AiDisclaimer.module.css';

/**
 * Persistent, subtle "AI-assisted, clinician must verify" note.
 * Rendered inline wherever AI findings are displayed.
 * @param {object} props
 * @param {string} [props.className]
 */
export default function AiDisclaimer({ className, ...rest }) {
  return (
    <div className={`${styles.disclaimer} ${className || ''}`} role="note" {...rest}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM7.25 7.25h1.5v4h-1.5v-4z" fill="currentColor"/>
      </svg>
      <span>AI-assisted — clinician verification required</span>
    </div>
  );
}
