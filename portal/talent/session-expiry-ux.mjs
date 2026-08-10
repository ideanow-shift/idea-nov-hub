export const HUB_SESSION_REAUTH_MESSAGE = "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。";

export function isCandidateWriteSessionAvailable(status) {
  return status === "available";
}
