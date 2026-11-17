// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExploreCuts from "../pages/ExploreCuts";

const catalog = vi.hoisted(() => ({ current: {} }));
vi.mock("./useCatalog", () => ({ useCatalog: () => catalog.current }));
afterEach(cleanup);

function show(route = "/explore") {
  render(
    <MemoryRouter initialEntries={[route]}>
      <ExploreCuts />
    </MemoryRouter>,
  );
}

describe("inventory-independent cut guide", () => {
  it("keeps selection working while inventory fails", () => {
    catalog.current = { error: true, retry: vi.fn() };
    show();
    fireEvent.click(screen.getByRole("button", { name: "Tail", exact: true }));
    expect(screen.getByRole("heading", { name: "Tail" })).toBeTruthy();
    expect(screen.getByText(/Oxtail is rich/)).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("preserves the homepage selection and handles empty inventory", () => {
    catalog.current = { data: { items: [] } };
    show("/explore?part=Plate");
    expect(screen.getByRole("heading", { name: "Plate", exact: true })).toBeTruthy();
    expect(screen.getByText(/Nothing from the plate/)).toBeTruthy();
  });
  it("defaults safely for an unknown region while inventory loads", () => {
    catalog.current = {};
    show("/explore?part=unknown");
    expect(screen.getByRole("heading", { name: "Chuck", exact: true })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "In stock now" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rib", exact: true }));
    expect(screen.getByRole("heading", { name: "Rib", exact: true })).toBeTruthy();
  });
});
