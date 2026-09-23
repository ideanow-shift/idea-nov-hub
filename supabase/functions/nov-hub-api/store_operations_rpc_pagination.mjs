export const STORE_MONTHLY_ACTUAL_RANGE_RPC = "dbf_store_monthly_actual_range_read_v1";
export const STORE_MONTHLY_ACTUAL_RPC_PAGE_SIZE = 1000;
export const STORE_MONTHLY_ACTUAL_RPC_MAX_PAGES = 100;

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

export async function readAllStoreMonthlyActualRpcPages({
  rpcName,
  payload,
  requestPage,
  pageSize = STORE_MONTHLY_ACTUAL_RPC_PAGE_SIZE,
  maxPages = STORE_MONTHLY_ACTUAL_RPC_MAX_PAGES,
}) {
  if (rpcName !== STORE_MONTHLY_ACTUAL_RANGE_RPC) {
    throw new Error("STORE_MONTHLY_ACTUAL_RPC_NOT_ALLOWED");
  }
  if (typeof requestPage !== "function") {
    throw new Error("STORE_MONTHLY_ACTUAL_RPC_REQUEST_PAGE_INVALID");
  }
  const fixedPageSize = positiveInteger(pageSize, "STORE_MONTHLY_ACTUAL_RPC_PAGE_SIZE");
  const fixedMaxPages = positiveInteger(maxPages, "STORE_MONTHLY_ACTUAL_RPC_MAX_PAGES");
  const rows = [];

  for (let pageIndex = 0; pageIndex < fixedMaxPages; pageIndex += 1) {
    const offset = pageIndex * fixedPageSize;
    const page = await requestPage({
      rpcName: STORE_MONTHLY_ACTUAL_RANGE_RPC,
      payload,
      limit: fixedPageSize,
      offset,
    });
    if (!Array.isArray(page) || page.length > fixedPageSize) {
      throw new Error("STORE_MONTHLY_ACTUAL_RPC_PAGE_INVALID");
    }
    rows.push(...page);
    if (page.length < fixedPageSize) return rows;
  }

  throw new Error("STORE_MONTHLY_ACTUAL_RPC_PAGE_LIMIT_EXCEEDED");
}
