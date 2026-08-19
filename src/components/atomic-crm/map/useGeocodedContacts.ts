import { useEffect, useState } from "react";

import type { Contact } from "../types";
import { geocodeAddress, type GeoPoint } from "./geocodeAddress";
import { mapWithConcurrency } from "./mapWithConcurrency";

export type ContactMapPoint = GeoPoint & { contact: Contact };

const NO_CONTACTS: Contact[] = [];

// Public, unauthenticated API: keep concurrent requests low to avoid
// getting rate-limited when there are hundreds of unique addresses.
const GEOCODE_CONCURRENCY = 3;

export const useGeocodedContacts = (contacts: Contact[] = NO_CONTACTS) => {
  const [points, setPoints] = useState<ContactMapPoint[]>([]);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsPending(true);

    const geocodable = contacts.filter(
      (contact): contact is Contact & { postal_code: string; city: string } =>
        !!contact.postal_code && !!contact.city,
    );

    const uniqueAddresses = [
      ...new Map(
        geocodable.map((c) => [`${c.postal_code}|${c.city}`, c]),
      ).values(),
    ];

    mapWithConcurrency(uniqueAddresses, GEOCODE_CONCURRENCY, async (c) => {
      const point = await geocodeAddress(c.postal_code, c.city);
      return point ? { key: `${c.postal_code}|${c.city}`, point } : null;
    }).then((results) => {
      if (cancelled) return;
      const coordsByAddress = new Map(
        results.filter((r) => r !== null).map((r) => [r.key, r.point]),
      );
      setPoints(
        geocodable.flatMap((contact) => {
          const point = coordsByAddress.get(
            `${contact.postal_code}|${contact.city}`,
          );
          return point ? [{ ...point, contact }] : [];
        }),
      );
      setIsPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [contacts]);

  return { points, isPending };
};
