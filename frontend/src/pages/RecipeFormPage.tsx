import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useRecipe, useCreateRecipe, useUpdateRecipe } from "@/hooks/useRecipes";
import type { Recipe, RecipeIn } from "@/hooks/useRecipes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// ── Local form row types ──────────────────────────────────────────────────────

interface IngRow {
  _key: string;
  quantity: string;
  unit: string;
  name: string;
  notes: string;
}

interface StepRow {
  _key: string;
  title: string;
  description: string;
  timer_minutes: string;
}

function newIng(): IngRow {
  return { _key: crypto.randomUUID(), quantity: "", unit: "", name: "", notes: "" };
}

function newStep(): StepRow {
  return { _key: crypto.randomUUID(), title: "", description: "", timer_minutes: "" };
}

// ── Conversions ───────────────────────────────────────────────────────────────

function recipeToState(recipe: Recipe) {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    image_url: recipe.image_url ?? "",
    source_url: recipe.source_url ?? "",
    author: recipe.author ?? "",
    servings: recipe.servings ?? "",
    prep_time: recipe.prep_time?.toString() ?? "",
    cook_time: recipe.cook_time?.toString() ?? "",
    total_time: recipe.total_time?.toString() ?? "",
    cuisine: recipe.cuisine ?? "",
    ingredients: recipe.ingredients
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((ing) => ({
        _key: crypto.randomUUID(),
        quantity: ing.quantity?.toString() ?? "",
        unit: ing.unit ?? "",
        name: ing.name,
        notes: ing.notes ?? "",
      })),
    steps: recipe.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        _key: crypto.randomUUID(),
        title: step.title ?? "",
        description: step.description,
        timer_minutes: step.timer_seconds ? String(Math.round(step.timer_seconds / 60)) : "",
      })),
    tag_ids: recipe.tags.map((t) => t.id),
  };
}

function stateToRecipeIn(state: ReturnType<typeof defaultState>, tag_ids: string[]): RecipeIn {
  const num = (s: string) => (s.trim() ? parseFloat(s) : null);
  return {
    title: state.title.trim(),
    description: state.description.trim() || null,
    image_url: state.image_url.trim() || null,
    source_url: state.source_url.trim() || null,
    author: state.author.trim() || null,
    servings: state.servings.trim() || null,
    prep_time: num(state.prep_time),
    cook_time: num(state.cook_time),
    total_time: num(state.total_time),
    cuisine: state.cuisine.trim() || null,
    tag_ids,
    ingredients: state.ingredients
      .filter((ing) => ing.name.trim())
      .map((ing, i) => ({
        name: ing.name.trim(),
        quantity: num(ing.quantity),
        unit: ing.unit.trim() || null,
        notes: ing.notes.trim() || null,
        order: i,
      })),
    steps: state.steps
      .filter((step) => step.description.trim())
      .map((step, i) => ({
        title: step.title.trim() || null,
        description: step.description.trim(),
        timer_seconds: step.timer_minutes ? Math.round(parseFloat(step.timer_minutes) * 60) : null,
        order: i,
      })),
  };
}

function defaultState() {
  return {
    title: "",
    description: "",
    image_url: "",
    source_url: "",
    author: "",
    servings: "",
    prep_time: "",
    cook_time: "",
    total_time: "",
    cuisine: "",
    ingredients: [newIng()],
    steps: [newStep()],
    tag_ids: [] as string[],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useRecipe(id ?? "");
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe(id ?? "");

  const [form, setForm] = useState(defaultState);
  const [initialized, setInitialized] = useState(!isEdit);

  // Pre-fill form when editing
  useEffect(() => {
    if (existing && !initialized) {
      const s = recipeToState(existing);
      setForm({ ...s });
      setInitialized(true);
    }
  }, [existing, initialized]);

  if (isEdit && isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function updateIng(key: string, field: keyof IngRow, value: string) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing) =>
        ing._key === key ? { ...ing, [field]: value } : ing
      ),
    }));
  }

  function removeIng(key: string) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((ing) => ing._key !== key) }));
  }

  function updateStep(key: string, field: keyof StepRow, value: string) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((step) =>
        step._key === key ? { ...step, [field]: value } : step
      ),
    }));
  }

  function removeStep(key: string) {
    setForm((f) => ({ ...f, steps: f.steps.filter((step) => step._key !== key) }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    const body = stateToRecipeIn(form, form.tag_ids);
    if (isEdit) {
      const updated = await updateRecipe.mutateAsync(body);
      navigate(`/recipes/${updated.id}`);
    } else {
      const created = await createRecipe.mutateAsync(body);
      navigate(`/recipes/${created.id}`);
    }
  }

  const isPending = createRecipe.isPending || updateRecipe.isPending;
  const backTo = isEdit ? `/recipes/${id}` : "/";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={backTo} className="text-zinc-400 hover:text-zinc-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-extrabold text-zinc-900">
            {isEdit ? "Edit Recipe" : "New Recipe"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(backTo)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || isPending}
            className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold"
          >
            {isPending ? "Saving…" : "Save Recipe"}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Chicken Tikka Masala"
            className="text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A brief description of the recipe…"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source_url">Source URL</Label>
            <Input
              id="source_url"
              value={form.source_url}
              onChange={(e) => set("source_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              value={form.servings}
              onChange={(e) => set("servings", e.target.value)}
              placeholder="e.g. 4 or 4–6"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cuisine">Cuisine</Label>
            <Input
              id="cuisine"
              value={form.cuisine}
              onChange={(e) => set("cuisine", e.target.value)}
              placeholder="e.g. Italian"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
              placeholder="e.g. Julia Child"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="prep_time">Prep time (min)</Label>
            <Input
              id="prep_time"
              type="number"
              min="0"
              value={form.prep_time}
              onChange={(e) => set("prep_time", e.target.value)}
              placeholder="15"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cook_time">Cook time (min)</Label>
            <Input
              id="cook_time"
              type="number"
              min="0"
              value={form.cook_time}
              onChange={(e) => set("cook_time", e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="total_time">Total time (min)</Label>
            <Input
              id="total_time"
              type="number"
              min="0"
              value={form.total_time}
              onChange={(e) => set("total_time", e.target.value)}
              placeholder="45"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Ingredients */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-zinc-900">Ingredients</h2>
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[80px_90px_1fr_1fr_32px] gap-2 px-1">
            <span className="text-xs text-zinc-400 font-medium">Qty</span>
            <span className="text-xs text-zinc-400 font-medium">Unit</span>
            <span className="text-xs text-zinc-400 font-medium">Ingredient</span>
            <span className="text-xs text-zinc-400 font-medium">Notes</span>
            <span />
          </div>

          {form.ingredients.map((ing) => (
            <div key={ing._key} className="grid grid-cols-[80px_90px_1fr_1fr_32px] gap-2 items-center">
              <Input
                value={ing.quantity}
                onChange={(e) => updateIng(ing._key, "quantity", e.target.value)}
                placeholder="2"
                className="h-9 text-sm"
              />
              <Input
                value={ing.unit}
                onChange={(e) => updateIng(ing._key, "unit", e.target.value)}
                placeholder="cups"
                className="h-9 text-sm"
              />
              <Input
                value={ing.name}
                onChange={(e) => updateIng(ing._key, "name", e.target.value)}
                placeholder="flour"
                className="h-9 text-sm"
              />
              <Input
                value={ing.notes}
                onChange={(e) => updateIng(ing._key, "notes", e.target.value)}
                placeholder="sifted"
                className="h-9 text-sm"
              />
              <button
                onClick={() => removeIng(ing._key)}
                className="flex items-center justify-center text-zinc-300 hover:text-red-400 transition-colors"
                aria-label="Remove ingredient"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-dashed text-zinc-400 hover:text-zinc-600"
          onClick={() => setForm((f) => ({ ...f, ingredients: [...f.ingredients, newIng()] }))}
        >
          <Plus className="h-3.5 w-3.5" /> Add ingredient
        </Button>
      </div>

      <Separator />

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-900">Instructions</h2>

        {form.steps.map((step, i) => (
          <div key={step._key} className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400 text-zinc-900 font-extrabold flex items-center justify-center text-sm mt-1">
              {i + 1}
            </span>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(step._key, "title", e.target.value)}
                  placeholder="Step title (optional)"
                  className="h-8 text-sm flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    min="0"
                    value={step.timer_minutes}
                    onChange={(e) => updateStep(step._key, "timer_minutes", e.target.value)}
                    placeholder="Timer (min)"
                    className="h-8 text-sm w-32"
                  />
                </div>
                <button
                  onClick={() => removeStep(step._key)}
                  className="flex items-center text-zinc-300 hover:text-red-400 transition-colors mt-0.5"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={step.description}
                onChange={(e) => updateStep(step._key, "description", e.target.value)}
                placeholder="Describe this step…"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-dashed text-zinc-400 hover:text-zinc-600 ml-11"
          onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, newStep()] }))}
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </div>
    </div>
  );
}
