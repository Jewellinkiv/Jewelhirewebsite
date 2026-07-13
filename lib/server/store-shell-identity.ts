import type { StoreLocationScope } from "@/lib/server/auth";
import { getPostgresPool } from "@/lib/server/postgres";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

type StoreShellIdentityInput = {
  storeId: string;
  userName: string;
  locationScope?: StoreLocationScope;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "JH";
}

export async function getStoreShellIdentity(input: StoreShellIdentityInput) {
  const userInitials = initials(input.userName);
  if (getStorageRuntime() === "local") {
    return { storeLabel: "Sissy's Log Cabin · Little Rock", userInitials };
  }
  if (!input.storeId) return { storeLabel: "Your JewelHire store", userInitials };

  try {
    const storeResult = await getPostgresPool().query<{
      company_name: string;
      store_name: string;
      location_label: string | null;
    }>(
      `
        select c.name as company_name, s.name as store_name, s.location_label
        from stores s
        join companies c on c.id = s.company_id
        where s.id = $1 and s.status <> 'archived'
        limit 1
      `,
      [input.storeId],
    );
    const store = storeResult.rows[0];
    if (!store) return { storeLabel: "Your JewelHire store", userInitials };

    const scopedLocationIds = input.locationScope?.allLocations
      ? undefined
      : input.locationScope?.locationIds || [];
    const locationsResult = await getPostgresPool().query<{ name: string }>(
      `
        select name
        from locations
        where store_id = $1
          and ($2::boolean or id = any($3::text[]))
        order by created_at asc, name asc
      `,
      [input.storeId, scopedLocationIds === undefined, scopedLocationIds || []],
    );
    const locationNames = locationsResult.rows.map((row) => row.name.trim()).filter(Boolean);
    const locationLabel = locationNames.length === 1
      ? locationNames[0]
      : locationNames.length > 1
        ? `All locations (${locationNames.length})`
        : store.location_label && store.location_label !== "JewelLink"
          ? store.location_label
          : undefined;
    const organizationLabel = store.company_name || store.store_name;
    return {
      storeLabel: [organizationLabel, locationLabel].filter(Boolean).join(" · "),
      userInitials,
    };
  } catch {
    return { storeLabel: "Your JewelHire store", userInitials };
  }
}
