import { describe, it, expect } from "vitest";
import { visibleCatalog, catalogCut, catalogFarm } from "./catalog";
describe("marketplace selection", () => {
  const farms = [
    { id: 1, delivery_zips: ["98105"] },
    { id: 2, pickup: true, lat: 47.6, lng: -122.3 },
    { id: 3, pickup: true, lat: 40, lng: -120 },
  ];
  const product = {
    farm_id: 1,
    status: "Live",
    in_stock: true,
    available_packages: 3,
    featured: true,
    batch_percent_sold: 20,
  };
  it("allows delivery and pickup within 100 miles, but excludes drafts and sold-out cuts", () => {
    const products = [
      { ...product, id: 1 },
      { ...product, id: 2, farm_id: 2 },
      { ...product, id: 3, farm_id: 3 },
      { ...product, id: 4, status: "Draft" },
      { ...product, id: 5, available_packages: 0 },
      { ...product, id: 6, in_stock: false },
    ];
    const result = visibleCatalog(
      { farms, products, center: [47.66, -122.29] },
      "98105",
    );
    expect(result.items.map((p) => p.id)).toEqual([1, 2]);
  });
  it("limits featured cuts to four, ranking slow batches first then available packages", () => {
    const products = [40, 30, 20, 10, 10, 5].map((sold, i) => ({
      ...product,
      id: i,
      batch_percent_sold: sold,
      available_packages: i + 1,
    }));
    expect(
      visibleCatalog({ farms, products }, "").featured.map((p) => p.id),
    ).toEqual([5, 4, 3, 2]);
  });
  it("does not infer pickup distance from an unknown ZIP", () => {
    expect(
      visibleCatalog({ farms, products: [product] }, "00000").items,
    ).toEqual([]);
  });
});

it("adapts actual cut fields and excludes held stock", () => {
  const cut = catalogCut({ id: 1, farm_id: 2, is_live: true, packages_on_hand: 5, held: 2,
    price_per_pound: 9, pounds_per_package: 1, cow_parts: { name: "Ground" } });
  expect(cut).toMatchObject({ available_packages: 3, price_per_lb: 9, cut_category: "Ground", status: "Live" });
  expect(catalogCut({ packages_on_hand: 1, held: 3 }).in_stock).toBe(false);
});
it("uses farm coordinates and only that farm's enabled delivery zones", () => {
  const zones = [{ farm_id: 1, zip_codes: ["98105"] }, { farm_id: 2, zip_codes: ["98101"] }];
  expect(catalogFarm({ id: 1, latitude: 47, longitude: -122, pickup_enabled: true, delivery_enabled: true }, zones))
    .toMatchObject({ lat: 47, lng: -122, pickup: true, delivery_zips: ["98105"] });
  expect(catalogFarm({ id: 1, delivery_enabled: false }, zones).delivery_zips).toEqual([]);
});
