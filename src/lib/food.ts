export const CATEGORIES = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "drinks",
  "household",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: "Fruit & veg",
  meat: "Meat & fish",
  dairy: "Dairy & eggs",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  drinks: "Drinks",
  household: "Household",
  other: "Other",
};

export const LOCATIONS = ["fridge", "pantry", "freezer"] as const;
export type StorageLocation = (typeof LOCATIONS)[number];

export const LOCATION_LABEL: Record<StorageLocation, string> = {
  fridge: "Fridge",
  pantry: "Pantry",
  freezer: "Freezer",
};

const KEYWORDS: Array<[Category, string[]]> = [
  [
    "produce",
    ["apple", "banana", "tomato", "lettuce", "spinach", "carrot", "onion", "potato", "pepper", "cucumber", "berry", "berries", "lemon", "lime", "avocado", "broccoli", "salad", "mushroom", "garlic", "herb", "fruit", "veg"],
  ],
  ["meat", ["chicken", "beef", "pork", "mince", "salmon", "fish", "bacon", "sausage", "turkey", "ham", "prawn", "lamb"]],
  ["dairy", ["milk", "cheese", "yoghurt", "yogurt", "butter", "cream", "egg", "parmesan", "cheddar", "mozzarella"]],
  ["bakery", ["bread", "bagel", "roll", "bun", "tortilla", "croissant", "pita", "baguette"]],
  ["frozen", ["frozen", "ice cream", "peas"]],
  ["drinks", ["juice", "coffee", "tea", "water", "soda", "cola", "wine", "beer", "squash"]],
  ["household", ["paper", "detergent", "soap", "cleaner", "foil", "bag", "toilet", "shampoo", "sponge"]],
  [
    "pantry",
    ["rice", "pasta", "flour", "sugar", "oil", "salt", "sauce", "tin", "canned", "beans", "lentil", "oats", "cereal", "spice", "stock", "vinegar", "honey", "peanut"],
  ],
];

export function guessCategory(name: string): Category {
  const n = name.toLowerCase();
  for (const [category, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return category;
  }
  return "other";
}

const SHELF_LIFE: Record<Category, { location: StorageLocation; days: number }> = {
  produce: { location: "fridge", days: 6 },
  meat: { location: "fridge", days: 3 },
  dairy: { location: "fridge", days: 10 },
  bakery: { location: "pantry", days: 4 },
  frozen: { location: "freezer", days: 120 },
  pantry: { location: "pantry", days: 240 },
  drinks: { location: "pantry", days: 90 },
  household: { location: "pantry", days: 365 },
  other: { location: "pantry", days: 30 },
};

export function defaultStorage(category: Category) {
  return SHELF_LIFE[category] ?? SHELF_LIFE.other;
}

export function addDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function freshnessLabel(dateStr: string | null): string | null {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d < 0) return "past its date";
  if (d === 0) return "use today";
  if (d === 1) return "use tomorrow";
  if (d <= 7) return `${d} days left`;
  if (d <= 60) return `${Math.round(d / 7)} weeks left`;
  return "keeps a while";
}

export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(fresh|organic|large|small|pack|packet|bag|of|the|a)\b/g, " ")
    .replace(/s\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesAny(ingredient: string, haystack: string[]): boolean {
  const target = normalise(ingredient);
  if (!target) return false;
  return haystack.some((h) => {
    const item = normalise(h);
    if (!item) return false;
    return item.includes(target) || target.includes(item);
  });
}

export function weekDates(offsetWeeks = 0): string[] {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const day = (base.getDay() + 6) % 7; // Monday-first
  base.setDate(base.getDate() - day + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function shortDay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

export function dayNumber(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { day: "numeric" });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
