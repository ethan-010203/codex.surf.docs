'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import Spinner from '@/components/Spinner'

import styles from './page.module.css'

type CodeStatus = 'unused' | 'activated' | 'disabled'
type StatusFilter = 'all' | CodeStatus

interface Summary {
  total: number
  activated: number
  unused: number
  disabled: number
  activatedToday: number
}

interface ActivationCodeRecord {
  id: string
  code: string
  status: CodeStatus
  subscription_plan_id: number | null
  activated_account: string | null
  activated_at: string | null
  batch_id: string | null
  note: string | null
  created_at: string
  updated_at: string | null
}

interface SubscriptionPlanOption {
  id: number
  title: string
  subtitle: string
  enabled: boolean
  priceAmount: number
  currency: string
  durationUnit: string
  durationValue: number
  totalAmount: number
  quotaResetPeriod: string
}

interface DashboardResponse {
  success: boolean
  user?: {
    id: string
    username: string
    role?: number
  }
  summary?: Summary
  recentActivations?: ActivationCodeRecord[]
  codes?: ActivationCodeRecord[]
  subscriptionPlans?: SubscriptionPlanOption[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  message?: string
  warning?: string
}

interface LoginResponse {
  success: boolean
  token?: string
  userId?: string
  username?: string
  role?: number
  message?: string
}

interface AdminSession {
  token: string
  userId: string
  username?: string
  role?: number
}

const SESSION_KEY = 'codex_surf_admin_session'

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

function readSession(): AdminSession | null {
  const raw = getBrowserStorage()?.getItem(SESSION_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as AdminSession

    if (!session?.token || !session?.userId) {
      return null
    }

    return session
  } catch {
    return null
  }
}

function saveSession(session: AdminSession) {
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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || 'USD'} ${amount}`
  }
}

function formatPlanDuration(plan: SubscriptionPlanOption) {
  switch (plan.durationUnit) {
    case 'year':
      return `${plan.durationValue} 年`
    case 'month':
      return `${plan.durationValue} 月`
    case 'day':
      return `${plan.durationValue} 天`
    case 'hour':
      return `${plan.durationValue} 小时`
    case 'custom':
      return '自定义周期'
    default:
      return `${plan.durationValue} ${plan.durationUnit}`
  }
}

function formatResetPeriod(period: string) {
  switch (period) {
    case 'daily':
      return '每日重置'
    case 'weekly':
      return '每周重置'
    case 'monthly':
      return '每月重置'
    case 'custom':
      return '自定义重置'
    default:
      return '不自动重置'
  }
}

function formatPlanSummary(plan: SubscriptionPlanOption) {
  return `${formatMoney(plan.priceAmount, plan.currency)} / ${formatPlanDuration(plan)} · ${formatResetPeriod(plan.quotaResetPeriod)}`
}

function statusLabel(status: CodeStatus) {
  switch (status) {
    case 'activated':
      return '已激活'
    case 'disabled':
      return '已停用'
    default:
      return '未使用'
  }
}

export default function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [recentActivations, setRecentActivations] = useState<ActivationCodeRecord[]>([])
  const [codes, setCodes] = useState<ActivationCodeRecord[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanOption[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [generateCount, setGenerateCount] = useState(10)
  const [generatePrefix, setGeneratePrefix] = useState('SURF')
  const [generateBatchId, setGenerateBatchId] = useState('')
  const [generateNote, setGenerateNote] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<ActivationCodeRecord[]>([])
  const [generateLoading, setGenerateLoading] = useState(false)
  const [flashMessage, setFlashMessage] = useState('')

  const availablePlans = subscriptionPlans.filter((plan) => plan.enabled)
  const selectedPlan = subscriptionPlans.find((plan) => plan.id === selectedPlanId) ?? null

  const resetDashboard = useCallback(() => {
    setSummary(null)
    setRecentActivations([])
    setCodes([])
    setSubscriptionPlans([])
    setSelectedPlanId(0)
    setGeneratedCodes([])
    setTotalPages(1)
    setTotalRecords(0)
    setFlashMessage('')
  }, [])

  const handleUnauthorized = useCallback(() => {
    clearSession()
    setIsLoggedIn(false)
    setCurrentUser('')
    resetDashboard()
  }, [resetDashboard])

  const loadDashboard = useCallback(
    async (nextPage: number, nextSearch: string, nextStatus: StatusFilter) => {
      setLoading(true)

      try {
        const query = new URLSearchParams({
          page: String(nextPage),
          pageSize: '20',
          status: nextStatus,
        })

        if (nextSearch.trim()) {
          query.set('search', nextSearch.trim())
        }

        const response = await authFetch(`/api/admin/codes?${query.toString()}`)
        const data = (await response.json()) as DashboardResponse

        if (response.status === 401) {
          handleUnauthorized()
          throw new Error(data.message || '登录已失效，请重新登录。')
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || '加载后台数据失败。')
        }

        const nextPlans = data.subscriptionPlans ?? []

        setCurrentUser((previous) => data.user?.username ?? previous)
        setSummary(data.summary ?? null)
        setRecentActivations(data.recentActivations ?? [])
        setCodes(data.codes ?? [])
        setSubscriptionPlans(nextPlans)
        setSelectedPlanId((current) => {
          if (nextPlans.some((plan) => plan.enabled && plan.id === current)) {
            return current
          }

          return nextPlans.find((plan) => plan.enabled)?.id ?? 0
        })
        setTotalPages(data.pagination?.totalPages ?? 1)
        setTotalRecords(data.pagination?.total ?? 0)
        setFlashMessage(data.warning ?? '')
      } catch (error) {
        setFlashMessage(error instanceof Error ? error.message : '加载后台数据失败。')
      } finally {
        setLoading(false)
      }
    },
    [handleUnauthorized]
  )

  useEffect(() => {
    void (async () => {
      const session = readSession()

      if (!session?.token || !session.userId) {
        setCheckingSession(false)
        return
      }

      try {
        const response = await authFetch('/api/admin/check', { method: 'GET' })
        const data = (await response.json()) as {
          success: boolean
          user?: {
            username: string
          }
        }

        if (response.ok && data.success && data.user) {
          setCurrentUser(data.user.username)
          setIsLoggedIn(true)
        } else {
          handleUnauthorized()
        }
      } catch {
        handleUnauthorized()
      } finally {
        setCheckingSession(false)
      }
    })()
  }, [handleUnauthorized])

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    void loadDashboard(page, search, statusFilter)
  }, [isLoggedIn, loadDashboard, page, search, statusFilter])

  async function handleLogin() {
    setLoginError('')

    try {
      const response = await fetch('/api/admin/login', {
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
        setLoginError(data.message || '管理员登录失败。')
        return
      }

      saveSession({
        token: data.token,
        userId: data.userId,
        username: data.username,
        role: data.role,
      })

      setCurrentUser(data.username)
      setIsLoggedIn(true)
      setUsername('')
      setPassword('')
      setPage(1)
      setLoginError('')
      setFlashMessage('')
    } catch {
      setLoginError('网络异常，请稍后重试。')
    }
  }

  function handleLogout() {
    clearSession()
    setIsLoggedIn(false)
    setCurrentUser('')
    resetDashboard()
  }

  function getPlanTitle(planId: number | null) {
    if (!planId) {
      return '--'
    }

    const plan = subscriptionPlans.find((item) => item.id === planId)
    return plan ? plan.title : `计划 #${planId}`
  }

  async function handleGenerateCodes() {
    if (selectedPlanId <= 0) {
      setFlashMessage('请先选择一个可用套餐。')
      return
    }

    setGenerateLoading(true)

    try {
      const response = await authFetch('/api/admin/generate-codes', {
        method: 'POST',
        body: JSON.stringify({
          count: generateCount,
          prefix: generatePrefix,
          batchId: generateBatchId,
          note: generateNote,
          subscriptionPlanId: selectedPlanId,
        }),
      })

      const data = (await response.json()) as {
        success: boolean
        message?: string
        codes?: ActivationCodeRecord[]
      }

      if (response.status === 401) {
        handleUnauthorized()
        throw new Error(data.message || '登录已失效，请重新登录。')
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || '生成激活码失败。')
      }

      setGeneratedCodes(data.codes ?? [])
      setFlashMessage(data.message ?? '激活码生成完成。')
      setPage(1)
      await loadDashboard(1, search, statusFilter)
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : '生成激活码失败。')
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleCopyBatch() {
    if (!generatedCodes.length) {
      return
    }

    try {
      await navigator.clipboard.writeText(generatedCodes.map((item) => item.code).join('\n'))
      setFlashMessage('本批激活码已复制到剪贴板。')
    } catch {
      setFlashMessage('复制失败，请手动复制。')
    }
  }

  if (checkingSession) {
    return (
      <div className={styles.loadingPage}>
        <Spinner text='正在恢复管理员会话...' size='large' />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <main className={styles.loginShell}>
        <section className={styles.loginPanel}>
          <p className={styles.loginBrand}>codex_surf</p>
          <h1 className={styles.loginTitle}>管理后台</h1>
          <p className={styles.loginSubtitle}>
            使用 newapi 管理员账号登录后，即可查看套餐、生成激活码，并查询兑换记录。
          </p>

          <label className={styles.loginLabel} htmlFor='username'>
            管理员账号
          </label>
          <input
            id='username'
            className={styles.loginInput}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder='请输入 newapi 管理员账号'
          />

          <label className={styles.loginLabel} htmlFor='password'>
            管理员密码
          </label>
          <input
            id='password'
            type='password'
            className={styles.loginInput}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder='请输入管理员密码'
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleLogin()
              }
            }}
          />

          {loginError && <div className={styles.loginError}>{loginError}</div>}

          <button className={styles.loginButton} type='button' onClick={() => void handleLogin()}>
            登录后台
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.dashboardShell}>
      {(loading || generateLoading) && (
        <Spinner
          fullscreen
          text={generateLoading ? '正在生成激活码...' : '正在同步后台数据...'}
          size='large'
        />
      )}

      <header className={styles.header}>
        <div>
          <p className={styles.headerBrand}>codex_surf</p>
          <h1 className={styles.headerTitle}>激活码控制台</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.headerUser}>当前账号：{currentUser || '--'}</span>
          <Link className={styles.secondaryButton} href='/'>
            返回前台
          </Link>
          <button className={styles.secondaryButton} type='button' onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      {flashMessage && <div className={styles.flash}>{flashMessage}</div>}

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>激活码总量</span>
          <strong className={styles.summaryValue}>{summary?.total ?? '--'}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>已激活</span>
          <strong className={styles.summaryValue}>{summary?.activated ?? '--'}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>未使用</span>
          <strong className={styles.summaryValue}>{summary?.unused ?? '--'}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>今日激活</span>
          <strong className={styles.summaryValue}>{summary?.activatedToday ?? '--'}</strong>
        </article>
      </section>

      <section className={styles.controlGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Recent Activations</p>
              <h2 className={styles.panelTitle}>最近兑换记录</h2>
            </div>
            <span className={styles.panelMeta}>最近展示 {recentActivations.length} 条记录</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>激活账号</th>
                  <th>套餐</th>
                  <th>激活码</th>
                  <th>激活时间</th>
                  <th>批次</th>
                </tr>
              </thead>
              <tbody>
                {recentActivations.length ? (
                  recentActivations.map((record) => (
                    <tr key={record.id}>
                      <td>{record.activated_account ?? '--'}</td>
                      <td>{getPlanTitle(record.subscription_plan_id)}</td>
                      <td className={styles.codeCell}>{record.code}</td>
                      <td>{formatDateTime(record.activated_at)}</td>
                      <td>{record.batch_id ?? '--'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>
                      暂无兑换记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.generator}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Generate Batch</p>
              <h2 className={styles.panelTitle}>生成激活码</h2>
            </div>
            <span className={styles.panelMeta}>
              已加载 {subscriptionPlans.length} 个套餐，可用 {availablePlans.length} 个
            </span>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>绑定套餐</span>
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(Number(event.target.value) || 0)}
              >
                <option value={0}>请选择套餐</option>
                {subscriptionPlans.map((plan) => (
                  <option key={plan.id} value={plan.id} disabled={!plan.enabled}>
                    {plan.title}
                    {plan.enabled ? '' : '（已停用）'}
                  </option>
                ))}
              </select>
            </label>

            {selectedPlan ? (
              <div className={styles.planHint}>
                <strong>{selectedPlan.title}</strong>
                <span>{formatPlanSummary(selectedPlan)}</span>
                {selectedPlan.subtitle ? <span>{selectedPlan.subtitle}</span> : null}
              </div>
            ) : (
              <div className={`${styles.planHint} ${styles.planHintMuted}`}>
                <strong>暂无可用套餐</strong>
                <span>请先在 newapi 后台创建并启用订阅套餐，然后刷新这里。</span>
              </div>
            )}

            <label className={styles.field}>
              <span>数量</span>
              <input
                type='number'
                min={1}
                max={200}
                value={generateCount}
                onChange={(event) => setGenerateCount(Number(event.target.value) || 1)}
              />
            </label>
            <label className={styles.field}>
              <span>前缀</span>
              <input
                type='text'
                value={generatePrefix}
                onChange={(event) => setGeneratePrefix(event.target.value.toUpperCase())}
                placeholder='例如 SURF'
              />
            </label>
            <label className={styles.field}>
              <span>批次号</span>
              <input
                type='text'
                value={generateBatchId}
                onChange={(event) => setGenerateBatchId(event.target.value)}
                placeholder='留空则自动生成'
              />
            </label>
            <label className={styles.field}>
              <span>备注</span>
              <textarea
                value={generateNote}
                onChange={(event) => setGenerateNote(event.target.value)}
                placeholder='记录渠道、说明或售卖备注'
                rows={4}
              />
            </label>
          </div>

          <button
            className={styles.primaryButton}
            type='button'
            onClick={() => void handleGenerateCodes()}
            disabled={availablePlans.length === 0}
          >
            生成一批激活码
          </button>

          <div className={styles.generatedBox}>
            <div className={styles.generatedHeader}>
              <strong>最近生成结果</strong>
              <button
                className={styles.secondaryButton}
                type='button'
                onClick={() => void handleCopyBatch()}
                disabled={generatedCodes.length === 0}
              >
                复制本批
              </button>
            </div>
            <div className={styles.generatedList}>
              {generatedCodes.length ? (
                generatedCodes.map((item) => (
                  <code key={item.id} className={styles.generatedCode}>
                    {item.code}
                  </code>
                ))
              ) : (
                <p className={styles.generatedEmpty}>生成后的激活码会显示在这里。</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.panel}>
        <div className={styles.inventoryHeader}>
          <div>
            <p className={styles.panelEyebrow}>Code Inventory</p>
            <h2 className={styles.panelTitle}>码库明细</h2>
          </div>
          <div className={styles.filters}>
            <div className={styles.filterTabs}>
              {(['all', 'unused', 'activated', 'disabled'] as StatusFilter[]).map((item) => (
                <button
                  key={item}
                  type='button'
                  className={`${styles.filterTab} ${
                    statusFilter === item ? styles.filterTabActive : ''
                  }`}
                  onClick={() => {
                    setStatusFilter(item)
                    setPage(1)
                  }}
                >
                  {item === 'all'
                    ? '全部'
                    : item === 'unused'
                      ? '未使用'
                      : item === 'activated'
                        ? '已激活'
                        : '已停用'}
                </button>
              ))}
            </div>

            <div className={styles.searchRow}>
              <input
                className={styles.searchInput}
                type='text'
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder='搜索激活码、账号、批次、备注或 plan id'
              />
              <button
                className={styles.secondaryButton}
                type='button'
                onClick={() => {
                  setSearch(searchDraft.trim())
                  setPage(1)
                }}
              >
                搜索
              </button>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>激活码</th>
                <th>状态</th>
                <th>套餐</th>
                <th>激活账号</th>
                <th>激活时间</th>
                <th>批次</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {codes.length ? (
                codes.map((record) => (
                  <tr key={record.id}>
                    <td className={styles.codeCell}>{record.code}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          record.status === 'activated'
                            ? styles.badgeSuccess
                            : record.status === 'disabled'
                              ? styles.badgeMuted
                              : styles.badgeWarm
                        }`}
                      >
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td>{getPlanTitle(record.subscription_plan_id)}</td>
                    <td>{record.activated_account ?? '--'}</td>
                    <td>{formatDateTime(record.activated_at)}</td>
                    <td>{record.batch_id ?? '--'}</td>
                    <td>{record.note ?? '--'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    没有找到符合条件的记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span>
            共 {totalRecords} 条记录，第 {page} / {totalPages} 页
          </span>
          <div className={styles.paginationButtons}>
            <button
              className={styles.secondaryButton}
              type='button'
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              上一页
            </button>
            <button
              className={styles.secondaryButton}
              type='button'
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
