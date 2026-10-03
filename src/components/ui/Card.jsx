import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

/**
 * Surface card — flat with 1px border. No hover lift by default.
 * @param {object} props
 * @param {'default' | 'raised' | 'inset'} [props.variant='default']
 * @param {boolean} [props.interactive=false] - Adds hover state
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
const Card = forwardRef(function Card(
  { variant = 'default', interactive = false, className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        styles.card,
        styles[variant],
        interactive && styles.interactive,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
