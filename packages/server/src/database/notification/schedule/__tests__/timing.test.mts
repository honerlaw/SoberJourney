import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNextDue,
  isSchedulePending,
  zonedTimeToInstant,
  type NotificationHistoryRow,
  type ScheduleTimingInput,
} from "../timing.mjs";
import {
  PushNotificationStatus,
  UserPushNotificationScheduleFrequency as Frequency,
} from "../../../../generated/prisma/enums.js";

const TZ = "America/New_York";
const NINE_AM = 9 * 60;

const at = (iso: string) => new Date(iso);

function sent(iso: string): NotificationHistoryRow {
  return {
    createdAt: at(iso),
    status: PushNotificationStatus.COMPLETE,
    receiptId: `receipt-${iso}`,
  };
}

function failed(iso: string): NotificationHistoryRow {
  return {
    createdAt: at(iso),
    status: PushNotificationStatus.ERROR,
    receiptId: null,
  };
}

function pending(
  now: string,
  overrides: Partial<ScheduleTimingInput> = {},
): boolean {
  return isSchedulePending({
    now: at(now),
    createdAt: at("2026-06-01T12:00:00Z"),
    frequency: Frequency.DAILY,
    minuteOfDay: NINE_AM,
    timezone: TZ,
    notifications: [],
    ...overrides,
  });
}

describe("schedule timing", () => {
  describe("zonedTimeToInstant (DST)", () => {
    it("uses the offset in effect at the target local time", () => {
      // EST (-5) the day before DST starts, EDT (-4) on the day it starts
      assert.equal(
        zonedTimeToInstant(
          { year: 2026, month: 3, day: 7 },
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-03-07T14:00:00.000Z",
      );
      assert.equal(
        zonedTimeToInstant(
          { year: 2026, month: 3, day: 8 },
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-03-08T13:00:00.000Z",
      );
      // DST ends on 2026-11-01
      assert.equal(
        zonedTimeToInstant(
          { year: 2026, month: 10, day: 31 },
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-10-31T13:00:00.000Z",
      );
      assert.equal(
        zonedTimeToInstant(
          { year: 2026, month: 11, day: 1 },
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-11-01T14:00:00.000Z",
      );
    });

    it("next due across a DST change keeps the local time", () => {
      assert.equal(
        getNextDue(
          at("2026-03-07T14:00:00Z"),
          Frequency.DAILY,
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-03-08T13:00:00.000Z",
      );
    });
  });

  describe("first send", () => {
    // created 2026-06-10 10:00 EDT, after the 9:00 reminder time
    const createdAt = at("2026-06-10T14:00:00Z");

    for (const frequency of Object.values(Frequency)) {
      it(`does not fire immediately when created after the time (${frequency})`, () => {
        assert.equal(
          pending("2026-06-10T14:05:00Z", { createdAt, frequency }),
          false,
        );
        assert.equal(
          pending("2026-06-11T12:59:00Z", { createdAt, frequency }),
          false,
        );
        // next 9:00 EDT
        assert.equal(
          pending("2026-06-11T13:00:00Z", { createdAt, frequency }),
          true,
        );
      });
    }

    it("fires the same day when created before the time", () => {
      const before = at("2026-06-10T12:00:00Z"); // 08:00 EDT
      assert.equal(
        pending("2026-06-10T12:59:00Z", { createdAt: before }),
        false,
      );
      assert.equal(
        pending("2026-06-10T13:00:00Z", { createdAt: before }),
        true,
      );
    });

    it("fires when created within the slot minute", () => {
      const sameMinute = at("2026-06-10T13:00:30Z"); // 09:00:30 EDT
      assert.equal(
        pending("2026-06-10T13:01:00Z", { createdAt: sameMinute }),
        true,
      );
    });

    it("throws for an invalid timezone", () => {
      assert.throws(() =>
        pending("2026-06-10T13:00:00Z", { timezone: "Not/AZone" }),
      );
    });
  });

  describe("subsequent sends", () => {
    it("a late send just after midnight does not skip the next day", () => {
      // 23:50 reminder for June 10 went out at 00:10 EDT on June 11
      const minuteOfDay = 23 * 60 + 50;
      const notifications = [sent("2026-06-11T04:10:00Z")];
      // June 11 23:50 EDT
      assert.equal(
        pending("2026-06-12T03:49:00Z", { minuteOfDay, notifications }),
        false,
      );
      assert.equal(
        pending("2026-06-12T03:50:00Z", { minuteOfDay, notifications }),
        true,
      );
    });

    it("moving the time later on the same day does not double-send", () => {
      // sent at 09:00 EDT, then the user moved the reminder to 20:00
      const minuteOfDay = 20 * 60;
      const notifications = [sent("2026-06-10T13:00:00Z")];
      // June 10 20:30 EDT
      assert.equal(
        pending("2026-06-11T00:30:00Z", { minuteOfDay, notifications }),
        false,
      );
      // June 11 20:00 EDT
      assert.equal(
        pending("2026-06-12T00:00:00Z", { minuteOfDay, notifications }),
        true,
      );
    });

    it("moving the time earlier fires the next day at the new time", () => {
      // sent at 20:00 EDT June 10, moved to 09:00
      const notifications = [sent("2026-06-11T00:00:00Z")];
      assert.equal(pending("2026-06-11T12:59:00Z", { notifications }), false);
      assert.equal(pending("2026-06-11T13:00:00Z", { notifications }), true);
    });

    it("weekly waits seven local days", () => {
      const notifications = [sent("2026-06-10T13:00:00Z")];
      const frequency = Frequency.WEEKLY;
      assert.equal(
        pending("2026-06-16T13:00:00Z", { frequency, notifications }),
        false,
      );
      assert.equal(
        pending("2026-06-17T13:00:00Z", { frequency, notifications }),
        true,
      );
    });

    it("monthly uses calendar months, clamped to the month length", () => {
      assert.equal(
        getNextDue(
          at("2026-01-31T14:00:00Z"),
          Frequency.MONTHLY,
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-02-28T14:00:00.000Z",
      );
      assert.equal(
        getNextDue(
          at("2026-04-15T13:00:00Z"),
          Frequency.MONTHLY,
          NINE_AM,
          TZ,
        ).toISOString(),
        "2026-05-15T13:00:00.000Z",
      );
    });

    it("a receipt error still counts as a send", () => {
      const notifications: NotificationHistoryRow[] = [
        {
          createdAt: at("2026-06-10T13:00:00Z"),
          status: PushNotificationStatus.ERROR,
          receiptId: "receipt-1",
        },
      ];
      assert.equal(pending("2026-06-10T14:00:00Z", { notifications }), false);
    });

    it("without minuteOfDay uses the interval since the last send", () => {
      const notifications = [sent("2026-06-10T13:17:00Z")];
      assert.equal(
        pending("2026-06-11T13:16:00Z", { minuteOfDay: null, notifications }),
        false,
      );
      assert.equal(
        pending("2026-06-11T13:17:00Z", { minuteOfDay: null, notifications }),
        true,
      );
    });
  });

  describe("failed attempts", () => {
    const lastSend = sent("2026-06-09T13:00:00Z");

    it("retries after the backoff and counts one run as one attempt", () => {
      // one run, two tokens, both failed
      const notifications = [
        lastSend,
        failed("2026-06-10T13:00:00Z"),
        failed("2026-06-10T13:00:00Z"),
      ];
      assert.equal(pending("2026-06-10T13:04:00Z", { notifications }), false);
      assert.equal(pending("2026-06-10T13:05:00Z", { notifications }), true);
    });

    it("doubles the backoff for the second retry", () => {
      const notifications = [
        lastSend,
        failed("2026-06-10T13:00:00Z"),
        failed("2026-06-10T13:05:00Z"),
      ];
      assert.equal(pending("2026-06-10T13:14:00Z", { notifications }), false);
      assert.equal(pending("2026-06-10T13:15:00Z", { notifications }), true);
    });

    it("gives the slot up after three attempts, then the next slot fires", () => {
      const notifications = [
        lastSend,
        failed("2026-06-10T13:00:00Z"),
        failed("2026-06-10T13:05:00Z"),
        failed("2026-06-10T13:15:00Z"),
      ];
      assert.equal(pending("2026-06-10T14:00:00Z", { notifications }), false);
      assert.equal(pending("2026-06-11T12:59:00Z", { notifications }), false);
      assert.equal(pending("2026-06-11T13:00:00Z", { notifications }), true);
    });

    it("failures from a previous slot do not count against the current slot", () => {
      const notifications = [
        sent("2026-06-08T13:00:00Z"),
        failed("2026-06-09T13:00:00Z"),
        failed("2026-06-09T13:05:00Z"),
        failed("2026-06-09T13:15:00Z"),
        failed("2026-06-10T13:00:00Z"),
      ];
      // one attempt in the June 10 slot so far: retry after 5 minutes
      assert.equal(pending("2026-06-10T13:04:00Z", { notifications }), false);
      assert.equal(pending("2026-06-10T13:05:00Z", { notifications }), true);
    });

    it("a mixed run (one token sent, one failed) counts as sent", () => {
      const notifications = [
        lastSend,
        sent("2026-06-10T13:00:00Z"),
        failed("2026-06-10T13:00:00Z"),
      ];
      assert.equal(pending("2026-06-10T13:30:00Z", { notifications }), false);
    });

    it("retries a first send that failed", () => {
      const notifications = [failed("2026-06-10T13:00:00Z")];
      assert.equal(pending("2026-06-10T13:04:00Z", { notifications }), false);
      assert.equal(pending("2026-06-10T13:05:00Z", { notifications }), true);
    });
  });
});
