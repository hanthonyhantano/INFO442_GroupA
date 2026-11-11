// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FarmBatches from "./FarmBatches";
 
const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, order };
});
 
vi.mock("../lib/supabase.js", () => ({
  supabase: { from: mocks.from },
}));

const batch1 = {
  id: 1,
  batch_code: "LF-0912",
  animal: "Steer #14",
  processor_name: "Lorem Processing Co.",
  processing_date: "2026-09-12",
  status: "available",
  cuts: [
    { id: 10, name: "Ribeye", photo: null },
    { id: 11, name: "Brisket", photo: null },
  ],
};
 
const batch2 = {
  id: 2,
  batch_code: "LF-1010",
  animal: "Steer #15",
  processor_name: "Lorem Processing Co.",
  processing_date: "2026-10-10",
  status: "processing",
  cuts: [],
};
 
function resolveWith(data, error = null) {
  mocks.order.mockResolvedValueOnce({ data, error });
}
 
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup(); // clear rendered output between tests
});
 
// TESTS
describe("FarmBatches", () => {
  it("shows a loading message first", () => {
    mocks.order.mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<FarmBatches farmId={1} />);
    expect(screen.getByText("Loading batches…")).toBeTruthy();
  });
 
  it("queries the batches table for the right farm, newest first", async () => {
    resolveWith([batch1]);
    render(<FarmBatches farmId={1} />);
 
    await screen.findByText("LF-0912 · Steer #14");
    expect(mocks.from).toHaveBeenCalledWith("batches");
    expect(mocks.select.mock.calls[0][0]).toContain("cuts");
    expect(mocks.eq).toHaveBeenCalledWith("farm_id", 1);
    expect(mocks.order).toHaveBeenCalledWith("processing_date", { ascending: false });
  });
 
  it("converts a string farmId (from useParams) to a number", async () => {
    resolveWith([batch1]);
    render(<FarmBatches farmId="1" />);
 
    await screen.findByText("LF-0912 · Steer #14");
    expect(mocks.eq).toHaveBeenCalledWith("farm_id", 1);
  });
 
  it("renders every batch with its code, animal, processor, date and status", async () => {
    resolveWith([batch1, batch2]);
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("Current batches")).toBeTruthy();
    expect(screen.getByText("LF-0912 · Steer #14")).toBeTruthy();
    expect(screen.getByText("LF-1010 · Steer #15")).toBeTruthy();
    expect(
      screen.getByText("Processed 2026-09-12 by Lorem Processing Co.")
    ).toBeTruthy();
 
    const status = screen.getByText("available");
    expect(status.classList.contains("farm-batch__status")).toBe(true);
    expect(status.classList.contains("farm-batch__status--available")).toBe(true);
    expect(
      screen.getByText("processing").classList.contains("farm-batch__status--processing")
    ).toBe(true);
  });
 
  it("lists the cuts that belong to a batch", async () => {
    resolveWith([batch1]);
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("Ribeye")).toBeTruthy();
    expect(screen.getByText("Brisket")).toBeTruthy();
  });
 
  it("does not render a cut list for a batch with no cuts", async () => {
    resolveWith([batch2]);
    const { container } = render(<FarmBatches farmId={1} />);
 
    await screen.findByText("LF-1010 · Steer #15");
    expect(container.querySelector(".farm-batch__cuts")).toBeNull();
  });
 
  it("shows TBD when a batch has no processing date", async () => {
    resolveWith([{ ...batch1, processing_date: null, processor_name: null }]);
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("Processed TBD")).toBeTruthy();
  });
 
  it("shows an empty message when the farm has no batches", async () => {
    resolveWith([]);
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("No batches right now.")).toBeTruthy();
  });
 
  it("treats a null response as no batches", async () => {
    resolveWith(null);
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("No batches right now.")).toBeTruthy();
  });
 
  it("shows an error message when Supabase returns an error", async () => {
    resolveWith(null, { message: "permission denied" });
    render(<FarmBatches farmId={1} />);
 
    expect(await screen.findByText("Couldn't load batches.")).toBeTruthy();
  });
 
  it("does not query Supabase when there is no farmId", () => {
    render(<FarmBatches />);
    expect(mocks.from).not.toHaveBeenCalled();
  });
 
  it("refetches when farmId changes", async () => {
    resolveWith([batch1]);
    const { rerender } = render(<FarmBatches farmId={1} />);
    await screen.findByText("LF-0912 · Steer #14");
 
    resolveWith([{ ...batch2, id: 3, batch_code: "OF-0001" }]);
    rerender(<FarmBatches farmId={2} />);
 
    expect(await screen.findByText("OF-0001 · Steer #15")).toBeTruthy();
    expect(mocks.eq).toHaveBeenLastCalledWith("farm_id", 2);
    await waitFor(() =>
      expect(screen.queryByText("LF-0912 · Steer #14")).toBeNull()
    );
  });
});