'use client'

import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
  fullscreen?: boolean
}

export default function Spinner({ size = 'medium', text, fullscreen = false }: SpinnerProps) {
  const spinner = (
    <div className={styles.spinnerWrapper}>
      <div className={`${styles.spinner} ${styles[size]}`} />
      {text && <span className={styles.text}>{text}</span>}
    </div>
  )

  if (fullscreen) {
    return <div className={styles.overlay}>{spinner}</div>
  }

  return spinner
}
