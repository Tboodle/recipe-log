import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useShoppingLists, useCreateShoppingList, useDeleteShoppingList } from "@/hooks/useShoppingLists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShoppingListsPage() {
  const { data: lists, isLoading } = useShoppingLists();
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createList.mutate(newName.trim(), { onSuccess: () => setNewName("") });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-4xl font-extrabold text-zinc-900">Shopping Lists</h1>

      {/* Create new list */}
      <div className="flex gap-2">
        <Input
          placeholder="New list name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="h-11 text-base"
        />
        <Button
          onClick={handleCreate}
          disabled={!newName.trim() || createList.isPending}
          className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold gap-2 h-11 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      {/* Lists */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : lists?.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">🛒</p>
          <p className="text-xl font-bold text-zinc-700">No lists yet</p>
          <p className="text-zinc-400">Create a list and add ingredients from your recipes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists?.map((list) => {
            const checkedCount = list.items.filter((i) => i.checked).length;
            return (
              <Card key={list.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <Link to={`/shopping/${list.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <ShoppingCart className="h-5 w-5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{list.name}</p>
                      <p className="text-xs text-zinc-400">
                        {list.items.length} items
                        {checkedCount > 0 && ` · ${checkedCount} checked`}
                      </p>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-300 hover:text-red-500 shrink-0"
                    onClick={() => deleteList.mutate(list.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
