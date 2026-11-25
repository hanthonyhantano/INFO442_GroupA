// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartProvider, useCart } from "./CartContext";

const db = vi.hoisted(() => ({ rows: [], stock: [], updates: [], deletes: [], selects: [] }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "guest" } } } }) },
    from: (table) => {
      const query = {
        select: (columns) => { db.selects.push(columns); return query; },
        eq: () => query,
        in: (column, ids) => {
          if (table === "cut_stock") return Promise.resolve({ data: db.stock });
          db.deletes.push(ids);
          return query;
        },
        update: (values) => { db.updates.push(values); return query; },
        delete: () => query,
        maybeSingle: async () => ({ data: { id: 1 } }),
        order: async () => ({ data: db.rows }),
        then: (resolve) => Promise.resolve({ error: null }).then(resolve),
      };
      return query;
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

beforeEach(() => {
  db.rows = [];
  db.stock = [];
  db.updates = [];
  db.deletes = [];
  db.selects = [];
});
afterEach(cleanup);

function Cart() {
  const { items, loading, increase, notices } = useCart();
  if (loading) return <p>Loading</p>;
  return (
    <>
      <p>Ready</p>
      {items.map((item) => (
        <div key={item.id}>
          <p>{item.quantity} requested / {item.available} available</p>
          <p>{item.lbsPerPackage} lb/package</p>
          <button onClick={() => increase(item.id)}>Increase</button>
        </div>
      ))}
      {notices.map((notice) => <p key={notice.id}>{notice.text}</p>)}
    </>
  );
}

function row(held, isLive = true) {
  return {
    id: 11, quantity: 4,
    cut: {
      id: 22, name: "Chuck roast", price_per_pound: 10,
      pounds_per_package: 2, packages_on_hand: 5, held, is_live: isLive,
      farm: { id: 1, name: "Test farm" },
    },
  };
}

it("subtracts held stock, saves the lower quantity, and prevents increasing past it", async () => {
  db.rows = [row(0)];
  db.stock = [{id:22,on_hand:5,reserved:3}];
  render(<CartProvider><Cart /></CartProvider>);
  await screen.findByText("2 requested / 2 available");
  expect(db.selects.some((columns) => columns.includes("reserved"))).toBe(true);
  expect(db.updates).toEqual([{ quantity: 2 }]);
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(db.updates).toHaveLength(1);
});

it.each([[5, true], [6, true], [0, false]])(
  "removes unavailable cuts (held=%s, live=%s)", async (held, isLive) => {
    db.rows = [row(0, isLive)];
    db.stock = [{id:22,on_hand:5,reserved:held}];
    render(<CartProvider><Cart /></CartProvider>);
    await screen.findByText("Ready");
    expect(screen.queryByRole("button", { name: "Increase" })).toBeNull();
    expect(db.deletes).toEqual([[11]]);
    expect(screen.getByText(/sold out and was removed/)).toBeTruthy();
  },
);

it("uses order reservations even when the batch held counter is higher", async () => {
  db.rows = [row(5)];
  db.stock = [{id:22,on_hand:5,reserved:0}];
  render(<CartProvider><Cart /></CartProvider>);
  await screen.findByText("4 requested / 5 available");
  expect(db.updates).toEqual([]);
});

it("keeps selected sizes and reconciles both rows against shared reserved stock", async () => {
  db.rows = [
    { ...row(1), quantity: 2, pack_size_lb: 1.5 },
    { ...row(1), id: 12, quantity: 2, pack_size_lb: 3 },
  ];
  db.stock = [{ id: 22, on_hand: 5, reserved: 2 }];
  render(<CartProvider><Cart /></CartProvider>);
  await screen.findByText("2 requested / 2 available");
  expect(screen.getByText("1 requested / 1 available")).toBeTruthy();
  expect(screen.getByText("1.5 lb/package")).toBeTruthy();
  expect(screen.getByText("3 lb/package")).toBeTruthy();
  expect(db.updates).toEqual([{ quantity: 1 }]);
});

it("preserves cart rows when the stock view omits a live cut", async () => {
  db.rows = [row(0)];
  db.stock = [];
  render(<CartProvider><Cart /></CartProvider>);
  await screen.findByText("Ready");
  expect(db.deletes).toEqual([]);
  expect(db.updates).toEqual([]);
});
