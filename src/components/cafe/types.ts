export interface CafeMenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

export interface CafeCartItem extends CafeMenuItem {
  quantity: number;
}

export interface CafeClassSchedule {
  id: string;
  start_time: string;
  class_model?: { name: string };
  instructor?: { full_name: string };
}

export const CAFE_CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "smoothie_bowl", label: "Smoothie Bowls" },
  { id: "drink", label: "Drinks" },
  { id: "snack", label: "Snacks" },
  { id: "meal", label: "Meals" },
] as const;

export const cafeCategoryLabel = (id: string): string =>
  CAFE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
