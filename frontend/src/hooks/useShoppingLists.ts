import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: string | null;
  unit: string | null;
  recipe_id: string | null;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  household_id: string;
  created_at: string;
  items: ShoppingItem[];
}

export function useShoppingLists() {
  return useQuery<ShoppingList[]>({
    queryKey: ["shopping-lists"],
    queryFn: () => api.get("/shopping").then((r) => r.data),
  });
}

export function useShoppingList(id: string) {
  return useQuery<ShoppingList>({
    queryKey: ["shopping-list", id],
    queryFn: () => api.get(`/shopping/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post("/shopping", { name }).then((r) => r.data as ShoppingList),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });
}

export function useDeleteShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });
}

export function useToggleItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api.patch(`/shopping/${listId}/items/${itemId}/check`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list", listId] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
    },
  });
}
