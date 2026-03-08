import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string;
}

export interface TagIn {
  name: string;
  category: string;
}

export interface Creator {
  id: string;
  name: string;
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
  created_by: Creator | null;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;
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

export function useRecipes(params?: { q?: string; tag_names?: string[]; cuisine?: string; created_by_id?: string }) {
  return useQuery<RecipeListItem[]>({
    queryKey: ["recipes", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.cuisine) searchParams.set("cuisine", params.cuisine);
      if (params?.created_by_id) searchParams.set("created_by_id", params.created_by_id);
      for (const name of params?.tag_names ?? []) {
        searchParams.append("tag_names", name);
      }
      const { data } = await api.get(`/recipes?${searchParams}`);
      return data;
    },
  });
}

export function useUsers() {
  return useQuery<Creator[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });
}

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => api.get("/tags").then((r) => r.data),
  });
}

export function useUpdateRecipeTags(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tags: TagIn[]) =>
      api.put(`/tags/recipes/${recipeId}`, tags).then((r) => r.data as Recipe),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["recipe", recipeId] });
    },
    onSuccess: (updated) => {
      qc.setQueryData(["recipe", recipeId], updated);
      qc.invalidateQueries({ queryKey: ["recipes"] });
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

export interface IngredientIn {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  order: number;
}

export interface StepIn {
  title: string | null;
  description: string;
  order: number;
  timer_seconds: number | null;
}

export interface RecipeIn {
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  author: string | null;
  servings: string | null;
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  cuisine: string | null;
  tag_ids: string[];
  ingredients: IngredientIn[];
  steps: StepIn[];
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeIn) => api.post("/recipes", body).then((r) => r.data as Recipe),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeIn) => api.put(`/recipes/${id}`, body).then((r) => r.data as Recipe),
    onSuccess: (recipe) => {
      qc.setQueryData(["recipe", id], recipe);
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}
