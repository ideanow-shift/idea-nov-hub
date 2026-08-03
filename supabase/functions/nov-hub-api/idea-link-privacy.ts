export type IdeaLinkPostRecord = Record<string, unknown>;

export const IDEA_LINK_PUBLIC_VISIBILITY = "public";
export const IDEA_LINK_PUBLIC_VISIBILITY_QUERY = "eq.public";

export function getIdeaLinkActorId(actor: IdeaLinkPostRecord) {
  return String(actor.id || actor.coreEmployeeId || actor.supabaseEmployeeId || "").trim();
}

export function isIdeaLinkPublicPost(post: IdeaLinkPostRecord) {
  return String(post.visibility || "").trim().toLowerCase() === IDEA_LINK_PUBLIC_VISIBILITY;
}

export function canReadIdeaLinkPost(actor: IdeaLinkPostRecord, post: IdeaLinkPostRecord) {
  if (isIdeaLinkPublicPost(post)) return true;
  const actorId = getIdeaLinkActorId(actor);
  if (!actorId) return false;
  return actorId === String(post.sender_id || "").trim()
    || actorId === String(post.receiver_id || "").trim();
}

export function filterIdeaLinkPublicPosts<T extends IdeaLinkPostRecord>(posts: T[]) {
  return posts.filter(isIdeaLinkPublicPost);
}

export function buildIdeaLinkReadablePostOr(actor: IdeaLinkPostRecord) {
  const actorId = getIdeaLinkActorId(actor);
  const parts = [
    `visibility.${IDEA_LINK_PUBLIC_VISIBILITY_QUERY}`,
    actorId ? `sender_id.eq.${actorId}` : "",
    actorId ? `receiver_id.eq.${actorId}` : "",
  ].filter(Boolean);
  return parts.length ? `(${parts.join(",")})` : "";
}
