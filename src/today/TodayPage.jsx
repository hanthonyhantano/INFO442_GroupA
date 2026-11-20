import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { loadToday, setTaskDone } from './todayApi'
import {
  FILTERS, attentionLine, filterTasks, formatAge, greeting, nextProcessing, splitTasks, taskCounts, weekStats,
} from './today'
import './today.css'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function shortDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TodayPage() {
  const { producer } = useNavigation()
  const [data, setData] = useState(null)
  const [tasks, setTasks] = useState([])
  const [status, setStatus] = useState('loading')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadToday()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setTasks(result.tasks)
        setStatus('ready')
      })
      .catch((error) => {
        console.error('Today failed to load:', error)
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  const { open, completed } = useMemo(
    () => splitTasks(tasks, tasks.filter((task) => task.isCompleted).map((task) => task.key)),
    [tasks],
  )
  const counts = useMemo(() => taskCounts(open), [open])
  const visible = filterTasks(open, filter)
  const week = useMemo(() => (data ? weekStats(data.orders, data.cuts) : null), [data])
  const next = useMemo(
    () => (data ? nextProcessing(data.batches, new Date().toLocaleDateString('en-CA')) : null),
    [data],
  )

  async function toggle(task) {
    const done = !task.isCompleted
    setError('')
    setTasks((list) => list.map((item) => (item.key === task.key ? { ...item, isCompleted: done } : item)))
    try {
      await setTaskDone(task.rowId, done)
    } catch {
      setTasks((list) => list.map((item) => (item.key === task.key ? { ...item, isCompleted: !done } : item)))
      setError('Something went wrong. Try again.')
    }
  }

  if (status === 'loading') return <p className="today-message">Loading…</p>
  if (status === 'error') return <p className="today-message" role="alert">Something went wrong. Try again.</p>

  const firstName = producer?.name?.split(' ')[0] ?? ''

  return (
    <div className="today">
      <div className="today-main">
        <h2 className="today-greeting">{greeting(firstName)}</h2>
        <p className="today-sub">{attentionLine(open.length)}</p>

        <div className="today-chips" role="group" aria-label="Filter tasks">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'today-chip is-selected' : 'today-chip'}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label} {counts[key]}
            </button>
          ))}
        </div>

        {error && <p className="today-error" role="alert">{error}</p>}

        {open.length === 0 ? (
          <p className="today-message">You're all caught up.</p>
        ) : visible.length === 0 ? (
          <p className="today-message">Nothing Needs Attention</p>
        ) : (
          <ul className="today-list">
            {visible.map((task) => (
              <li key={task.key} className="today-task">
                <input
                  type="checkbox"
                  checked={false}
                  aria-label={'Mark done: ' + task.title}
                  onChange={() => toggle(task)}
                />
                <div className="today-task-text">
                  <strong>{task.title}</strong>
                  <small>{task.description}</small>
                </div>
                <span className={task.type === 'conflict' ? 'today-tag conflict' : 'today-tag'}>{task.tag}</span>
                <span className="today-age">{formatAge(task.createdAt)}</span>
                <Link className="today-action" to={task.to}>{task.action}</Link>
              </li>
            ))}
          </ul>
        )}

        {completed.length > 0 && (
          <section className="today-completed" aria-label="Completed">
            <h3>COMPLETED</h3>
            <ul>
              {completed.map((task) => (
                <li key={task.key}>
                  <input
                    type="checkbox"
                    checked
                    aria-label={'Reopen: ' + task.title}
                    onChange={() => toggle(task)}
                  />
                  <s>{task.title}</s>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="today-side">
        <section className="today-card" aria-label="This week">
          <h3>THIS WEEK</h3>
          <dl>
            <div><dt>Packages available</dt><dd>{week.packagesAvailable}</dd></div>
            <div><dt>Pending value</dt><dd>{money.format(week.pendingValue)}</dd></div>
            <div><dt>Confirmed orders</dt><dd>{week.confirmedOrders}</dd></div>
          </dl>
        </section>
        <section className="today-card" aria-label="Next processing date">
          <h3>NEXT PROCESSING DATE</h3>
          {next ? (
            <p>
              <strong>{shortDate(next.processingDate)}</strong>
              {next.processorName ? ' · ' + next.processorName : ''}
            </p>
          ) : (
            <p>No processing date scheduled.</p>
          )}
        </section>
      </aside>
    </div>
  )
}