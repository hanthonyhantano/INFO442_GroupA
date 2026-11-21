/*
 * Data layer for the producer Orders page — Supabase version.
 *
 * Needs orders_setup.sql to have been run once.
 * Reads:   orders (+ order_items, + cuts.name) and the cut_stock view
 * Writes:  only through the database functions (place_order, advance_order,
 *          reject_order, lower_item_quantity, save_order_weights), so an order
 *          and its stock counts always change together.
 * Live:    a realtime channel refetches when orders, items or cuts change.
 *
 * In the page, order.id is the order number ("CC-1041"); order.dbId is the row id.
 */

import { supabase } from "./supabase";

export const FARM_ID = 1; // ⚠ the farm whose orders this page shows
export const STATUSES = ['new', 'confirmed', 'packed', 'delivered'];
export const LOW_STOCK_THRESHOLD = 5;

const ORDER_SELECT = `
  id, order_number, shopper_name, shopper_email, status,
  delivery_date, delivered_at, created_at,
  items:order_items (
    id, cut_id, quantity, reserved_quantity,
    price_per_pound, pounds_per_package, actual_weights,
    cut:cuts ( name )
  )
`;

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

let state = { status: 'idle', orders: [], cuts: [], emails: [] }; // status: idle | loading | ready | error
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState() {
  return state;
}

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

const findOrder = (id) => state.orders.find((o) => o.id === id);

/* ------------------------------------------------------------------ */
/* Row → page shape                                                    */
/* ------------------------------------------------------------------ */

// delivery_date is a plain date ("2026-11-19"); read it as local midnight, not UTC.
function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function toOrder(row) {
  return {
    id: row.order_number,
    dbId: row.id,
    shopper: row.shopper_name,
    email: row.shopper_email,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    deliveryDate: parseDate(row.delivery_date),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
    items: [...(row.items || [])]
      .sort((a, b) => a.id - b.id)
      .map((i) => ({
        dbId: i.id,
        cutId: i.cut_id,
        name: i.cut?.name ?? `Cut ${i.cut_id}`,
        pricePerLb: Number(i.price_per_pound),
        estLb: Number(i.pounds_per_package),
        qty: i.quantity,
        allocated: i.reserved_quantity,
        weights: i.actual_weights ? i.actual_weights.map(Number) : null,
      })),
  };
}

function toCut(row) {
  const noData = row.on_hand === null || row.on_hand === undefined;
  return {
    id: row.id,
    name: row.name,
    available: noData ? null : row.on_hand - row.reserved,
    reserved: noData ? null : row.reserved,
  };
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export const shortageOf = (order) =>
  order.items.reduce((n, item) => n + Math.max(0, item.qty - item.allocated), 0);

export const packageCount = (order) => order.items.reduce((n, item) => n + item.qty, 0);

export const estimateOf = (order) =>
  order.items.reduce((sum, item) => sum + item.qty * item.estLb * item.pricePerLb, 0);

export const hasWeights = (order) =>
  order.items.every(
    (item) => item.qty === 0 || (Array.isArray(item.weights) && item.weights.length === item.qty)
  );

/** Final price = Σ over every package of price per lb × that package's actual weight. */
export function finalPriceOf(order) {
  if (!hasWeights(order)) return null;
  return order.items.reduce(
    (sum, item) => sum + (item.weights || []).reduce((s, w) => s + w * item.pricePerLb, 0),
    0
  );
}

/** Returns the weight as a number, or null if it's empty, not a number, or not > 0. */
export function parseWeight(raw) {
  const text = String(raw ?? '').trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const money = (n) => `$${n.toFixed(2)}`;

/* ------------------------------------------------------------------ */
/* Email (stub)                                                        */
/* ------------------------------------------------------------------ */

// Replace with a call to your email service / a Supabase Edge Function.
function sendEmail(to, subject, body) {
  const email = { to, subject, body, sentAt: Date.now() };
  console.info('[email]', email);
  setState({ emails: [...state.emails, email] });
}

/* ------------------------------------------------------------------ */
/* Loading + realtime                                                  */
/* ------------------------------------------------------------------ */

async function fetchAll() {
  const [ordersRes, cutsRes] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('farm_id', FARM_ID)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false }),
    supabase
      .from('cut_stock')
      .select('id, name, on_hand, reserved')
      .eq('farm_id', FARM_ID)
      .order('id'),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (cutsRes.error) throw cutsRes.error;
  return { orders: ordersRes.data.map(toOrder), cuts: cutsRes.data.map(toCut) };
}

export async function loadData({ simulateError = false } = {}) {
  setState({ status: 'loading' });
  try {
    if (simulateError) throw new Error('Simulated load failure');
    setState({ status: 'ready', ...(await fetchAll()) });
    startRealtime();
  } catch (err) {
    console.error(err);
    setState({ status: 'error' });
  }
}

// Quiet refetch (no loading state) after a change.
async function refresh() {
  try {
    setState({ ...(await fetchAll()) });
  } catch (err) {
    console.error(err);
  }
}

let channel = null;
let refreshTimer = null;

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 150); // one refetch for a burst of row changes
}

function startRealtime() {
  if (channel) return;
  channel = supabase
    .channel('producer-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuts' }, scheduleRefresh)
    .subscribe();
}

export function stopRealtime() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: error.message };
  await refresh();
  return { ok: true, data };
}

/* ------------------------------------------------------------------ */
/* Actions (all async; each resolves to { ok, error? })                */
/* ------------------------------------------------------------------ */

/**
 * Shopper checkout — call this from the Cart page.
 * items: [{ cutId, qty }]. pricePerLb / lbPerPackage are optional;
 * if left out, the database copies them from the cut.
 */
export function checkout({ shopper, email, items, fulfillmentMethod = 'pickup' }) {
  return rpc('place_order', {
    p_farm_id: FARM_ID,
    p_shopper_name: shopper,
    p_shopper_email: email,
    p_fulfillment_method: fulfillmentMethod,
    p_items: items.map((i) => ({
      cut_id: i.cutId,
      quantity: i.qty,
      price_per_pound: i.pricePerLb,
      pounds_per_package: i.lbPerPackage,
    })),
  });
}

/** Moves an order exactly one column to the right. */
export async function moveOrder(id, toStatus) {
  const order = findOrder(id);
  if (!order) return { ok: false, error: 'Order not found.' };

  // Quick checks for instant feedback; the database enforces the same rules.
  if (STATUSES.indexOf(toStatus) !== STATUSES.indexOf(order.status) + 1) {
    return { ok: false, error: 'Orders can only move to the next column.' };
  }
  if (order.status === 'new' && shortageOf(order) > 0) {
    return { ok: false, error: `Fix the shortage on ${order.id} before confirming it.` };
  }

  return rpc('advance_order', { p_order_id: order.dbId, p_to: toStatus });
}

export const confirmOrder = (id) => moveOrder(id, 'confirmed');

export async function rejectOrder(id, reason) {
  const order = findOrder(id);
  const text = String(reason ?? '').trim();
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!text) return { ok: false, error: 'Enter a reason so the shopper knows why.' };

  const result = await rpc('reject_order', { p_order_id: order.dbId, p_reason: text });
  if (result.ok) {
    sendEmail(
      order.email,
      `Your order ${order.id} was declined`,
      `Hi ${order.shopper},\n\nWe're sorry, but we can't fill order ${order.id}.\n\nReason: ${text}`
    );
  }
  return result;
}

/** Lowers the package count on one line of an order (used to resolve shortages). */
export async function lowerQuantity(orderId, itemIndex, newQty) {
  const order = findOrder(orderId);
  const item = order?.items[itemIndex];
  if (!item) return { ok: false, error: 'Item not found.' };
  if (!Number.isInteger(newQty) || newQty < 0 || newQty >= item.qty) {
    return { ok: false, error: `Enter a whole number from 0 to ${item.qty - 1}.` };
  }

  const result = await rpc('lower_item_quantity', { p_item_id: item.dbId, p_quantity: newQty });
  if (result.ok) {
    const updated = findOrder(orderId);
    sendEmail(
      order.email,
      `A change to your order ${order.id}`,
      `Hi ${order.shopper},\n\nWe don't have enough ${item.name} for your order, so we've changed it ` +
        `from ${item.qty} to ${newQty} package${newQty === 1 ? '' : 's'}.` +
        (updated ? `\n\nYour new estimated total is ${money(estimateOf(updated))}.` : '')
    );
  }
  return result;
}

/**
 * Saves actual package weights. rawValues[itemIndex][packageIndex] is the text typed in.
 * Nothing is saved if any weight is invalid; `invalid` mirrors rawValues with true for bad fields.
 */
export async function saveWeights(orderId, rawValues) {
  const order = findOrder(orderId);
  if (!order) return { ok: false, error: 'Order not found.' };

  const parsed = order.items.map((item, k) =>
    Array.from({ length: item.qty }, (_, p) => parseWeight(rawValues?.[k]?.[p]))
  );
  const invalid = parsed.map((row) => row.map((w) => w === null));
  if (invalid.some((row) => row.some(Boolean))) return { ok: false, invalid };

  const result = await rpc('save_order_weights', {
    p_order_id: order.dbId,
    p_weights: order.items.map((item, k) => ({ item_id: item.dbId, weights: parsed[k] })),
  });
  if (!result.ok) return result;

  const weighed = {
    ...order,
    items: order.items.map((item, k) => ({ ...item, weights: parsed[k] })),
  };
  const final = finalPriceOf(weighed);
  const breakdown = weighed.items
    .map((i) => `${i.name}: ${i.weights.map((w) => `${w} lb`).join(', ')} @ ${money(i.pricePerLb)}/lb`)
    .join('\n');
  sendEmail(
    order.email,
    `Final price for order ${order.id}: ${money(final)}`,
    `Hi ${order.shopper},\n\nYour order has been weighed.\n\n${breakdown}\n\nFinal price: ${money(final)}`
  );
  return { ok: true, finalPrice: final };
}