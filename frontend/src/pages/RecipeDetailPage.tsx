import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Clock, ChefHat, Users, Trash2, ShoppingCart, Play, ArrowLeft } from "lucide-react";
import { useRecipe, useDeleteRecipe } from "@/hooks/useRecipes";
import AddToListDialog from "@/components/AddToListDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id!);
  const deleteRecipe = useDeleteRecipe();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [addToListOpen, setAddToListOpen] = useState(false);

  const toggleIngredient = (ingId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(ingId) ? next.delete(ingId) : next.add(ingId);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this recipe?")) return;
    await deleteRecipe.mutateAsync(id!);
    navigate("/recipes");
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!recipe) return <p className="text-zinc-500">Recipe not found.</p>;

  const selectedIds = Array.from(checkedIds);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link to="/recipes" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600">
        <ArrowLeft className="h-4 w-4" /> All recipes
      </Link>

      {/* Hero image */}
      {recipe.image_url && (
        <div className="h-72 rounded-2xl overflow-hidden shadow-md">
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl font-extrabold text-zinc-900 leading-tight">{recipe.title}</h1>
          <div className="flex gap-2 shrink-0">
            <Link to={`/recipes/${id}/cook`}>
              <Button className="bg-green-500 text-white hover:bg-green-600 font-bold gap-2">
                <Play className="h-4 w-4" /> Cook
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleteRecipe.isPending}
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge
                key={tag.id}
                style={{
                  backgroundColor: tag.color + "22",
                  color: tag.color,
                  borderColor: tag.color + "44",
                }}
                className="border font-medium"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          {recipe.total_time && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" />
              {recipe.total_time} min total
            </span>
          )}
          {recipe.prep_time && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-zinc-300" />
              {recipe.prep_time} min prep
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-amber-400" />
              {recipe.servings}
            </span>
          )}
          {recipe.cuisine && (
            <span className="flex items-center gap-1.5">
              <ChefHat className="h-4 w-4 text-amber-400" />
              {recipe.cuisine}
            </span>
          )}
        </div>

        {recipe.description && <p className="text-zinc-600 leading-relaxed">{recipe.description}</p>}

        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-amber-500 underline"
          >
            Original recipe
          </a>
        )}
      </div>

      <Separator />

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-zinc-900">Ingredients</h2>
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => setAddToListOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              Add {selectedIds.length} to list
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id} className="flex items-center gap-3 py-1">
              <Checkbox
                id={ing.id}
                checked={checkedIds.has(ing.id)}
                onCheckedChange={() => toggleIngredient(ing.id)}
                className="border-zinc-300"
              />
              <label htmlFor={ing.id} className="text-zinc-700 cursor-pointer leading-snug">
                {ing.quantity && (
                  <span className="font-semibold text-zinc-900">
                    {ing.quantity}
                    {ing.unit ? ` ${ing.unit}` : ""}{" "}
                  </span>
                )}
                {ing.name}
                {ing.notes && <span className="text-zinc-400 text-sm"> ({ing.notes})</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      {/* Steps */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-6">Instructions</h2>
        <ol className="space-y-6">
          {recipe.steps.map((step, i) => (
            <li key={step.id} className="flex gap-4">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-400 text-zinc-900 font-extrabold flex items-center justify-center text-sm shadow-sm">
                {i + 1}
              </span>
              <div className="pt-1 space-y-1">
                {step.title && <p className="font-semibold text-zinc-800">{step.title}</p>}
                <p className="text-zinc-600 leading-relaxed">{step.description}</p>
                {step.timer_seconds && (
                  <p className="text-xs text-amber-600 font-medium">
                    ⏱ {Math.round(step.timer_seconds / 60)} minute timer
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        recipeId={id!}
        ingredientIds={selectedIds}
      />
    </div>
  );
}
