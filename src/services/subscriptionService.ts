export interface MealSubscription {
  id: string;
  user_id: string;
  meal_count: number;
  meals_remaining: number;
  price_per_month: number;
  start_date: string;
  next_billing_date: string;
  status: string;
}

export const subscriptionService = {
  async getUserSubscription(): Promise<MealSubscription | null> {
    const res = await fetch("/api/meal-subscriptions");
    return res.ok ? res.json() : null;
  },

  async createSubscription(data: {
    meal_count: number;
    price_per_month: number;
    start_date: string;
    next_billing_date: string;
  }): Promise<MealSubscription | null> {
    const res = await fetch("/api/meal-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok ? res.json() : null;
  },

  async useMealCredit(subscriptionId: string, mealsRemaining: number): Promise<void> {
    await fetch("/api/meal-subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriptionId, meals_remaining: mealsRemaining - 1 }),
    });
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await fetch("/api/meal-subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriptionId, status: "cancelled" }),
    });
  },
};
