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
function mount(submitOrder, props = {}) {
  return render(
    <MemoryRouter initialEntries={["/checkout"]}>
      <Routes>
        <Route
          path="/checkout"
          element={<CheckoutPage items={items} submitOrder={submitOrder} {...props} />}
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
  expect(screen.getByLabelText("Full name").disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("avoid duplicate orders");
  fireEvent.click(screen.getByRole("button", { name: "Retry order request" }));
  await screen.findByRole("heading", { name: "Request sent" });
  expect(submit.mock.calls[0][0]).toBe(submit.mock.calls[1][0]);
});

const options = [{
  id: 1,
  pickup_enabled: true,
  delivery_enabled: true,
  delivery_minimum: 0,
  pickup_locations: [{ id: 3, name: "Farm gate", address: "123 Farm Road" }],
  delivery_zones: [{ zip_codes: ["98105", "98115"], fee: 5 }],
}];

function fillContact() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test shopper" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "test@example.com" },
  });
}

it("unlocks a rejected delivery request and submits corrected details with a new ID", async () => {
  const submit = vi.fn()
    .mockRejectedValueOnce(Object.assign(new Error("ZIP is outside delivery area"), {
      orderRejected: true,
    }))
    .mockResolvedValueOnce({
      orders: [{ id: "R1", farmName: "Test farm", estimatedTotal: 45 }],
    });
  mount(submit, { options });
  fillContact();
  fireEvent.change(screen.getByLabelText("Fulfillment method"), {
    target: { value: "delivery" },
  });
  fireEvent.change(screen.getByLabelText("Delivery address"), {
    target: { value: "123 Test Street" },
  });
  fireEvent.change(screen.getByLabelText("ZIP code"), {
    target: { value: "98105" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  expect((await screen.findByRole("alert")).textContent).toContain("ZIP is outside");
  expect(screen.getByLabelText("ZIP code").disabled).toBe(false);
  expect(screen.getByRole("group").disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("ZIP code"), {
    target: { value: "98115" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  await screen.findByRole("heading", { name: "Request sent" });
  expect(submit.mock.calls[1][0].contact.zip).toBe("98115");
  expect(submit.mock.calls[1][0].requestId).not.toBe(submit.mock.calls[0][0].requestId);
});

it("allows a rejected pickup choice to be corrected", async () => {
  const submit = vi.fn().mockRejectedValue(Object.assign(
    new Error("Select a valid pickup location"), { orderRejected: true },
  ));
  mount(submit, { options });
  fillContact();
  fireEvent.change(screen.getByLabelText("Fulfillment method"), {
    target: { value: "pickup" },
  });
  fireEvent.change(screen.getByLabelText("Pickup location"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("group").disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Fulfillment method"), {
    target: { value: "delivery" },
  });
  expect(screen.getByLabelText("ZIP code").disabled).toBe(false);
});

it("recovers the same request even if realtime clears the cart after a lost response", async () => {
  const submit = vi.fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({
      orders: [{ id: "R1", farmName: "Test farm", estimatedTotal: 40 }],
    });
  const view = (cartItems) => (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CheckoutPage items={cartItems} submitOrder={submit} />} />
        <Route path="/request-sent" element={<RequestSent />} />
      </Routes>
    </MemoryRouter>
  );
  const { rerender } = render(view(items));
  fillContact();
  fireEvent.click(screen.getByRole("button", { name: "Send order request" }));
  await screen.findByRole("alert");
  rerender(view([]));
  fireEvent.click(screen.getByRole("button", { name: "Retry order request" }));
  await screen.findByRole("heading", { name: "Request sent" });
  expect(submit.mock.calls[1][0]).toBe(submit.mock.calls[0][0]);
});
