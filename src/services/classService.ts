export interface Class {
  id: string;
  name: string;
  category: string;
  description?: string;
  benefits?: string[];
  duration: number;
  max_capacity?: number;
  image_url?: string;
  instructor_id?: string;
}

export interface Booking {
  id: string;
  user_id: string;
  class_schedule_id?: string;
  user_package_id?: string;
  status: string;
  booking_date?: string;
  class_name?: string;
  class_time?: string;
  checked_in?: boolean;
}

export const classService = {
  async getClasses(): Promise<Class[]> {
    const res = await fetch("/api/classes");
    return res.ok ? res.json() : [];
  },

  async getUserBookings(): Promise<Booking[]> {
    const res = await fetch("/api/bookings?status=confirmed");
    return res.ok ? res.json() : [];
  },

  async bookClass(data: {
    class_schedule_id?: string;
    user_package_id?: string;
    class_name?: string;
    class_time?: string;
  }): Promise<Booking | null> {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok ? res.json() : null;
  },

  async cancelBooking(bookingId: string): Promise<void> {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, status: "cancelled" }),
    });
  },

  async getMovementStreak(): Promise<number> {
    const res = await fetch("/api/user/profile");
    const profile = res.ok ? await res.json() : null;
    return profile?.movement_streak ?? 0;
  },
};
