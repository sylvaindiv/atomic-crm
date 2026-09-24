import { clearAuthState, getAuthProvider } from "./authProvider";

const apiFetch = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());

vi.mock("./internal/httpClient", () => ({ apiFetch, apiPost }));

const session = {
  user: {
    id: 7,
    first_name: "Jane",
    last_name: "Doe",
    avatar: { src: "https://example.com/jane.png" },
    administrator: true,
  },
  must_change_password: true,
};

describe("turso authProvider", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiPost.mockReset();
    clearAuthState();
    localStorage.clear();
  });

  it("uses the server session and redirects a temporary password user", async () => {
    apiPost.mockResolvedValue(session);

    await expect(
      getAuthProvider().login({
        email: "jane@example.com",
        password: "temporary password",
      }),
    ).resolves.toEqual({ redirectTo: "/change-password" });
    await expect(getAuthProvider().getIdentity?.()).resolves.toEqual({
      id: 7,
      fullName: "Jane Doe",
      avatar: "https://example.com/jane.png",
      must_change_password: true,
    });
    expect(apiPost).toHaveBeenCalledWith("auth/login", {
      email: "jane@example.com",
      password: "temporary password",
    });
  });

  it("checks the session on the server without provisioning a sales row", async () => {
    apiFetch.mockResolvedValue({ ...session, must_change_password: false });

    await expect(getAuthProvider().checkAuth({})).resolves.toBeUndefined();
    expect(apiFetch).toHaveBeenCalledWith("auth/me");
  });

  it("redirects a limited session without logging it out", async () => {
    await expect(
      getAuthProvider().checkError({
        status: 403,
        body: { code: "PASSWORD_CHANGE_REQUIRED" },
      }),
    ).rejects.toEqual({ redirectTo: "/change-password" });
    expect(apiPost).not.toHaveBeenCalled();
  });
});
