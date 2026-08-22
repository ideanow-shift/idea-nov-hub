export const STORE_SALES_API_VERSION = "store-sales-v1";
export const STORE_SALES_STAGING_ENVIRONMENT = "staging";

export type StoreClass = "DIRECT" | "FC";
export type StoreRole = "representative" | "executive" | "sales_director" | "area_manager" | "store_manager" | "fc_owner" | "employee";
export type DataState = "confirmed" | "preparing" | "unavailable";

export interface HubActor {
  subject: string;
  roles: StoreRole[];
  ownStoreCode: string | null;
  fcOperatorCode: string | null;
}

export interface StoreMasterRow {
  canonicalStoreId: string;
  storeCode: string;
  displayName: string;
  storeClass: StoreClass;
  active: boolean;
  operatorCode: string | null;
}

export interface AccountingStoreProjection {
  canonicalStoreId: string;
  period: string;
  confirmedThroughPeriod: string | null;
  totalRevenue: number | null;
  operatingProfit: number | null;
  taxBasis: "exclusive";
  confirmed: boolean;
}

export interface SessionVerifier {
  verifyHubSession(token: string): Promise<HubActor | null>;
}

export interface StoreMasterAccessPort {
  listCurrentStores(): Promise<StoreMasterRow[]>;
  resolveLegacyStoreReference(reference: string): Promise<string | null>;
}

export interface AccountingReadOnlyAccessPort {
  readStoreProjection(input: { canonicalStoreIds: string[]; period: string }): Promise<AccountingStoreProjection[]>;
}

export interface StoreSalesDependencies {
  sessionVerifier: SessionVerifier;
  storeMaster: StoreMasterAccessPort;
  accounting: AccountingReadOnlyAccessPort;
}

export const CURRENT_STORE_BASELINE = Object.freeze([
  ["tokorozawa", "DIRECT"], ["takadanobaba", "DIRECT"], ["kamishakujii", "DIRECT"], ["hoya", "DIRECT"],
  ["shakujiikoen", "DIRECT"], ["higashiyamato", "DIRECT"], ["shimoigusa", "DIRECT"], ["ekoda", "DIRECT"],
  ["annex", "DIRECT"], ["nogata", "DIRECT"], ["ikebukuro", "DIRECT"], ["kyarahalf", "DIRECT"], ["tachikawa", "DIRECT"],
  ["shintokorozawa", "FC"], ["saginomiya", "FC"], ["roane", "FC"], ["kumegawa", "FC"], ["kokubunnji", "FC"],
  ["hanakoganei", "FC"], ["higashikurume", "FC"],
] as const satisfies readonly (readonly [string, StoreClass])[]);

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
