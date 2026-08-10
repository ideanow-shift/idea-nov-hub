const POSITION_LABELS = new Set([
  "会長",
  "社長",
  "副社長",
  "取締役",
  "執行役員",
  "相談役",
]);

const ASSIGNMENT_LABELS = new Set([
  "部長",
  "課長",
  "係長",
  "エリアマネージャー",
  "店長",
  "副店長",
  "店長見習い",
  "FCオーナー",
  "FCオーナー見習い",
]);

export function classifyLegacyPositionLabel(label) {
  const value = String(label || "").trim();
  if (!value || value === "未設定") return "null_state";
  if (POSITION_LABELS.has(value)) return "corporate_position";
  if (ASSIGNMENT_LABELS.has(value)) return "organization_assignment";
  if (value === "一般スタッフ") return "staff_classification_review";
  return "human_review_required";
}

function activeAt(assignment, asOf) {
  if (!assignment || assignment.active === false) return false;
  const date = String(asOf || "").slice(0, 10);
  if (!date) return false;
  if (assignment.effectiveFrom && date < assignment.effectiveFrom) return false;
  if (assignment.effectiveTo && date >= assignment.effectiveTo) return false;
  return true;
}

function assignmentLabel(assignment) {
  const organization = String(assignment.organizationName || "").trim();
  const responsibility = String(assignment.assignmentName || "").trim();
  if (!responsibility) return "";
  if (!organization) return responsibility;
  if (responsibility.startsWith(organization)) return responsibility;
  let overlap = 0;
  const maxOverlap = Math.min(organization.length, responsibility.length);
  for (let size = 1; size <= maxOverlap; size += 1) {
    if (organization.endsWith(responsibility.slice(0, size))) overlap = size;
  }
  return `${organization}${responsibility.slice(overlap)}`;
}

export function buildCanonicalTitleProjection({
  positionName,
  assignments = [],
  legacyPositionName,
  asOf,
} = {}) {
  const position = String(positionName || "").trim();
  const activeAssignments = assignments
    .filter((assignment) => activeAt(assignment, asOf))
    .slice()
    .sort((a, b) => {
      const primary = Number(Boolean(b.primary)) - Number(Boolean(a.primary));
      if (primary) return primary;
      return Number(a.priority || 999) - Number(b.priority || 999);
    })
    .map(assignmentLabel)
    .filter(Boolean);

  const canonicalParts = [position, ...activeAssignments].filter(Boolean);
  if (canonicalParts.length) {
    return {
      source: "canonical",
      displayTitle: canonicalParts.join(" 兼 "),
      positionName: position || null,
      assignmentLabels: activeAssignments,
    };
  }

  const legacy = String(legacyPositionName || "").trim();
  return {
    source: legacy ? "legacy_fallback" : "empty",
    displayTitle: legacy,
    positionName: null,
    assignmentLabels: [],
  };
}
