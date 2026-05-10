export interface CafeItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

export interface CafeOrder {
  id: string;
  user_id: string;
  cafe_item_id: string;
  booking_id?: string;
  quantity: number;
  payment_method: string;
  status: string;
  order_date: string;
}

export const cafeService = {
  async getCafeItems(): Promise<CafeItem[]> {
    const res = await fetch("/api/cafe/items?available=true");
    return res.ok ? res.json() : [];
  },

  async createOrder(data: {
    cafe_item_id: string;
    booking_id?: string;
    quantity: number;
    payment_method: string;
  }): Promise<CafeOrder | null> {
    const res = await fetch("/api/cafe/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok ? res.json() : null;
  },

  async getUserOrders(): Promise<CafeOrder[]> {
    const res = await fetch("/api/cafe/orders");
    return res.ok ? res.json() : [];
  },
};
