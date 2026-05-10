export interface PackageType {
  id: string;
  name: string;
  type: string;
  class_count?: number | null;
  duration_months?: number | null;
  price: number;
  includes_physique_57?: boolean;
  is_unlimited?: boolean;
  description?: string;
}

export const purchaseService = {
  async getPackageTypes(): Promise<PackageType[]> {
    const res = await fetch("/api/packages");
    return res.ok ? res.json() : [];
  },

  async getPackageType(id: string): Promise<PackageType | null> {
    const all = await purchaseService.getPackageTypes();
    return all.find(p => p.id === id) ?? null;
  },

  async purchasePackage(
    _userId: string,
    packageTypeId: string,
    packageType: PackageType
  ): Promise<void> {
    await fetch("/api/user-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package_type_id: packageTypeId,
        pass_type: packageType.is_unlimited ? "studio_pass" : "class_pass",
      }),
    });
  },

  async getUserPackages(): Promise<unknown[]> {
    const res = await fetch("/api/user-packages");
    return res.ok ? res.json() : [];
  },

  async createPackageType(data: Omit<PackageType, "id">): Promise<PackageType> {
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create package type");
    return res.json();
  },
};
