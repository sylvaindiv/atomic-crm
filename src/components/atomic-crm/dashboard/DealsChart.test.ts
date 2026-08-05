import {
  getDealStageBucket,
  LOST_STAGE_VALUE,
  PENDING_STAGE_WEIGHT,
  WON_STAGE_VALUE,
} from "./DealsChart";

describe("getDealStageBucket", () => {
  it("buckets the Client status as won with full weight", () => {
    expect(getDealStageBucket(WON_STAGE_VALUE)).toEqual({
      bucket: "won",
      weight: 1,
    });
  });

  it("buckets the Mort status as lost with full weight", () => {
    expect(getDealStageBucket(LOST_STAGE_VALUE)).toEqual({
      bucket: "lost",
      weight: 1,
    });
  });

  it("buckets any other status as pending with the flat pending weight", () => {
    expect(getDealStageBucket("a_recontacter")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("visio")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });

  it("buckets an unknown or legacy stage value as pending instead of throwing or producing NaN", () => {
    expect(getDealStageBucket("won")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("lost")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("opportunity")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("a-brand-new-status-added-later")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });

  it("buckets empty or missing input as pending instead of throwing or producing NaN", () => {
    expect(getDealStageBucket("")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket(undefined)).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket(null)).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });
});
