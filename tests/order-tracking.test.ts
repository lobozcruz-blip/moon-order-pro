// Run with Node 22.6+: node --experimental-strip-types --test tests/order-tracking.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { matchesProductSegment, productSegmentKey, productionStatus, withProductionStatus, productionProgress, confirmedReceivable, normalizeOrderLabel, orderLabels, ORDER_LABEL_TITLE } from "../src/lib/order-tracking.ts";

test("product segments match identity and distinguish pending pieces", () => {
  const item = { product_id: "calendar", product_name: "Calendario", quantity: 5, done_quantity: 3, is_done: false };
  const key = productSegmentKey(item);
  assert.equal(matchesProductSegment([item], key), true);
  assert.equal(matchesProductSegment([item], key, true), true);
  assert.equal(matchesProductSegment([{ ...item, done_quantity: 5 }], key, true), false);
  assert.equal(matchesProductSegment([{ ...item, is_done: true }], key, true), false);
  assert.equal(matchesProductSegment([{ ...item, product_id: "different" }], key), false);
  assert.equal(matchesProductSegment([], "__all__", true), true);
  assert.equal(matchesProductSegment([{ ...item, is_done: true }, item], key, true), true);
  assert.equal(productSegmentKey({ product_id: null, product_name: "  Caja   Especial " }), "custom:caja especial");
  assert.equal(matchesProductSegment([{ ...item, product_id: null, product_name: "Caja" }], "custom:caja"), true);
});

test("active stages follow real completed pieces and never finalize automatically", () => {
  const items = [{ quantity: 43, done_quantity: 38, is_done: false }];
  assert.equal(productionStatus("en_espera", items), "en_preparacion");
  assert.equal(productionStatus("en_espera", [{ ...items[0]!, done_quantity: 43 }]), "enviado");
  assert.equal(productionStatus("enviado", items), "en_preparacion");
  assert.equal(productionStatus("en_preparacion", []), "en_espera");
  assert.equal(productionStatus("enviado", [{ quantity: 2, done_quantity: 0, is_done: false }]), "en_espera");
  assert.equal(productionStatus("en_espera", [{ quantity: 2, done_quantity: 0, is_done: true }]), "enviado");
  for (const status of ["finalizado", "pausado", "cancelado"] as const) {
    assert.equal(productionStatus(status, items), status);
    assert.equal(productionStatus(status, []), status);
  }
  const original = { id: "existing-order", status: "en_espera" as const, order_items: items };
  assert.equal(withProductionStatus(original).status, "en_preparacion");
  assert.equal(original.status, "en_espera");
});

test("rounding cannot show 100 percent with unfinished pieces", () => {
  const items = [{ quantity: 200, done_quantity: 199, is_done: false }];
  assert.equal(productionProgress(items).percent, 99);
  assert.equal(productionStatus("en_espera", items), "en_preparacion");
});

test("production uses pieces and clamps invalid progress", () => {
  const item = (quantity: number, done_quantity = 0, is_done = false) => ({ quantity, done_quantity, is_done });
  assert.deepEqual(productionProgress([item(38, 0, true), item(5)]), { total: 43, done: 38, percent: 88 });
  assert.equal(productionProgress([]).percent, 0);
  assert.equal(productionProgress([item(5, 12)]).percent, 100);
  assert.equal(productionProgress([item(5, -2)]).percent, 0);
  assert.equal(productionProgress([item(5, 2)]).percent, 40);
});

test("receivables exclude quotations, canceled orders, drafts and unapproved orders", () => {
  const order = { total: 100, paid_amount: 30, balance: 70, status: "en_preparacion" };
  assert.equal(confirmedReceivable(order), 70);
  assert.equal(confirmedReceivable({ ...order, paid_amount: 0 }), 0);
  assert.equal(confirmedReceivable({ ...order, paid_amount: 100, balance: 0 }), 0);
  assert.equal(confirmedReceivable({ ...order, balance: -10 }), 0);
  assert.equal(confirmedReceivable({ ...order, status: "cancelado" }), 0);
  assert.equal(confirmedReceivable({ ...order, is_draft: true }), 0);
  assert.equal(confirmedReceivable({ ...order, review_status: "pendiente" }), 0);
  assert.equal(confirmedReceivable({ ...order, balance: null }), 70);
  assert.equal(confirmedReceivable({ ...order, status: "finalizado" }), 70);
});

test("labels group regardless of case and whitespace and exclude ordinary notes", () => {
  assert.equal(normalizeOrderLabel("  Falta   Calendario "), normalizeOrderLabel("falta calendario"));
  assert.deepEqual(orderLabels([
    { id: "1", title: ORDER_LABEL_TITLE, body: "Falta caja" },
    { id: "2", title: "Nota", body: "Información" },
    { id: "3", title: ORDER_LABEL_TITLE, body: " " },
  ]).map(n => n.id), ["1"]);
});
