import { getTasksDueToday, renderDigestEmail, sendDailyDigest } from "./dailyDigest.mjs";

/** Fake libSQL client: replays `responses` in order, records every call. */
function makeDb(responses = []) {
  const calls = [];
  const queue = [...responses];
  return {
    calls,
    execute: vi.fn(async (query) => {
      calls.push(query);
      return queue.shift() ?? { columns: [], rows: [] };
    }),
  };
}

/** Fake `fetch`: records every call, always resolves ok unless `ok` is overridden. */
function makeFetch(ok = true, status = 200, text = "") {
  const calls = [];
  return {
    calls,
    fetchImpl: vi.fn(async (url, init) => {
      calls.push({ url, init });
      return { ok, status, text: async () => text };
    }),
  };
}

const tasksRow = {
  columns: ["type", "text", "due_date", "contact_first_name", "contact_last_name"],
  rows: [
    ["call", "Confirm court booking", "2026-08-11", "Jane", "Doe"],
    ["email", "Send invoice", "2026-08-11", "John", "Smith"],
  ],
};

describe("dailyDigest.getTasksDueToday", () => {
  it("maps query rows to task objects", async () => {
    // Arrange
    const db = makeDb([tasksRow]);

    // Act
    const tasks = await getTasksDueToday(db);

    // Assert
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]).toContain("done_date");
    expect(tasks).toEqual([
      {
        type: "call",
        text: "Confirm court booking",
        due_date: "2026-08-11",
        contact_first_name: "Jane",
        contact_last_name: "Doe",
      },
      {
        type: "email",
        text: "Send invoice",
        due_date: "2026-08-11",
        contact_first_name: "John",
        contact_last_name: "Smith",
      },
    ]);
  });

  it("returns an empty array when nothing is due", async () => {
    // Arrange
    const db = makeDb([{ columns: [], rows: [] }]);

    // Act
    const tasks = await getTasksDueToday(db);

    // Assert
    expect(tasks).toEqual([]);
  });
});

describe("dailyDigest.renderDigestEmail", () => {
  it("escapes task text so it cannot break out of the HTML markup", () => {
    // Arrange
    const tasks = [
      {
        type: "call",
        text: '<img src=x onerror="alert(1)">',
        contact_first_name: "Jane",
        contact_last_name: "Doe",
      },
    ];

    // Act
    const { html } = renderDigestEmail(tasks);

    // Assert
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("includes the CTA button linking to the dashboard", () => {
    // Arrange
    // This test runs in the browser-based "app" Vitest project, where
    // `process` does not exist, so dailyDigest.mjs's env guard always
    // resolves to the hardcoded fallback URL -- exercised here.

    // Act
    const { html } = renderDigestEmail([]);

    // Assert
    expect(html).toContain("https://crm.padel-arcade.fr/#/");
    expect(html).toContain("Ouvrir le dashboard");
  });
});

describe("dailyDigest.sendDailyDigest", () => {
  it("makes no call to the injected fetch mock when no task is due", async () => {
    // Arrange
    const db = makeDb([{ columns: [], rows: [] }]);
    const { fetchImpl, calls } = makeFetch();

    // Act
    await sendDailyDigest({ fetchImpl, db });

    // Assert
    expect(calls).toHaveLength(0);
  });

  it("posts the expected from/to/subject and includes every task's text in the html when tasks exist", async () => {
    // Arrange
    const db = makeDb([tasksRow]);
    const { fetchImpl, calls } = makeFetch();

    // Act
    await sendDailyDigest({ fetchImpl, db, to: "someone@example.test" });

    // Assert
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    const body = JSON.parse(calls[0].init.body);
    expect(body.from).toBe("CRM Padel Arcade <crm@appnotif.fr>");
    expect(body.to).toBe("someone@example.test");
    expect(body.subject).toContain("tâche");
    expect(body.html).toContain("Confirm court booking");
    expect(body.html).toContain("Send invoice");
  });

  it("defaults to the fixed recipient when no `to` override is given", async () => {
    // Arrange
    const db = makeDb([tasksRow]);
    const { fetchImpl, calls } = makeFetch();

    // Act
    await sendDailyDigest({ fetchImpl, db });

    // Assert
    const body = JSON.parse(calls[0].init.body);
    expect(body.to).toBe("contact@numero28consulting.fr");
  });

  it("throws with status and body on a non-2xx Resend response", async () => {
    // Arrange
    const db = makeDb([tasksRow]);
    const { fetchImpl } = makeFetch(false, 422, "Invalid `to` field");

    // Act / Assert
    await expect(sendDailyDigest({ fetchImpl, db })).rejects.toThrow(
      /422.*Invalid `to` field/,
    );
  });
});
