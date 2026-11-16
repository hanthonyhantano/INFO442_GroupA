import { Link, useLocation } from "react-router-dom";
import { money } from "../checkout/checkout";
import "../checkout/checkout.css";

export default function RequestSent() {
  const { state } = useLocation();
  const receipt = state?.receipt;
  if (!receipt?.orders?.length)
    return (
      <section className="checkout-page">
        <h1>No order confirmation to display</h1>
        <p>Return to your cart to review your request.</p>
        <Link to="/cart">View cart</Link>
      </section>
    );
  return (
    <section className="checkout-page">
      <h1>Request sent</h1>
      <p>
        Each farm will confirm availability and final pricing separately. No
        payment was collected here.
      </p>
      {receipt.orders.map((order) => (
        <section className="checkout-summary" key={order.id}>
          <h2>{order.farmName}</h2>
          <p>Request number: {order.id}</p>
          <p>Estimated total: {money(order.estimatedTotal)}</p>
        </section>
      ))}
      <Link to="/shop">Continue shopping</Link>
    </section>
  );
}
