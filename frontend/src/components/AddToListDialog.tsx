import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface ShoppingList {
  id: string;
  name: string;
  items: unknown[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipeId: string;
  ingredientIds: string[];
}

export default function AddToListDialog({ open, onOpenChange, recipeId, ingredientIds }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: lists } = useQuery<ShoppingList[]>({
    queryKey: ["shopping-lists"],
    queryFn: () => api.get("/shopping").then((r) => r.data),
    enabled: open,
  });

  const addToList = useMutation({
    mutationFn: (listId: string) =>
      api.post(`/shopping/${listId}/add-from-recipe`, {
        recipe_id: recipeId,
        ingredient_ids: ingredientIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      onOpenChange(false);
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async (name: string) => {
      const { data: list } = await api.post("/shopping", { name });
      await api.post(`/shopping/${list.id}/add-from-recipe`, {
        recipe_id: recipeId,
        ingredient_ids: ingredientIds,
      });
      return list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setNewName("");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Add {ingredientIds.length} ingredient{ingredientIds.length !== 1 ? "s" : ""} to list
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {lists?.map((list) => (
            <Button
              key={list.id}
              variant="outline"
              className="w-full justify-start font-medium"
              onClick={() => addToList.mutate(list.id)}
              disabled={addToList.isPending}
            >
              {list.name}
              <span className="ml-auto text-xs text-zinc-400">{(list.items as unknown[]).length} items</span>
            </Button>
          ))}
          {lists?.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-2">No lists yet — create one below</p>
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="New list name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && createAndAdd.mutate(newName.trim())}
          />
          <Button
            disabled={!newName.trim() || createAndAdd.isPending}
            className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold shrink-0"
            onClick={() => createAndAdd.mutate(newName.trim())}
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
