import { afterEach, expect, it, vi } from "vitest";
import { supabase } from "../lib/supabase";
import { submitOrder } from "./checkoutApi";

vi.mock("../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

it.each([
  ["Select a valid pickup location", false],
  ["ZIP is outside delivery area", false],
  ["Stock changed. Review your cart", true],
  ["Cart changed. Review your cart", true],
])("marks a rejected transaction editable: %s", async (message, refreshCart) => {
  supabase.rpc.mockResolvedValue({ error: { code: "P0001", message } });
  await expect(submitOrder({})).rejects.toMatchObject({
    message, orderRejected: true, refreshCart,
  });
});

it("allows retry after a missing migration without leaking database details", async () => {
  supabase.rpc.mockResolvedValue({ error: { code: "PGRST202", message: "internal" } });
  await expect(submitOrder({})).rejects.toMatchObject({
    orderRejected: true,
    message: "Checkout setup is not installed yet. Please try again later.",
  });
});

it.each(["", "08007", "40003"])("keeps an uncertain result eligible for an identical retry: %s", async (code) => {
  supabase.rpc.mockResolvedValue({ error: { code, message: "Uncertain outcome" } });
  await expect(submitOrder({})).rejects.toMatchObject({ orderRejected: false });
});

it("returns the server receipt and forwards the original request", async () => {
  const payload = { requestId: "test-request" };
  const receipt = { orders: [{ id: 1 }] };
  supabase.rpc.mockResolvedValue({ data: receipt });
  await expect(submitOrder(payload)).resolves.toBe(receipt);
  expect(supabase.rpc).toHaveBeenCalledWith("submit_guest_checkout", { payload });
});
