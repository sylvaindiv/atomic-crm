import { describe, expect, it } from "vitest";
import { httpUrl, normalizeCompanyLinks, socialLinks } from "./companyLinks";

describe("club links", () => {
  it("normalizes web addresses and rejects unsafe schemes", () => {
    expect(httpUrl("club.example.org/path")).toBe(
      "https://club.example.org/path",
    );
    expect(httpUrl("club.example.org:8443/path")).toBe(
      "https://club.example.org:8443/path",
    );
    expect(httpUrl("javascript:alert(1)")).toBeNull();
    expect(httpUrl("ftp://club.example.org")).toBeNull();
    expect(
      normalizeCompanyLinks({
        website: "club.example.org",
        social_links: ["social.example.org"],
      }),
    ).toMatchObject({
      website: "https://club.example.org/",
      social_links: ["https://social.example.org/"],
    });
  });

  it("combines LinkedIn and social URLs without duplicates", () => {
    expect(
      socialLinks({
        linkedin_url: "linkedin.com/company/a",
        social_links: [
          "https://linkedin.com/company/a",
          "https://example.org",
          "javascript:alert(1)",
        ],
      }),
    ).toEqual(["https://linkedin.com/company/a", "https://example.org/"]);
  });
});
