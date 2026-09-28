export const IDS = Object.freeze({
  corpA: "10000000-0000-4000-8000-000000000001",
  corpB: "10000000-0000-4000-8000-000000000002",
  storeA: "20000000-0000-4000-8000-000000000001",
  storeB: "20000000-0000-4000-8000-000000000002",
  storeOther: "20000000-0000-4000-8000-000000000003",
  active: "30000000-0000-4000-8000-000000000001",
  inactive: "30000000-0000-4000-8000-000000000002",
  retired: "30000000-0000-4000-8000-000000000003",
  disabled: "30000000-0000-4000-8000-000000000004",
  storeManager: "30000000-0000-4000-8000-000000000005",
  areaManager: "30000000-0000-4000-8000-000000000006",
  fcOwner: "30000000-0000-4000-8000-000000000007",
  multiStore: "30000000-0000-4000-8000-000000000008",
  noRole: "30000000-0000-4000-8000-000000000009",
  executive: "30000000-0000-4000-8000-000000000010",
  platformAdmin: "30000000-0000-4000-8000-000000000011",
  finance: "30000000-0000-4000-8000-000000000012",
  hr: "30000000-0000-4000-8000-000000000013",
  duplicateA: "30000000-0000-4000-8000-000000000014",
  duplicateB: "30000000-0000-4000-8000-000000000015",
  terminal: "40000000-0000-4000-8000-000000000001",
  service: "50000000-0000-4000-8000-000000000001"
});

const employee = (id, uid, roles, stores = [IDS.storeA], overrides = {}) => ({
  id,
  firebaseUid: uid,
  displayName: `Synthetic ${id.slice(-2)}`,
  active: true,
  retired: false,
  loginEnabled: true,
  roles,
  scopes: stores.map((storeId) => ({ type: "assigned_store", storeId })),
  assignments: stores.map((storeId) => ({ storeId, active: true })),
  corporationId: IDS.corpA,
  ...overrides
});

export function createSyntheticFixture() {
  const employees = [
    employee(IDS.active, "uid-active.test", ["employee"]),
    employee(IDS.inactive, "uid-inactive.test", ["employee"], [IDS.storeA], { active: false }),
    employee(IDS.retired, "uid-retired.test", ["employee"], [IDS.storeA], { retired: true }),
    employee(IDS.disabled, "uid-disabled.test", ["employee"], [IDS.storeA], { loginEnabled: false }),
    employee(IDS.storeManager, "uid-store-manager.test", ["store_manager"]),
    employee(IDS.areaManager, "uid-area-manager.test", ["area_manager"], [IDS.storeA, IDS.storeB]),
    employee(IDS.fcOwner, "uid-fc-owner.test", ["fc_owner"]),
    employee(IDS.multiStore, "uid-multi-store.test", ["employee"], [IDS.storeA, IDS.storeB]),
    employee(IDS.noRole, "uid-no-role.test", []),
    employee(IDS.executive, "uid-executive.test", ["executive"], [], { scopes: [{ type: "all" }] }),
    employee(IDS.platformAdmin, "uid-platform-admin.test", ["platform_admin"], [], { scopes: [{ type: "all" }] }),
    employee(IDS.finance, "uid-finance.test", ["finance_operator"]),
    employee(IDS.hr, "uid-hr.test", ["hr_operator"]),
    employee(IDS.duplicateA, "uid-duplicate.test", ["employee"]),
    employee(IDS.duplicateB, "uid-duplicate.test", ["employee"])
  ];

  return {
    employees,
    terminals: [{
      id: IDS.terminal,
      active: true,
      appIds: ["sandbox-store-app"],
      corporationId: IDS.corpA,
      storeIds: [IDS.storeA],
      roles: ["terminal"],
      scopes: [{ type: "assigned_store", storeId: IDS.storeA }]
    }],
    services: [{
      id: IDS.service,
      active: true,
      appIds: ["sandbox-notification"],
      roles: ["system_service"],
      scopes: [{ type: "system_internal" }]
    }],
    stores: [
      { id: IDS.storeA, corporationId: IDS.corpA, name: "Synthetic Store A", kind: "direct" },
      { id: IDS.storeB, corporationId: IDS.corpA, name: "Synthetic Store B", kind: "fc" },
      { id: IDS.storeOther, corporationId: IDS.corpB, name: "Synthetic Store Other", kind: "fc" }
    ],
    corporations: [
      { id: IDS.corpA, name: "Synthetic Corporation A" },
      { id: IDS.corpB, name: "Synthetic Corporation B" }
    ],
    permissions: {
      "sandbox-store-app": ["view", "update", "close"],
      "sandbox-notification": ["system_execute"]
    },
    resources: {
      openStoreA: { id: "60000000-0000-4000-8000-000000000001", type: "store_record", storeId: IDS.storeA, corporationId: IDS.corpA, ownerEmployeeId: IDS.active, state: "open" },
      closedStoreA: { id: "60000000-0000-4000-8000-000000000002", type: "store_record", storeId: IDS.storeA, corporationId: IDS.corpA, state: "closed" },
      openStoreOther: { id: "60000000-0000-4000-8000-000000000003", type: "store_record", storeId: IDS.storeOther, corporationId: IDS.corpB, state: "open" },
      personalActive: { id: IDS.active, type: "employee_private", ownerEmployeeId: IDS.active, storeId: IDS.storeA, corporationId: IDS.corpA, state: "open" }
    }
  };
}
