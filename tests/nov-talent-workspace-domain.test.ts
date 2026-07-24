import {
  buildTalentWorkspaceData,
  TALENT_WORKSPACE_DOMAIN_CONTRACT,
} from "../supabase/functions/nov-talent-readonly-api-v2/workspace-domain.ts";

Deno.test("workspace domain projects approved fields and fixed overview", () => {
  const data = buildTalentWorkspaceData({
    rows: [{
      staging_record_id: "00000000-0000-4000-8000-000000000001",
      source_sheet_code: "CONTACTS_27",
      source_payload: {
        lineRegistrationDate: "2026-07-01",
        payload: {
          column_001: { header: "氏名", value: "表示用氏名" },
          column_002: { header: "学校名", value: "表示用学校" },
          column_003: { header: "内部メモ", value: "返却してはいけない値" },
        },
      },
      classification: "OWNER_REVIEW",
      reason_codes: ["OWNER_REVIEW_REQUIRED"],
      business_date: "2026-07-01",
      mapping: { mapping_status: "UNMAPPED" },
    }],
  }, "2027");

  if (!data) throw new Error("workspace projection failed");
  if (data.overview.total !== 1 || data.overview.ownerReview !== 1) {
    throw new Error("overview mismatch");
  }
  const row = data.students[0];
  if (row.displayName !== "表示用氏名" || row.school !== "表示用学校") {
    throw new Error("approved projection missing");
  }
  if (JSON.stringify(row).includes("返却してはいけない値")) {
    throw new Error("unapproved source field exposed");
  }
  if (TALENT_WORKSPACE_DOMAIN_CONTRACT.exposesRawPayload !== false) {
    throw new Error("raw payload contract drifted");
  }
});

Deno.test("workspace domain rejects malformed or oversized inputs", () => {
  if (buildTalentWorkspaceData({ rows: [{}] }, "2027") !== null) {
    throw new Error("malformed row accepted");
  }
  if (buildTalentWorkspaceData({ rows: Array.from({ length: 1001 }, () => ({})) }, "2027") !== null) {
    throw new Error("oversized input accepted");
  }
});
