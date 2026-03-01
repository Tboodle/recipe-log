import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useShoppingList, useToggleItem } from "@/hooks/useShoppingLists";
import type { ShoppingItem } from "@/hooks/useShoppingLists";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuantity } from "@/lib/quantity";

const CATEGORY_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery & Bread",
  "Pantry & Dry Goods",
  "Frozen",
  "Beverages",
  "Condiments & Sauces",
  "Other",
];

function groupByCategory(items: ShoppingItem[]): Array<{ category: string; items: ShoppingItem[] }> {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const cat = item.category ?? "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const result: Array<{ category: string; items: ShoppingItem[] }> = [];
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) result.push({ category: cat, items: map.get(cat)! });
  }
  // Any categories not in the ordered list (shouldn't happen, but just in case)
  for (const [cat, its] of map) {
    if (!CATEGORY_ORDER.includes(cat)) result.push({ category: cat, items: its });
  }
  return result;
}

function ItemRow({ item, onToggle }: { item: ShoppingItem; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-zinc-200 cursor-pointer hover:border-amber-300 transition-colors">
      <Checkbox
        checked={false}
        onCheckedChange={onToggle}
        className="border-zinc-300"
      />
      <span className="text-zinc-800 leading-snug">
        {(item.quantity != null || item.unit) && (
          <strong>
            {formatQuantity(item.quantity)}
            {item.unit ? ` ${item.unit}` : ""}{" "}
          </strong>
        )}
        {item.ingredient_name}
      </span>
    </label>
  );
}

export default function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: list, isLoading } = useShoppingList(id!);
  const toggleItem = useToggleItem(id!);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!list) return <p className="text-zinc-500">List not found.</p>;

  const unchecked = list.items.filter((i) => !i.checked);
  const checked = list.items.filter((i) => i.checked);
  const groups = groupByCategory(unchecked);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link to="/shopping" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
        <ArrowLeft className="h-4 w-4" /> All lists
      </Link>

      <div>
        <h1 className="text-4xl font-extrabold text-zinc-900">{list.name}</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {unchecked.length} remaining · {checked.length} done
        </p>
      </div>

      {list.items.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-3xl mb-2">🧺</p>
          <p>This list is empty. Add ingredients from a recipe.</p>
        </div>
      )}

      {/* Unchecked items grouped by category */}
      {groups.map(({ category, items }) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            {category}
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} onToggle={() => toggleItem.mutate(item.id)} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
            In the cart
          </p>
          <ul className="space-y-2">
            {checked.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-100 cursor-pointer opacity-60">
                  <Checkbox
                    checked
                    onCheckedChange={() => toggleItem.mutate(item.id)}
                    className="border-zinc-300"
                  />
                  <span className="text-zinc-500 line-through leading-snug">
                    {(item.quantity != null || item.unit) && (
                      <strong>
                        {formatQuantity(item.quantity)}
                        {item.unit ? ` ${item.unit}` : ""}{" "}
                      </strong>
                    )}
                    {item.ingredient_name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
