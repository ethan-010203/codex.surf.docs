'use client'

import { useEffect, useState } from 'react'

import Spinner from '@/components/Spinner'

import styles from './page.module.css'

interface ActivationRecord {
  code: string
  activated_account: string | null
  activated_at: string | null
}

interface ActionResult {
  success: boolean
  message: string
  record?: ActivationRecord
  alreadyActivated?: boolean
}

interface UserSession {
  token: string
  userId: string
  username: string
  role?: number
}

interface LoginResponse {
  success: boolean
  token?: string
  userId?: string
  username?: string
  role?: number
  message?: string
}

const SESSION_KEY = 'codex_surf_user_session'
const REGISTER_URL = 'https://codex.surf/register'

const copy = {
  brand: 'codex_surf',
  eyebrow: 'Access Pass',
  title: '激活码兑换',
  subtitle: '登录后输入激活码，即可绑定到当前账号。',
  loginTitle: '登录',
  loginSubtitle: '使用你的 codex.surf 账号密码继续。',
  usernameLabel: '用户名或邮箱',
  usernamePlaceholder: '请输入用户名或邮箱',
  passwordLabel: '密码',
  passwordPlaceholder: '请输入密码',
  codeLabel: '激活码',
  codePlaceholder: 'SURF-ABCD-EFGH-JKLM',
  currentUserLabel: '当前账号',
  bindHint: '兑换成功后会自动绑定到当前登录账号',
  login: '登录',
  loggingIn: '正在登录...',
  register: '注册',
  redeem: '立即兑换',
  checking: '正在恢复登录状态...',
  redeeming: '正在校验激活码...',
  successTitle: '兑换成功',
  errorTitle: '兑换失败',
  resultAccount: '绑定账号',
  resultTime: '激活时间',
  resultCode: '对应激活码',
  requiredCode: '请输入激活码',
  requiredUsername: '请输入用户名或邮箱',
  requiredPassword: '请输入密码',
  requiredLogin: '请先登录后再兑换激活码',
  loginExpired: '登录已失效，请重新登录。',
  networkError: '网络异常，请稍后重试',
  footnote: '兑换记录会同步保存，方便后续核验。',
  close: '关闭',
  logout: '退出登录',
}

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage

  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  ) {
    return storage
  }

  return null
}

function readSession(): UserSession | null {
  const raw = getBrowserStorage()?.getItem(SESSION_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as UserSession

    if (!session?.token || !session?.userId || !session?.username) {
      return null
    }

    return session
  } catch {
    return null
  }
}

function saveSession(session: UserSession) {
  getBrowserStorage()?.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearSession() {
  getBrowserStorage()?.removeItem(SESSION_KEY)
}

async function authFetch(url: string, options: RequestInit = {}) {
  const session = readSession()
  const headers = new Headers(options.headers)

  headers.set('Content-Type', 'application/json')

  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`)
  }

  if (session?.userId) {
    headers.set('New-Api-User', session.userId)
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '--'
  }

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Home() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [session, setSession] = useState<UserSession | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  const [loginLoading, setLoginLoading] = useState(false)
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [result, setResult] = useState<ActionResult | null>(null)

  useEffect(() => {
    void (async () => {
      const storedSession = readSession()

      if (!storedSession) {
        setCheckingSession(false)
        return
      }

      try {
        const response = await authFetch('/api/auth/check', { method: 'GET' })
        const data = (await response.json()) as {
          success: boolean
          user?: {
            id: string
            username: string
            role?: number
          }
        }

        if (!response.ok || !data.success || !data.user) {
          clearSession()
          setSession(null)
          setResult({ success: false, message: copy.loginExpired })
        } else {
          const nextSession = {
            token: storedSession.token,
            userId: storedSession.userId,
            username: data.user.username,
            role: data.user.role,
          }

          saveSession(nextSession)
          setSession(nextSession)
        }
      } catch {
        clearSession()
        setSession(null)
      } finally {
        setCheckingSession(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow

    if (isLoginModalOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isLoginModalOpen])

  useEffect(() => {
    if (!isLoginModalOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLoginModalOpen(false)
        setLoginError('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoginModalOpen])

  async function handleLogin() {
    if (!username.trim()) {
      setLoginError(copy.requiredUsername)
      return
    }

    if (!password) {
      setLoginError(copy.requiredPassword)
      return
    }

    setLoginLoading(true)
    setLoginError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      const data = (await response.json()) as LoginResponse

      if (!response.ok || !data.success || !data.token || !data.userId || !data.username) {
        setLoginError(data.message || '登录失败。')
        return
      }

      const nextSession = {
        token: data.token,
        userId: data.userId,
        username: data.username,
        role: data.role,
      }

      saveSession(nextSession)
      setSession(nextSession)
      setPassword('')
      setLoginError('')
      setIsLoginModalOpen(false)
      setResult(null)
    } catch {
      setLoginError(copy.networkError)
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout() {
    clearSession()
    setSession(null)
    setUsername('')
    setPassword('')
    setLoginError('')
    setResult(null)
  }

  async function handleRedeem() {
    if (!session) {
      setResult({ success: false, message: copy.requiredLogin })
      setIsLoginModalOpen(true)
      return
    }

    if (!code.trim()) {
      setResult({ success: false, message: copy.requiredCode })
      return
    }

    setRedeemLoading(true)
    setResult(null)

    try {
      const response = await authFetch('/api/activate', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
        }),
      })

      const data = (await response.json()) as ActionResult

      if (response.status === 401) {
        handleLogout()
        setResult({ success: false, message: copy.loginExpired })
        setIsLoginModalOpen(true)
        return
      }

      setResult(data)

      if (data.success) {
        setCode('')
      }
    } catch {
      setResult({ success: false, message: copy.networkError })
    } finally {
      setRedeemLoading(false)
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.mesh} />
      <div className={styles.glowA} />
      <div className={styles.glowB} />

      {(checkingSession || redeemLoading) && (
        <Spinner
          fullscreen
          text={checkingSession ? copy.checking : copy.redeeming}
          size='large'
        />
      )}

      <section className={styles.card}>
        <div className={styles.cardAura} />

        <div className={styles.cardTop}>
          <div className={styles.brand}>
            <span className={styles.brandOrb} />
            <span>{copy.brand}</span>
          </div>

          {session ? (
            <div className={styles.accountPill}>
              <span className={styles.accountLabel}>{copy.currentUserLabel}</span>
              <strong>{session.username}</strong>
            </div>
          ) : (
            <div className={styles.topActions}>
              <button
                className={styles.ghostButton}
                type='button'
                onClick={() => {
                  setLoginError('')
                  setIsLoginModalOpen(true)
                }}
              >
                {copy.login}
              </button>
              <a className={styles.linkButton} href={REGISTER_URL}>
                {copy.register}
              </a>
            </div>
          )}
        </div>

        <div className={styles.copyBlock}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>

        <section className={styles.redeemCard}>
          <div className={styles.redeemHint}>
            <span className={styles.redeemHintDot} />
            <span>
              {session ? (
                <>
                  即将绑定到 <strong>{session.username}</strong>
                </>
              ) : (
                copy.bindHint
              )}
            </span>
          </div>

          <label className={styles.field} htmlFor='code'>
            <span className={styles.label}>{copy.codeLabel}</span>
            <input
              id='code'
              className={styles.input}
              type='text'
              placeholder={copy.codePlaceholder}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleRedeem()
                }
              }}
              disabled={redeemLoading}
            />
          </label>

          <button
            type='button'
            className={styles.submitButton}
            onClick={() => void handleRedeem()}
            disabled={redeemLoading}
          >
            <span>{copy.redeem}</span>
          </button>
        </section>

        {session ? (
          <div className={styles.sessionRow}>
            <button className={styles.ghostButton} type='button' onClick={handleLogout}>
              {copy.logout}
            </button>
          </div>
        ) : null}

        {result && (
          <div
            className={`${styles.result} ${
              result.success ? styles.resultSuccess : styles.resultError
            }`}
          >
            <p className={styles.resultTitle}>
              {result.success ? copy.successTitle : copy.errorTitle}
            </p>
            <p className={styles.resultMessage}>{result.message}</p>

            {result.success && result.record && (
              <div className={styles.resultMeta}>
                <div className={styles.metaItem}>
                  <span>{copy.resultAccount}</span>
                  <strong>{result.record.activated_account ?? session?.username ?? '--'}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>{copy.resultTime}</span>
                  <strong>{formatDateTime(result.record.activated_at)}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>{copy.resultCode}</span>
                  <strong>{result.record.code}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        <p className={styles.footnote}>{copy.footnote}</p>
      </section>

      {isLoginModalOpen && (
        <div
          className={styles.modalOverlay}
          role='presentation'
          onClick={() => {
            setIsLoginModalOpen(false)
            setLoginError('')
          }}
        >
          <div className={styles.modalGlowA} />
          <div className={styles.modalGlowB} />

          <div
            className={styles.modalCard}
            role='dialog'
            aria-modal='true'
            aria-labelledby='login-title'
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className={styles.closeButton}
              type='button'
              aria-label={copy.close}
              onClick={() => {
                setIsLoginModalOpen(false)
                setLoginError('')
              }}
            >
              ×
            </button>

            <div className={styles.modalBrand}>
              <span className={styles.modalOrb} />
              <span>codex_surf</span>
            </div>

            <div className={styles.modalHeader}>
              <h2 id='login-title' className={styles.modalTitle}>
                {copy.loginTitle}
              </h2>
              <p className={styles.modalSubtitle}>{copy.loginSubtitle}</p>
            </div>

            <div className={styles.modalForm}>
              <label className={styles.field} htmlFor='login-username'>
                <span className={styles.label}>{copy.usernameLabel}</span>
                <input
                  id='login-username'
                  className={styles.modalInput}
                  type='text'
                  placeholder={copy.usernamePlaceholder}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loginLoading}
                />
              </label>

              <label className={styles.field} htmlFor='login-password'>
                <span className={styles.label}>{copy.passwordLabel}</span>
                <input
                  id='login-password'
                  className={styles.modalInput}
                  type='password'
                  placeholder={copy.passwordPlaceholder}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loginLoading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleLogin()
                    }
                  }}
                />
              </label>

              {loginError && <div className={styles.inlineError}>{loginError}</div>}

              <button
                className={styles.modalSubmit}
                type='button'
                onClick={() => void handleLogin()}
                disabled={loginLoading}
              >
                <span>{loginLoading ? copy.loggingIn : copy.login}</span>
              </button>

              <div className={styles.modalFooter}>
                <span>没有账户？</span>
                <a href={REGISTER_URL}>立即注册</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
