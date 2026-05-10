export interface UserPackage {
  id: string;
  user_id: string;
  package_type_id: string;
  credits_remaining?: number | null;
  credits_total?: number | null;
  is_active: boolean;
  expiration_date: string;
  package_type?: {
    name: string;
    is_unlimited: boolean;
    class_count?: number | null;
  };
}

export const creditService = {
  async getPackages() {
    const res = await fetch("/api/packages");
    return res.ok ? res.json() : [];
  },

  async getUserCredits(): Promise<UserPackage | null> {
    const res = await fetch("/api/user-packages?active=true");
    const packages: UserPackage[] = res.ok ? await res.json() : [];
    return packages[0] ?? null;
  },

  async purchasePackage(packageTypeId: string): Promise<UserPackage | null> {
    const res = await fetch("/api/user-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package_type_id: packageTypeId }),
    });
    return res.ok ? res.json() : null;
  },

  async deductCredits(userPackageId: string): Promise<void> {
    await fetch("/api/user-packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userPackageId, credits_remaining: -1 }),
    });
  },
};
