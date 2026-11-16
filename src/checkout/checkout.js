export const estimate = (item) =>
  item.pricePerLb * item.lbsPerPackage * item.quantity;
export const money = (value) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.farm.id))
      groups.set(item.farm.id, { farm: item.farm, items: [], subtotal: 0 });
    const group = groups.get(item.farm.id);
    group.items.push(item);
    group.subtotal += estimate(item);
  }
  return [...groups.values()];
}
export function validateCheckout(contact, items) {
  const errors = {};
  if (!contact.name.trim()) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!items.length) errors.cart = "Your cart is empty.";
  if (
    items.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > item.available,
    )
  )
    errors.cart = "Availability changed. Review your cart before continuing.";
  return errors;
}
