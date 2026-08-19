const STATUS_ORDER = Object.freeze({ "Needs Attention": 0, Preparing: 1, Improving: 2, Stable: 3, Good: 4 });

function comparator(sort) {
  const value = (store, key) => store.metrics[key]?.rawValue ?? store.metrics[key]?.value ?? -Infinity;
  if (sort === "sales-desc") return (a, b) => value(b, "sales") - value(a, "sales");
  if (sort === "profit-desc") return (a, b) => value(b, "operatingProfit") - value(a, "operatingProfit");
  if (sort === "repeat-desc") return (a, b) => value(b, "totalRepeat") - value(a, "totalRepeat");
  if (sort === "productivity-desc") return (a, b) => value(b, "productivity") - value(a, "productivity");
  return (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
}

export function createStoreViewSelector() {
  let previous = null;
  return (stores, scope, statusFilter, sort) => {
    if (previous?.stores === stores && previous.scope === scope && previous.statusFilter === statusFilter && previous.sort === sort) return previous.result;
    const result = Object.freeze(stores
      .filter((store) => ["All", "Assigned", "Self"].includes(scope) || store.ownership === scope)
      .filter((store) => statusFilter === "All" || store.status === statusFilter)
      .toSorted(comparator(sort)));
    previous = { stores, scope, statusFilter, sort, result };
    return result;
  };
}
