import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateRecipeTags, useTags } from "@/hooks/useRecipes";
import type { Tag, TagIn } from "@/hooks/useRecipes";

const PREDEFINED: Record<string, { label: string; tags: string[] }> = {
  meal_type: {
    label: "Meal type",
    tags: ["Breakfast", "Brunch", "Lunch", "Dinner", "Snack", "Dessert"],
  },
  protein: {
    label: "Protein",
    tags: ["Chicken", "Beef", "Pork", "Lamb", "Seafood", "Turkey", "Vegetarian", "Vegan"],
  },
  cuisine: {
    label: "Cuisine",
    tags: ["Italian", "Mexican", "Thai", "Chinese", "Japanese", "Indian", "French", "Greek", "American", "Korean"],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  meal_type: "#f59e0b",
  protein: "#f43f5e",
  cuisine: "#7c3aed",
  custom: "#84cc16",
};

interface Props {
  recipeId: string;
  tags: Tag[];
}

export default function TagEditor({ recipeId, tags }: Props) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [optimisticTags, setOptimisticTags] = useState<Tag[]>(tags);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTagsRef = useRef<TagIn[]>([]);
  const updateTags = useUpdateRecipeTags(recipeId);
  const { data: allTags } = useTags();
  const existingCustomTags = allTags?.filter((t) => t.category === "custom") ?? [];

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Sync local state when server data changes (but not mid-edit)
  useEffect(() => {
    if (!debounceRef.current) {
      setOptimisticTags(tags);
    }
  }, [tags]);

  const tagNames = new Set(optimisticTags.map((t) => t.name));

  function toTagIn(tag: Tag): TagIn {
    return { name: tag.name, category: tag.category };
  }

  function scheduleUpdate(next: Tag[]) {
    // Update UI immediately
    setOptimisticTags(next);
    pendingTagsRef.current = next.map(toTagIn);
    // Debounce: cancel any queued API call and restart the timer
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      updateTags.mutate(pendingTagsRef.current, {
        // Sync from the real server response once it arrives
        onSuccess: (updated) => setOptimisticTags(updated.tags),
      });
    }, 350);
  }

  function addTag(name: string, category: string) {
    if (tagNames.has(name)) return;
    const tempTag: Tag = { id: `temp-${name}`, name, category, color: CATEGORY_COLORS[category] ?? "#84cc16" };
    scheduleUpdate([...optimisticTags, tempTag]);
  }

  function removeTag(name: string) {
    scheduleUpdate(optimisticTags.filter((t) => t.name !== name));
  }

  function handleCustomSubmit() {
    const name = customInput.trim();
    if (!name) return;
    addTag(name, "custom");
    setCustomInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {optimisticTags.map((tag) => {
        const color = tag.color;
        return (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium"
            style={{
              backgroundColor: color + "22",
              color,
              borderColor: color + "44",
            }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.name)}
              className="hover:opacity-70 transition-opacity ml-0.5"
              aria-label={`Remove ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 rounded-full border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-3 space-y-3">
          {Object.entries(PREDEFINED).map(([category, { label, tags: options }]) => {
            const color = CATEGORY_COLORS[category];
            return (
              <div key={category}>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((name) => {
                    const active = tagNames.has(name);
                    return (
                      <button
                        key={name}
                        onClick={() => active ? removeTag(name) : addTag(name, category)}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors"
                        style={
                          active
                            ? { backgroundColor: color + "22", color, borderColor: color + "44" }
                            : { backgroundColor: "transparent", color: "#71717a", borderColor: "#d4d4d8" }
                        }
                      >
                        {active && <X className="h-3 w-3 mr-1" />}
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Custom</p>
            {existingCustomTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {existingCustomTags.map(({ name }) => {
                  const active = tagNames.has(name);
                  const color = CATEGORY_COLORS.custom;
                  return (
                    <button
                      key={name}
                      onClick={() => active ? removeTag(name) : addTag(name, "custom")}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors"
                      style={
                        active
                          ? { backgroundColor: color + "22", color, borderColor: color + "44" }
                          : { backgroundColor: "transparent", color: "#71717a", borderColor: "#d4d4d8" }
                      }
                    >
                      {active && <X className="h-3 w-3 mr-1" />}
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="Type a tag…"
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                onClick={handleCustomSubmit}
                disabled={!customInput.trim()}
                className="h-7 px-3 bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold text-xs"
              >
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
