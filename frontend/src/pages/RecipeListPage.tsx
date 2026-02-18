import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useRecipes } from "@/hooks/useRecipes";
import RecipeCard from "@/components/RecipeCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ImportModal from "@/components/ImportModal";

export default function RecipeListPage() {
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const { data: recipes, isLoading } = useRecipes(q ? { q } : undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold text-zinc-900">Recipes</h1>
        <Button
          onClick={() => setImportOpen(true)}
          className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold gap-2 h-10"
        >
          <Plus className="h-4 w-4" />
          Add Recipe
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <Input
          placeholder="Search recipes..."
          className="pl-10 text-base h-11"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : recipes?.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <p className="text-5xl">🍳</p>
          <p className="text-xl font-bold text-zinc-700">No recipes yet</p>
          <p className="text-zinc-400">Add your first recipe to get started</p>
          <Button
            onClick={() => setImportOpen(true)}
            className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold mt-2"
          >
            Add your first recipe
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes?.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}

      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
