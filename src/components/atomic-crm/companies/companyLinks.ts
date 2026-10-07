export const httpUrl = (value?: string | null) => {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    if (
      /^[a-z][a-z\d+.-]*:(?!\d+(?:[/?#]|$))/i.test(raw) &&
      !/^https?:\/\//i.test(raw)
    )
      return null;
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:"].includes(url.protocol) &&
      url.hostname.includes(".")
      ? url.href
      : null;
  } catch {
    return null;
  }
};

export const validateHttpUrl = (value: string) =>
  value && !httpUrl(value)
    ? {
        message: "crm.validation.invalid_url",
        args: { _: "Must be a valid URL" },
      }
    : undefined;

export const socialLinks = (company: {
  linkedin_url?: string | null;
  social_links?: string[];
}) =>
  Array.from(
    new Set(
      [company.linkedin_url, ...(company.social_links ?? [])]
        .map((link) => httpUrl(link))
        .filter((link): link is string => !!link),
    ),
  );

export const linkDomain = (url: string) =>
  new URL(url).hostname.replace(/^www\./, "");

export const normalizeCompanyLinks = <
  T extends {
    website?: string;
    linkedin_url?: string;
    social_links?: string[];
  },
>(
  values: T,
): T => ({
  ...values,
  website: values.website
    ? (httpUrl(values.website) ?? values.website)
    : values.website,
  linkedin_url: values.linkedin_url
    ? (httpUrl(values.linkedin_url) ?? values.linkedin_url)
    : values.linkedin_url,
  social_links: values.social_links
    ?.filter(Boolean)
    .map((link) => httpUrl(link) ?? link),
});
