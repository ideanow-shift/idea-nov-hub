import { createPersonalMessageSender, type ClaimResult } from "../supabase/functions/send-line-works-notifications/personal-message-sender.ts";

function assertEquals(actual: unknown, expected: unknown) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
}

const intent = {
  intentId: "00000000-0000-4000-8000-000000000001",
  fingerprint: "fixture-fingerprint",
  recipientEmployeeId: "00000000-0000-4000-8000-000000000002",
  title: "【接続テスト】",
  body: "脇田AI秘書からLINE WORKSへの送信テストです。返信・対応は不要です。",
};

Deno.test("concurrent duplicate requests deliver only once after atomic claim", async () => {
  let claimed = false;
  let deliveries = 0;
  const sender = createPersonalMessageSender({
    claim: async (): Promise<ClaimResult> => {
      if (claimed) return { state: "duplicate" };
      claimed = true;
      return { state: "claimed", claimId: "claim-1" };
    },
    deliver: async () => ({ providerMessageId: `fixture-${++deliveries}` }),
    complete: async () => {},
    markDeliveryUnknown: async () => {},
  });

  const results = await Promise.all([sender(intent), sender(intent)]);
  assertEquals(deliveries, 1);
  assertEquals(results.filter((result) => result.duplicate === true).length, 1);
});

Deno.test("delivery_unknown is fail-closed and never automatically retried", async () => {
  let deliveries = 0;
  const sender = createPersonalMessageSender({
    claim: async () => ({ state: "delivery_unknown" }),
    deliver: async () => {
      deliveries += 1;
      return {};
    },
    complete: async () => {},
    markDeliveryUnknown: async () => {},
  });

  const result = await sender(intent);
  assertEquals(result, { ok: false, deliveryUnknown: true, retryAllowed: false });
  assertEquals(deliveries, 0);
});

Deno.test("ambiguous provider failure is marked delivery_unknown", async () => {
  let marked = "";
  const sender = createPersonalMessageSender({
    claim: async () => ({ state: "claimed", claimId: "claim-2" }),
    deliver: async () => {
      throw new Error("fixture timeout after request");
    },
    complete: async () => {},
    markDeliveryUnknown: async (claimId) => {
      marked = claimId;
    },
  });

  const result = await sender(intent);
  assertEquals(result.retryAllowed, false);
  assertEquals(marked, "claim-2");
});
