import { geocodeAddress } from "./geocodeAddress";

const addressApiResponse = (lat: number, lng: number) => ({
  features: [{ geometry: { coordinates: [lng, lat] } }],
});

describe("geocodeAddress", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("calls the French address API and caches the result on a cache miss", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => addressApiResponse(48.85, 2.35),
    });
    vi.stubGlobal("fetch", fetchMock);

    const point = await geocodeAddress("75001", "Paris");

    expect(point).toEqual({ lat: 48.85, lng: 2.35 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain("data.geopf.fr/geocodage/search");
    expect(requestedUrl).toContain("postcode=75001");
    expect(localStorage.getItem("map-geocode:v2:75001|Paris")).toEqual(
      JSON.stringify({ lat: 48.85, lng: 2.35 }),
    );

    vi.unstubAllGlobals();
  });

  it("skips the network call on a cache hit", async () => {
    localStorage.setItem(
      "map-geocode:v2:69001|Lyon",
      JSON.stringify({ lat: 45.76, lng: 4.84 }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const point = await geocodeAddress("69001", "Lyon");

    expect(point).toEqual({ lat: 45.76, lng: 4.84 });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("caches a null result when the API finds no match, so it isn't re-queried", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const point = await geocodeAddress("00000", "Nowhere");

    expect(point).toBeNull();
    expect(localStorage.getItem("map-geocode:v2:00000|Nowhere")).toEqual(
      JSON.stringify(null),
    );

    const secondCall = await geocodeAddress("00000", "Nowhere");
    expect(secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("returns null and does not cache when the network request fails, so it retries next time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const point = await geocodeAddress("13001", "Marseille");

    expect(point).toBeNull();
    expect(localStorage.getItem("map-geocode:v2:13001|Marseille")).toBeNull();

    vi.unstubAllGlobals();
  });

  it("returns null and does not cache when the API responds with a non-retryable error status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const point = await geocodeAddress("59000", "Lille");

    expect(point).toBeNull();
    expect(localStorage.getItem("map-geocode:v2:59000|Lille")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("retries a 429 with backoff and succeeds once the rate limit clears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => addressApiResponse(50.63, 3.06),
      });
    vi.stubGlobal("fetch", fetchMock);

    const pending = geocodeAddress("59000", "Lille");
    await vi.runAllTimersAsync();
    const point = await pending;

    expect(point).toEqual({ lat: 50.63, lng: 3.06 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("map-geocode:v2:59000|Lille")).toEqual(
      JSON.stringify({ lat: 50.63, lng: 3.06 }),
    );

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives up and does not cache after repeated 429s, so a later visit retries", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);

    const pending = geocodeAddress("59000", "Lille");
    await vi.runAllTimersAsync();
    const point = await pending;

    expect(point).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4); // initial attempt + 3 retries
    expect(localStorage.getItem("map-geocode:v2:59000|Lille")).toBeNull();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
