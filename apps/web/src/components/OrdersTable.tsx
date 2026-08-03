import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@dashboard/shared";
import { formatDate } from "../format";

type SortKey = "date" | "customer" | "category" | "amount" | "status";
type SortDir = "asc" | "desc";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

function toCsv(rows: Order[]): string {
  const header = ["Order ID", "Date", "Customer", "Category", "Amount", "Status"];
  const escape = (field: string) => (/[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field);
  const lines = rows.map((o) =>
    [o.id, o.date, o.customer, o.category, o.amount.toFixed(2), o.status].map((f) => escape(String(f))).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(rows: Order[], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersTable({
  orders,
  categoryFilter,
  onClearCategory,
  rangeLabel,
}: {
  orders: Order[];
  categoryFilter: string | null;
  onClearCategory: () => void;
  rangeLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (categoryFilter && o.category !== categoryFilter) return false;
      if (!q) return true;
      return o.customer.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, categoryFilter, search]);

  const sorted = useMemo(() => {
    const withDir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "amount") return (a.amount - b.amount) * withDir;
      return a[sortKey].localeCompare(b[sortKey]) * withDir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "customer" || key === "category" || key === "status" ? "asc" : "desc");
    }
  }

  return (
    <div className="chart-card orders-card">
      <div className="chart-card-header">
        <h2>Recent orders</h2>
        <div className="orders-toolbar">
          <input
            type="search"
            placeholder="Search customer or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="orders-search"
            aria-label="Search orders"
          />
          <button
            className="export-button"
            onClick={() => downloadCsv(sorted, `orders-${rangeLabel}${categoryFilter ? `-${categoryFilter.toLowerCase()}` : ""}.csv`)}
            disabled={sorted.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      {categoryFilter && (
        <div className="filter-chip">
          Filtering by <strong>{categoryFilter}</strong>
          <button onClick={onClearCategory} aria-label="Clear category filter">
            ×
          </button>
        </div>
      )}

      <div className="orders-table-wrap">
        <table className="data-table orders-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={col.key === "amount" ? "" : "col-left"}>
                  <button className="sort-button" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key && <span className="sort-arrow">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id}>
                <td className="col-left">{formatDate(o.date)}</td>
                <td className="col-left">{o.customer}</td>
                <td className="col-left">{o.category}</td>
                <td>{currency.format(o.amount)}</td>
                <td className="col-left">
                  <span className={`status-badge status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="status-line">No orders match your filters.</p>}
      </div>
      <p className="orders-count">
        {sorted.length} of {orders.length} orders
      </p>
    </div>
  );
}
