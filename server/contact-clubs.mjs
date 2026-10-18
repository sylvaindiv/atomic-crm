// Legacy writes replace only the first membership; explicit lists are authoritative.
export async function prepareContactClubs(data, previous, executor) {
  if (
    !("company_ids" in data) &&
    !("company_id" in data) &&
    !("contact_type" in data)
  )
    return data;
  // Full legacy forms echo the unchanged list alongside an edited primary club.
  const legacyChange =
    previous &&
    "company_id" in data &&
    data.company_id !== previous.company_id &&
    JSON.stringify(data.company_ids) === JSON.stringify(previous.company_ids);
  let ids;
  if ("company_ids" in data && !legacyChange) {
    ids = data.company_ids;
  } else {
    const old =
      previous?.company_ids ??
      (previous?.company_id == null ? [] : [previous.company_id]);
    ids =
      "company_id" in data
        ? [
            ...new Set([
              ...(data.company_id == null ? [] : [data.company_id]),
              ...old.slice(1),
            ]),
          ]
        : old;
  }
  if (
    !Array.isArray(ids) ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("company_ids must contain unique positive integer IDs");
  }
  if (
    (data.contact_type ?? previous?.contact_type) === "partner" &&
    ids.length > 1
  ) {
    throw new Error("A partner can belong to only one club");
  }
  if (ids.length) {
    const { rows } = await executor.execute({
      sql: `SELECT id FROM companies WHERE id IN (${ids.map(() => "?").join(",")})`,
      args: ids,
    });
    if (rows.length !== ids.length)
      throw new Error("Unknown club in company_ids");
  }
  return { ...data, company_ids: ids, company_id: ids[0] ?? null };
}

export function assertTenupId(data) {
  if (
    data?.tenup_id !== undefined &&
    data.tenup_id !== null &&
    (typeof data.tenup_id !== "string" || !data.tenup_id.trim())
  ) {
    throw new Error("tenup_id must be a non-empty string or null");
  }
}
