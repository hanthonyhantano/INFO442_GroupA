// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CheckoutPage from "./CheckoutPage";
import RequestSent from "../pages/RequestSent";
import { groupItems, validateCheckout } from "./checkout";
afterEach(cleanup);
const items = [
  {
    id: 1,
    cutId: 2,
    name: "Chuck roast",
    quantity: 2,
    available: 3,
    pricePerLb: 10,
    lbsPerPackage: 2,
    farm: { id: 1, name: "Test farm" },
  },
];
function mount(submitOrder) {
  render(
    <MemoryRouter initialEntries={["/checkout"]}>
      <Routes>
        <Route
          path="/checkout"
          element={<CheckoutPage items={items} submitOrder={submitOrder} />}
        />
        <Route path="/request-sent" element={<RequestSent />} />
      </Routes>
    </MemoryRouter>,
  );
}
it("groups estimates and rejects invalid contact and stale quantities", () => {
  expect(groupItems(items)[0].subtotal).toBe(40);
  expect(validateCheckout({ name: "", email: "bad" }, items)).toHaveProperty(
    "email",
  );
  expect(
    validateCheckout({ name: "A", email: "a@example.com" }, [
      { ...items[0], quantity: 4 },
    ]),
  ).toHaveProperty("cart");
});
it("does not enable submission without a backend", () => {
  mount();
  expect(
    screen.getByRole("button", { name: "Send order request" }).disabled,
  ).toBe(true);
});
it("shows confirmation only after successful submission and retries the identical request", async () => {
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      orders: [{ id: "R1", farmName: "Test farm", estimatedTotal: 40 }],
    });
  mount(submit);
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test shopper" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "test@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Request sent")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  await screen.findByRole("heading", { name: "Request sent" });
  expect(submit.mock.calls[0][0]).toBe(submit.mock.calls[1][0]);
});
