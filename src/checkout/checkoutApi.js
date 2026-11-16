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
    if (error.code === "PGRST202")
      throw new Error(
        "Checkout setup is not installed yet. Please try again later.",
      );
    throw new Error(
      "Your order was not confirmed. Check your cart or retry the same request.",
    );
  }
  return data;
}
