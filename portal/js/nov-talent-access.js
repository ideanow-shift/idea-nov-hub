const ROLE_KEYS = Object.freeze({
  SUPER_ADMIN: "super_admin",
  EXECUTIVE: "executive",
  BACKOFFICE: "backoffice",
  HR_ADMIN: "hr.admin",
  HR_STAFF: "hr.staff"
});

function normalizeRoleKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function getFormalRoleKeys(subject = {}) {
  return [...new Set([
    ...(Array.isArray(subject.roleKeys) ? subject.roleKeys : []),
    ...(Array.isArray(subject.roles) ? subject.roles.map((role) => role?.roleKey || role?.role_key || role) : [])
  ].map(normalizeRoleKey).filter(Boolean))];
}

export function resolveNovTalentAccess(subject = {}) {
  const roles = new Set(getFormalRoleKeys(subject));
  if (roles.has(ROLE_KEYS.SUPER_ADMIN) || roles.has(ROLE_KEYS.BACKOFFICE) || roles.has(ROLE_KEYS.HR_ADMIN)) {
    return Object.freeze({
      allowed: true,
      profile: "full",
      label: "総務人事部管理者",
      canViewDashboard: true,
      canViewCandidateContact: true,
      canViewPrivateNotes: true,
      canManageRecruitment: true,
      canManageSettings: true
    });
  }
  if (roles.has(ROLE_KEYS.HR_STAFF)) {
    return Object.freeze({
      allowed: true,
      profile: "recruiter",
      label: "採用担当",
      canViewDashboard: true,
      canViewCandidateContact: true,
      canViewPrivateNotes: true,
      canManageRecruitment: true,
      canManageSettings: false
    });
  }
  if (roles.has(ROLE_KEYS.EXECUTIVE)) {
    return Object.freeze({
      allowed: true,
      profile: "executive",
      label: "代表取締役",
      canViewDashboard: true,
      canViewCandidateContact: false,
      canViewPrivateNotes: false,
      canManageRecruitment: false,
      canManageSettings: false
    });
  }
  return Object.freeze({
    allowed: false,
    profile: "denied",
    label: "権限なし",
    canViewDashboard: false,
    canViewCandidateContact: false,
    canViewPrivateNotes: false,
    canManageRecruitment: false,
    canManageSettings: false
  });
}

export const NOV_TALENT_FORMAL_ROLE_KEYS = ROLE_KEYS;
