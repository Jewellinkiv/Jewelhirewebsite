type ApplicantInviteDisplayItem = {
  kind: "GemMatch" | "JewelCert" | string;
  assessmentPackageId?: string;
  application?: { id?: string };
  store?: { id?: string };
};

const GEMMATCH_PACKAGES = new Set([
  "package-sales-associate-screen",
  "package-bench-jeweler-screen",
]);

function includesGemMatch(item: ApplicantInviteDisplayItem) {
  const packageId = item.assessmentPackageId?.trim() || "";
  return GEMMATCH_PACKAGES.has(packageId)
    || packageId.split("+").map((part) => part.trim()).includes("gemmatch");
}

function applicationStoreKey(item: ApplicantInviteDisplayItem) {
  const applicationId = item.application?.id?.trim();
  const storeId = item.store?.id?.trim();
  return applicationId && storeId ? `${applicationId}:${storeId}` : "";
}

export function applicantInvitesForDisplay<T extends ApplicantInviteDisplayItem>(items: T[]) {
  const bundledGemMatchKeys = new Set(
    items
      .filter((item) => item.kind === "JewelCert" && includesGemMatch(item))
      .map(applicationStoreKey)
      .filter(Boolean),
  );

  return items.filter((item) => {
    if (item.kind !== "GemMatch") return true;
    const key = applicationStoreKey(item);
    return !key || !bundledGemMatchKeys.has(key);
  });
}
