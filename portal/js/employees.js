export const DEMO_EMPLOYEES = [
  { email: "staff@example.com", name: "佐藤 スタッフ", store: "BASSA 新所沢店", department: "サロン事業部", position: "アシスタント", grade: "1", roleLevel: 1, roleKeys: ["staff"], tags: ["all"], status: "active" },
  { email: "manager@example.com", name: "鈴木 店長", store: "BASSA 高田馬場店", department: "サロン事業部", position: "店長", grade: "3", roleLevel: 3, tags: ["all", "manager", "sales"], status: "active" },
  { email: "hqstaff@example.com", name: "高橋 採用担当", store: "本部", department: "総務人事部", position: "スタッフ", grade: "2", roleLevel: 2, roleKeys: ["hr.staff"], tags: ["all", "hq", "backoffice"], capabilities: ["attendance.manage", "human_capital.all"], status: "active" },
  { email: "hradmin@example.com", name: "総務人事部長", store: "本部", department: "総務人事部", position: "部長", grade: "5", roleLevel: 5, roleKeys: ["hr.admin"], tags: ["all", "hq", "backoffice"], capabilities: ["human_capital.all"], status: "active" },
  { email: "hq@example.com", name: "代表取締役", store: "本部", department: "経営企画部", position: "代表取締役", grade: "5", roleLevel: 5, roleKeys: ["executive"], tags: ["all", "executive", "hq", "fc"], status: "active" },
  { email: "inactive@example.com", name: "停止ユーザー", store: "BASSA", department: "サロン事業部", position: "スタッフ", grade: "1", roleLevel: 1, tags: ["all"], status: "inactive" }
];

export function getDemoEmployee(email) {
  return DEMO_EMPLOYEES.find((employee) => employee.email === email) ?? null;
}
