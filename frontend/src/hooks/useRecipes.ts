import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cuisine: string | null;
  total_time: number | null;
  servings: string | null;
  tags: Tag[];
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  order: number;
}

export interface Step {
  id: string;
  title: string | null;
  description: string;
  order: number;
  timer_seconds: number | null;
}

export interface Recipe extends RecipeListItem {
  household_id: string;
  source_url: string | null;
  author: string | null;
  prep_time: number | null;
  cook_time: number | null;
  category: string | null;
  cooking_method: string | null;
  suitable_for_diet: string[] | null;
  nutrition: Record<string, unknown> | null;
  updated_at: string;
  ingredients: Ingredient[];
  steps: Step[];
}

export function useRecipes(params?: { q?: string; tag_id?: string; cuisine?: string }) {
  return useQuery<RecipeListItem[]>({
    queryKey: ["recipes", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.tag_id) searchParams.set("tag_id", params.tag_id);
      if (params?.cuisine) searchParams.set("cuisine", params.cuisine);
      const { data } = await api.get(`/recipes?${searchParams}`);
      return data;
    },
  });
}

export function useRecipe(id: string) {
  return useQuery<Recipe>({
    queryKey: ["recipe", id],
    queryFn: () => api.get(`/recipes/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/recipes", body).then((r) => r.data as Recipe),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}
