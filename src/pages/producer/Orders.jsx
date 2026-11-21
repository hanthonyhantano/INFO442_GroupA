import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as store from '../../lib/OrdersStore';
const COLUMNS = [
  { status: 'new', title: 'New', dropLabel: '' },
  { status: 'confirmed', title: 'Confirmed', dropLabel: 'Drop to confirm' },
  { status: 'packed', title: 'Packed', dropLabel: 'Drop to mark packed' },
  { status: 'delivered', title: 'Delivered', dropLabel: 'Drop to mark delivered' },
];
const STATUS_LABEL = { new: 'New', confirmed: 'Confirmed', packed: 'Packed', delivered: 'Delivered' };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = (n) => `$${n.toFixed(2)}`;
// "Fri, Nov 21" — or null when there's no date (so it never shows Jan 1, 1970)
const shortDate = (ts) =>
  ts == null
    ? null
    : new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fullDate = (ts) =>
  new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

function formatAgo(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'NOW';
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

function useOrdersStore() {
  const [snapshot, setSnapshot] = useState(store.getState());
  useEffect(() => store.subscribe(setSnapshot), []);
  return snapshot;
}

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Orders() {
  const data = useOrdersStore();
  const now = useNow();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [shortOnly, setShortOnly] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStatus, setOverStatus] = useState(null);
  const [toast, setToast] = useState(null);

  // Add ?simulateError to the URL to see the load-failure state (PO17).
  const simulateError = useMemo(
    () => new URLSearchParams(window.location.search).has('simulateError'),
    []
  );

  useEffect(() => {
    if (store.getState().status !== 'ready') store.loadData({ simulateError });
  }, [simulateError]);

  /* Toasts */
  const toastTimer = useRef(null);
  function flash(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const emailCount = useRef(data.emails.length);
  useEffect(() => {
    if (data.emails.length > emailCount.current) {
      const last = data.emails[data.emails.length - 1];
      flash(`Email sent to ${last.to}`);
    }
    emailCount.current = data.emails.length;
  }, [data.emails]);

  /* Filter popover: close on outside click */
  const filterRef = useRef(null);
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  /* Search + filter */
  const q = query.trim().toLowerCase();
  const visible = data.orders.filter(
    (o) =>
      (!q || o.id.toLowerCase().includes(q) || o.shopper.toLowerCase().includes(q)) &&
      (!shortOnly || store.shortageOf(o) > 0)
  );
  const byStatus = {};
  COLUMNS.forEach(({ status }) => {
    byStatus[status] = visible
      .filter((o) => o.status === status)
      .sort((a, b) => (b.deliveredAt ?? b.createdAt) - (a.deliveredAt ?? a.createdAt));
  });
  const noMatches = (q || shortOnly) && visible.length === 0;

  /* Drag and drop */
  const dragOrder = dragId ? data.orders.find((o) => o.id === dragId) : null;
  const dragTarget = dragOrder
    ? store.STATUSES[store.STATUSES.indexOf(dragOrder.status) + 1] ?? null
    : null;

  async function move(id, to) {
    const result = await store.moveOrder(id, to);
    if (!result.ok) flash(result.error);
  }

  function endDrag() {
    setDragId(null);
    setOverStatus(null);
  }

  async function confirm(id) {
    const result = await store.confirmOrder(id);
    if (!result.ok) flash(result.error);
  }

  function startReject(id) {
    setOpenOrderId(null);
    setRejectingId(id);
  }

  const openOrder = openOrderId ? data.orders.find((o) => o.id === openOrderId) : null;
  const rejectingOrder = rejectingId ? data.orders.find((o) => o.id === rejectingId) : null;

  return (
    <div className="po-app">
      {/* ---------------- Main ---------------- */}
      <main className="po-main">
        <header className="po-header">
          <h1>Orders</h1>
          <div className="po-header-actions">
            <input
              type="search"
              className="po-input po-search"
              placeholder="Search orders…"
              aria-label="Search orders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="po-filter" ref={filterRef}>
              <button
                type="button"
                className={`po-btn ${shortOnly ? 'is-on' : ''}`}
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((v) => !v)}
              >
                Filter{shortOnly ? ' · 1' : ''}
              </button>
              {filterOpen && (
                <div className="po-popover">
                  <label className="po-check">
                    <input
                      type="checkbox"
                      checked={shortOnly}
                      onChange={(e) => setShortOnly(e.target.checked)}
                    />
                    Shortages only
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              className="po-btn"
              aria-pressed={stockOpen}
              onClick={() => setStockOpen((v) => !v)}
            >
              Stock panel
            </button>
          </div>
        </header>

        <div className="po-body">
          <section className="po-board-wrap" aria-label="Order board">
            {data.status === 'error' && (
              <div className="po-state" role="alert">
                <p>Something went wrong. Try again.</p>
                <button type="button" className="po-btn" onClick={() => store.loadData()}>
                  Retry
                </button>
              </div>
            )}

            {(data.status === 'loading' || data.status === 'idle') && (
              <div className="po-state" aria-live="polite">Loading orders…</div>
            )}

            {data.status === 'ready' && (
              <>
                {noMatches && (
                  <p className="po-no-match" role="status">No orders match.</p>
                )}
                <div className="po-board">
                  {COLUMNS.map((col) => {
                    const orders = byStatus[col.status];
                    const isTarget = dragTarget === col.status;
                    return (
                      <div
                        key={col.status}
                        className={`po-column ${isTarget && overStatus === col.status ? 'is-over' : ''}`}
                        onDragOver={(e) => {
                          if (!isTarget) return; // not preventing default = drop not allowed
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overStatus !== col.status) setOverStatus(col.status);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setOverStatus(null);
                        }}
                        onDrop={(e) => {
                          if (!isTarget) return;
                          e.preventDefault();
                          const id = e.dataTransfer.getData('text/plain') || dragId;
                          endDrag();
                          move(id, col.status);
                        }}
                      >
                        <div className="po-column-head">
                          <h2>{col.title}</h2>
                          <span
                            className={`po-count ${col.status === 'new' ? 'po-count--blue' : ''}`}
                            aria-label={`${orders.length} orders`}
                          >
                            {orders.length}
                          </span>
                        </div>

                        <div className="po-cards">
                          {orders.map((order) => {
                            const short = store.shortageOf(order);
                            const canDrag =
                              order.status !== 'delivered' && !(order.status === 'new' && short > 0);
                            return (
                              <OrderCard
                                key={order.id}
                                order={order}
                                now={now}
                                short={short}
                                draggable={canDrag}
                                isDragging={dragId === order.id}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', order.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDragId(order.id);
                                }}
                                onDragEnd={endDrag}
                                onOpen={() => setOpenOrderId(order.id)}
                                onConfirm={() => confirm(order.id)}
                                onReject={() => startReject(order.id)}
                              />
                            );
                          })}
                          {isTarget && <div className="po-dropzone">{col.dropLabel}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {stockOpen && (
            <StockPanel
              cuts={data.cuts}
              ready={data.status === 'ready'}
              onClose={() => setStockOpen(false)}
              onOpenInventory={() => navigate('/producer/inventory')}
            />
          )}
        </div>
      </main>

      {openOrder && (
        <OrderDetail
          order={openOrder}
          onClose={() => setOpenOrderId(null)}
          onConfirm={() => confirm(openOrder.id)}
          onReject={() => startReject(openOrder.id)}
        />
      )}

      {rejectingOrder && (
        <RejectDialog order={rejectingOrder} onClose={() => setRejectingId(null)} />
      )}

      {toast && (
        <div className="po-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order card                                                          */
/* ------------------------------------------------------------------ */

function OrderCard({
  order, now, short, draggable, isDragging, onDragStart, onDragEnd, onOpen, onConfirm, onReject,
}) {
  const final = store.finalPriceOf(order);

  let detail;
  if (order.status === 'new') {
    detail = `${store.packageCount(order)} pkg · Est. ${money(store.estimateOf(order))}`;
  } else if (order.status === 'confirmed') {
    detail = final === null ? 'Weigh & send final price' : `Final ${money(final)}`;
  } else if (order.status === 'packed') {
    const date = shortDate(order.deliveryDate);
    detail = date ? `Delivery ${date}` : 'Delivery date not set';
  } else {
    const date = shortDate(order.deliveredAt ?? order.deliveryDate);
    detail = date ? `Delivered ${date}` : 'Delivered';
  }

  const stop = (e) => e.stopPropagation();

  return (
    <article
      className={[
        'po-card',
        `po-card--${order.status}`,
        isDragging ? 'is-dragging' : '',
        draggable ? 'is-draggable' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
      aria-label={`Order ${order.id} from ${order.shopper}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="po-card-top">
        <span className="po-mono">{order.id}</span>
        <span className="po-card-meta">
          {short > 0 && <span className="po-short">Short {short}</span>}
          <span className="po-ago" title={fullDate(order.createdAt)}>
            {formatAgo(now - order.createdAt)}
          </span>
        </span>
      </div>
      <div className="po-card-name">{order.shopper}</div>
      <div className="po-card-detail">{detail}</div>

      {order.status === 'new' && (
        <div className="po-card-actions" onClick={stop} onKeyDown={stop}>
          <button
            type="button"
            className="po-btn po-btn--primary po-btn--sm"
            disabled={short > 0}
            title={short > 0 ? 'Fix the shortage first' : undefined}
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button type="button" className="po-btn po-btn--sm" onClick={onReject}>
            Reject
          </button>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Stock panel                                                         */
/* ------------------------------------------------------------------ */

function StockPanel({ cuts, ready, onClose, onOpenInventory }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = cuts.filter((c) => c.name.toLowerCase().includes(q));

  return (
    <aside className="po-stock" aria-label="Stock">
      <div className="po-stock-head">
        <h2>Stock</h2>
        <button type="button" className="po-icon-btn" aria-label="Close stock panel" onClick={onClose}>
          ×
        </button>
      </div>

      <input
        type="search"
        className="po-input"
        placeholder="Find a cut…"
        aria-label="Find a cut"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {ready && list.length === 0 && <p className="po-empty">No matches listed</p>}

      {list.length > 0 && (
        <ul className="po-stock-list">
          {list.map((cut) => {
            const noData = cut.available === null;
            const low = !noData && cut.available <= store.LOW_STOCK_THRESHOLD;
            return (
              <li key={cut.id}>
                <span>{cut.name}</span>
                {noData ? (
                  <span className="po-mono po-muted" aria-label="No stock data">-</span>
                ) : (
                  <span
                    className={`po-mono ${low ? 'po-low' : ''}`}
                    aria-label={`${cut.available} available, ${cut.reserved} reserved`}
                  >
                    {cut.available} · {cut.reserved} RSV
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="po-btn po-btn--block" onClick={onOpenInventory}>
        Open inventory
      </button>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Modal shell                                                         */
/* ------------------------------------------------------------------ */

function Modal({ title, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="po-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`po-modal po-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="po-modal-head">
          <h2>{title}</h2>
          <button type="button" className="po-icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="po-modal-body">{children}</div>
        {footer && <div className="po-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full order view                                                     */
/* ------------------------------------------------------------------ */

function OrderDetail({ order, onClose, onConfirm, onReject }) {
  const short = store.shortageOf(order);
  const final = store.finalPriceOf(order);
  const lines = order.items.map((item, index) => ({ item, index })).filter(({ item }) => item.qty > 0);

  const footer =
    order.status === 'new' ? (
      <>
        <button type="button" className="po-btn" onClick={onReject}>
          Reject
        </button>
        <button
          type="button"
          className="po-btn po-btn--primary"
          disabled={short > 0}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </>
    ) : null;

  return (
    <Modal title={`Order ${order.id}`} onClose={onClose} footer={footer} size="lg">
      <dl className="po-meta">
        <div>
          <dt>Shopper</dt>
          <dd>
            {order.shopper}
            <br />
            <span className="po-muted">{order.email}</span>
          </dd>
        </div>
        <div>
          <dt>Placed</dt>
          <dd>{fullDate(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{STATUS_LABEL[order.status]}</dd>
        </div>
        {order.deliveryDate && (
          <div>
            <dt>{order.status === 'delivered' ? 'Delivered' : 'Delivery'}</dt>
            <dd>{new Date(order.deliveredAt ?? order.deliveryDate).toDateString()}</dd>
          </div>
        )}
      </dl>

      {order.status === 'new' && short > 0 && (
        <div className="po-alert">
          <span className="po-short">Short {short}</span>
          Lower the short cut to what's available, or reject the order. The shopper is emailed about any change.
        </div>
      )}

      <table className="po-items">
        <thead>
          <tr>
            <th>Cut</th>
            <th className="num">Pkgs</th>
            <th className="num">$/lb</th>
            <th className="num">Est. lb</th>
            <th className="num">Est.</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ item, index }) => {
            const itemShort = item.qty - item.allocated;
            return (
              <Fragment key={`${item.cutId}-${index}`}>
                <tr className={itemShort > 0 ? 'is-short' : ''}>
                  <td>{item.name}</td>
                  <td className="num">{item.qty}</td>
                  <td className="num">{money(item.pricePerLb)}</td>
                  <td className="num">{(item.qty * item.estLb).toFixed(1)}</td>
                  <td className="num">{money(item.qty * item.estLb * item.pricePerLb)}</td>
                </tr>
                {order.status === 'new' && itemShort > 0 && (
                  <tr className="po-fix-row">
                    <td colSpan={5}>
                      <LowerQuantityForm order={order} index={index} item={item} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {order.status === 'confirmed' && <WeightsForm key={order.id} order={order} />}

      {(order.status === 'packed' || order.status === 'delivered') && final !== null && (
        <div className="po-weights-readonly">
          <h3>Actual weights</h3>
          <ul>
            {lines.map(({ item, index }) => (
              <li key={index}>
                {item.name}: {item.weights.map((w) => `${w} lb`).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="po-total">
        {final !== null ? (
          <>
            <span>Final price</span>
            <strong>{money(final)}</strong>
          </>
        ) : (
          <>
            <span>Estimate</span>
            <strong>{money(store.estimateOf(order))}</strong>
          </>
        )}
      </div>
    </Modal>
  );
}

function LowerQuantityForm({ order, index, item }) {
  const [value, setValue] = useState(String(item.allocated));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const result = await store.lowerQuantity(
      order.id,
      index,
      value.trim() === '' ? NaN : Number(value)
    );
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form className="po-lower" onSubmit={submit} noValidate>
      <span>
        Only <strong>{item.allocated}</strong> of {item.qty} available. Lower to
      </span>
      <input
        type="number"
        className="po-input po-input--sm"
        min={0}
        max={item.qty - 1}
        step={1}
        value={value}
        aria-label={`New quantity for ${item.name}`}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
      />
      <button type="submit" className="po-btn po-btn--sm" disabled={busy}>
        {busy ? 'Saving…' : 'Update'}
      </button>
      {error && (
        <span className="po-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

function WeightsForm({ order }) {
  const [values, setValues] = useState(() =>
    order.items.map((item) =>
      Array.from({ length: item.qty }, (_, p) =>
        item.weights?.[p] != null ? String(item.weights[p]) : ''
      )
    )
  );
  const [invalid, setInvalid] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function change(k, p, v) {
    setValues((prev) => prev.map((row, i) => (i === k ? row.map((x, j) => (j === p ? v : x)) : row)));
    setSaved(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const result = await store.saveWeights(order.id, values);
    setBusy(false);
    if (!result.ok) {
      setInvalid(result.invalid ?? null);
      setError(
        result.invalid
          ? 'Each weight must be a number greater than 0. Nothing was saved.'
          : `${result.error} Nothing was saved.`
      );
      return;
    }
    setInvalid(null);
    setError('');
    setSaved(true);
  }

  return (
    <form className="po-weights" onSubmit={submit} noValidate>
      <h3>Package weights</h3>
      {order.items.map((item, k) =>
        item.qty === 0 ? null : (
          <fieldset key={`${item.cutId}-${k}`}>
            <legend>
              {item.name} <span className="po-muted">· {money(item.pricePerLb)}/lb</span>
            </legend>
            <div className="po-weight-grid">
              {values[k].map((v, p) => {
                const bad = invalid?.[k]?.[p];
                return (
                  <label key={p} className="po-weight">
                    <span>Package {p + 1}</span>
                    <span className="po-weight-input">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`po-input po-input--sm ${bad ? 'is-invalid' : ''}`}
                        aria-invalid={bad || undefined}
                        value={v}
                        onChange={(e) => change(k, p, e.target.value)}
                      />
                      lb
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )
      )}
      {error && (
        <p className="po-error" role="alert">
          {error}
        </p>
      )}
      <div className="po-weights-actions">
        {saved && <span className="po-saved">Saved · final price emailed</span>}
        <button type="submit" className="po-btn po-btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save & send final price'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Reject prompt                                                       */
/* ------------------------------------------------------------------ */

function RejectDialog({ order, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const result = await store.rejectOrder(order.id, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title={`Reject ${order.id}?`} onClose={onClose} size="sm">
      <form className="po-reject" onSubmit={submit} noValidate>
        <label htmlFor="po-reject-reason">
          Reason <span className="po-muted">(sent to {order.shopper})</span>
        </label>
        <textarea
          id="po-reject-reason"
          className={`po-input po-textarea ${error ? 'is-invalid' : ''}`}
          rows={4}
          value={reason}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />
        {error && (
          <p className="po-error" role="alert">
            {error}
          </p>
        )}
        <div className="po-modal-foot po-modal-foot--inline">
          <button type="button" className="po-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="po-btn po-btn--danger" disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}