const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reject(code) {
  throw Object.assign(new Error(code), { code });
}

export function resolveCanonicalOperator({ summary, expectedEmployeeUuid, expectedEmployeeNumber, reviewerPrincipal }) {
  if (!summary || typeof summary !== 'object') reject('OPERATOR_CANONICAL_BINDING_REJECTED');
  if (!UUID.test(expectedEmployeeUuid ?? '') || !/^\d+$/.test(expectedEmployeeNumber ?? '')) reject('OPERATOR_CANONICAL_BINDING_REJECTED');
  if (summary.sales_department_head_state !== 'resolved'
    || summary.sales_department_head_candidate_count !== 1
    || summary.sales_department_head_employee_key !== expectedEmployeeUuid
    || summary.sales_department_head_employee_number !== expectedEmployeeNumber) reject('OPERATOR_CANONICAL_BINDING_REJECTED');
  if (reviewerPrincipal === `canonical-employee:${expectedEmployeeUuid}`) reject('OPERATOR_REVIEWER_SEPARATION_REJECTED');
  return Object.freeze({
    principalType: 'canonical_employee_organization_assignment',
    employeeUuid: expectedEmployeeUuid,
    employeeNumber: expectedEmployeeNumber,
    organization: '営業部',
    assignmentCode: 'department_head',
  });
}
