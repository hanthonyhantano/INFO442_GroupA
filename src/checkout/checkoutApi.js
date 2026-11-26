import { supabase } from "../lib/supabase";
export async function loadFulfillment(farmIds) {
  const { data, error } = await supabase
    .from("farms")
    .select(
      "id, pickup_enabled, delivery_enabled, delivery_minimum, pickup_locations(id,name,address,days,times), delivery_zones(zip_codes,fee)",
    )
    .in("id", farmIds);
  if (error) throw error;
  return data;
}
export async function submitOrder(payload) {
  const { data, error } = await supabase.rpc("submit_guest_checkout", {
    payload,
  });
  if (error) {
    // PostgreSQL errors roll back the whole RPC. A lost network response does
    // not tell us whether it committed, so keep that request for a safe retry.
    const code = error.code ?? "";
    const orderRejected =
      (/^[0-9A-Z]{5}$/.test(code) &&
        !code.startsWith("08") &&
        code !== "40003") ||
      code === "PGRST202";
    const validationMessages = [
      "Invalid contact information",
      "Invalid cart",
      "Invalid quantity",
      "Cart changed. Review your cart",
      "Stock changed. Review your cart",
      "Select a valid pickup location",
      "Delivery unavailable or minimum not met",
      "ZIP is outside delivery area",
      "Choose pickup or delivery for each farm",
    ];
    const message =
      error.code === "PGRST202"
        ? "Checkout setup is not installed yet. Please try again later."
        : error.code === "P0001" && validationMessages.includes(error.message)
          ? error.message
          : orderRejected
            ? "Your request was not saved. Review your details and try again."
            : "We could not confirm your order. Retry the same request.";
    throw Object.assign(new Error(message), {
      orderRejected,
      refreshCart:
        orderRejected &&
        ["Cart changed. Review your cart", "Stock changed. Review your cart"].includes(
          error.message,
        ),
    });
  }
  return data;
}
