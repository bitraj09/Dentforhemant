import clsx from 'clsx';
import styles from './Skeleton.module.css';

/**
 * Skeleton placeholder for loading states.
 * @param {object} props
 * @param {'text' | 'circle' | 'rect'} [props.variant='text']
 * @param {string|number} [props.width]
 * @param {string|number} [props.height]
 * @param {string} [props.className]
 */
export default function Skeleton({ variant = 'text', width, height, className, ...rest }) {
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={clsx(styles.skeleton, styles[variant], className)}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}
