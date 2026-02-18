import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useShoppingList, useToggleItem } from "@/hooks/useShoppingLists";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

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

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <ul className="space-y-2">
          {unchecked.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-zinc-200 cursor-pointer hover:border-amber-300 transition-colors">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => toggleItem.mutate(item.id)}
                  className="border-zinc-300"
                />
                <span className="text-zinc-800 leading-snug">
                  {item.quantity && (
                    <strong>
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}{" "}
                    </strong>
                  )}
                  {item.ingredient_name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

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
                    {item.quantity && (
                      <strong>
                        {item.quantity}
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
