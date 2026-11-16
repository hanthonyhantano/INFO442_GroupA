import { useEffect, useState } from "react";
import { useCart } from "../cart/CartContext";
import CheckoutPage from "../checkout/CheckoutPage";
import { loadFulfillment, submitOrder } from "../checkout/checkoutApi";

export default function Checkout() {
  const { items, loading, error, refreshCart } = useCart();
  const [options, setOptions] = useState(null);
  const [failed, setFailed] = useState(false);
  const farmKey = [...new Set(items.map((item) => item.farm.id))]
    .sort()
    .join(",");
  useEffect(() => {
    let current = true;
    if (farmKey)
      loadFulfillment(farmKey.split(","))
        .then((data) => {
          if (current) setOptions({ key: farmKey, data });
        })
        .catch(() => {
          if (current) setFailed(true);
        });
    return () => {
      current = false;
    };
  }, [farmKey]);
  async function send(payload) {
    const receipt = await submitOrder(payload);
    refreshCart().catch(() => {});
    return receipt;
  }
  return (
    <CheckoutPage
      items={items}
      loading={
        loading || (!error && !failed && !!farmKey && options?.key !== farmKey)
      }
      error={error || failed}
      options={options?.data}
      submitOrder={send}
    />
  );
}
