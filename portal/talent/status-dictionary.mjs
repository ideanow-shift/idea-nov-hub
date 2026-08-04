export const CANDIDATE_STATUS_LABELS = Object.freeze({
  LINE_REGISTERED: "LINE登録",
  APPLICATION_RECEIVED: "応募受付",
  SALON_TOUR_PLANNED: "サロン見学［予定］",
  SALON_TOUR_COMPLETED: "サロン見学［済］",
  INTERVIEW_PLANNED: "面接［予定］",
  INTERVIEW_COMPLETED: "面接［済］",
  UNDER_REVIEW: "合否検討中",
  OFFERED: "内定",
  OFFER_ACCEPTED: "内定承諾",
  EXPECTED_JOIN: "入社予定",
  OFFERED_ELSEWHERE: "他社内定",
  WITHDRAWN: "辞退・離脱",
  REJECTED: "不採用"
});

export const EVENT_STATUS_LABELS = Object.freeze({
  CONTACT_RECORDED: "接触",
  LINE_REGISTERED: "LINE登録",
  SALON_TOUR_PLANNED: "見学予定",
  SALON_TOUR_COMPLETED: "見学済",
  INTERVIEW_PLANNED: "面接予定",
  INTERVIEW_COMPLETED: "面接済"
});

export const SELECTION_STATUS_LABELS = Object.freeze({
  APPLICATION_RECEIVED: "応募",
  INTERVIEW_PLANNED: "面接予定",
  INTERVIEW_COMPLETED: "面接済",
  UNDER_REVIEW: "合否検討中",
  OFFERED: "内定",
  OFFER_ACCEPTED: "内定承諾",
  WITHDRAWN: "辞退",
  REJECTED: "不採用"
});

export function statusLabel(code, fallback = "状態未設定") {
  return CANDIDATE_STATUS_LABELS[String(code || "")] || fallback;
}
