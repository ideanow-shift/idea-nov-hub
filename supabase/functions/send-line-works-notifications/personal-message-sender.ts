export type ClaimResult =
  | { state: "claimed"; claimId: string }
  | { state: "duplicate"; result?: Record<string, unknown> }
  | { state: "delivery_unknown" };

export type PersonalMessageIntent = {
  intentId: string;
  fingerprint: string;
  recipientEmployeeId: string;
  title: string;
  body: string;
};

export type PersonalMessageSenderDependencies = {
  claim: (intent: PersonalMessageIntent) => Promise<ClaimResult>;
  deliver: (intent: PersonalMessageIntent) => Promise<Record<string, unknown>>;
  complete: (claimId: string, result: Record<string, unknown>) => Promise<void>;
  markDeliveryUnknown: (claimId: string, reason: string) => Promise<void>;
};

/**
 * Source-only at-most-once delivery adapter.
 *
 * The caller must provide a database-backed atomic claim. A read-then-update
 * implementation is intentionally not accepted here. Once delivery begins,
 * an ambiguous failure becomes delivery_unknown and is never retried
 * automatically.
 */
export function createPersonalMessageSender(deps: PersonalMessageSenderDependencies) {
  return async function send(intent: PersonalMessageIntent) {
    const claim = await deps.claim(intent);
    if (claim.state === "duplicate") {
      return { ok: true, duplicate: true, result: claim.result || null };
    }
    if (claim.state === "delivery_unknown") {
      return { ok: false, deliveryUnknown: true, retryAllowed: false };
    }

    try {
      const result = await deps.deliver(intent);
      await deps.complete(claim.claimId, result);
      return { ok: true, duplicate: false, result };
    } catch (error) {
      await deps.markDeliveryUnknown(claim.claimId, String(error));
      return { ok: false, deliveryUnknown: true, retryAllowed: false };
    }
  };
}
