import { useState } from "react";
import { Plus, Search, SlidersHorizontal, Check, X } from "lucide-react";
import { useRecipes, useTags, useUsers } from "@/hooks/useRecipes";
import RecipeCard from "@/components/RecipeCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import ImportModal from "@/components/ImportModal";

const FILTER_GROUPS: Array<{ label: string; tags: string[] }> = [
  { label: "Meal type", tags: ["Breakfast", "Brunch", "Lunch", "Dinner", "Snack", "Dessert"] },
  { label: "Protein", tags: ["Chicken", "Beef", "Pork", "Lamb", "Seafood", "Turkey", "Vegetarian", "Vegan"] },
  { label: "Cuisine", tags: ["Italian", "Mexican", "Thai", "Chinese", "Japanese", "Indian", "French", "Greek", "American", "Korean"] },
];

export default function RecipeListPage() {
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: allTags } = useTags();
  const { data: users } = useUsers();
  const customTags = allTags?.filter((t) => t.category === "custom") ?? [];

  const { data: recipes, isLoading } = useRecipes({
    q: q || undefined,
    tag_names: selectedTags.length ? selectedTags : undefined,
    created_by_id: selectedCreatorId ?? undefined,
  });

  function toggleTag(name: string) {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  const selectedCreatorName = users?.find((u) => u.id === selectedCreatorId)?.name;
  const hasFilters = selectedTags.length > 0 || selectedCreatorId !== null;
  const filterCount = selectedTags.length + (selectedCreatorId ? 1 : 0);

  function clearAll() {
    setSelectedTags([]);
    setSelectedCreatorId(null);
  }

  return (
    <div className="space-y-5">
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

      {/* Search + Filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search recipes..."
            className="pl-10 text-base h-11"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`h-11 gap-2 ${hasFilters ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100" : ""}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {hasFilters && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-zinc-900 text-[10px] font-bold">
                  {filterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search filters..." />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                {/* Creator filter — only shown when >1 user exists */}
                {users && users.length > 1 && (
                  <span key="creator">
                    <CommandGroup heading="Added by">
                      {users.map((user) => {
                        const selected = selectedCreatorId === user.id;
                        return (
                          <CommandItem
                            key={user.id}
                            value={user.name}
                            onSelect={() => setSelectedCreatorId(selected ? null : user.id)}
                            className="cursor-pointer"
                          >
                            <span className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${selected ? "border-amber-400 bg-amber-400" : "border-zinc-300"}`}>
                              {selected && <Check className="h-3 w-3 text-zinc-900" />}
                            </span>
                            {user.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandSeparator />
                  </span>
                )}

                {FILTER_GROUPS.map((group, i) => (
                  <span key={group.label}>
                    {i > 0 && <CommandSeparator />}
                    <CommandGroup heading={group.label}>
                      {group.tags.map((name) => {
                        const selected = selectedTags.includes(name);
                        return (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => toggleTag(name)}
                            className="cursor-pointer"
                          >
                            <span className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${selected ? "border-amber-400 bg-amber-400" : "border-zinc-300"}`}>
                              {selected && <Check className="h-3 w-3 text-zinc-900" />}
                            </span>
                            {name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </span>
                ))}
                {customTags.length > 0 && (
                  <span key="custom">
                    <CommandSeparator />
                    <CommandGroup heading="Custom">
                      {customTags.map(({ name }) => {
                        const selected = selectedTags.includes(name);
                        return (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => toggleTag(name)}
                            className="cursor-pointer"
                          >
                            <span className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${selected ? "border-amber-400 bg-amber-400" : "border-zinc-300"}`}>
                              {selected && <Check className="h-3 w-3 text-zinc-900" />}
                            </span>
                            {name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </span>
                )}
              </CommandList>
              {hasFilters && (
                <div className="border-t p-1">
                  <button
                    onClick={clearAll}
                    className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 py-1.5 rounded hover:bg-zinc-50 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCreatorName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              {selectedCreatorName}
              <button onClick={() => setSelectedCreatorId(null)} className="hover:opacity-70 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedTags.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium"
            >
              {name}
              <button onClick={() => toggleTag(name)} className="hover:opacity-70 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : recipes?.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <p className="text-5xl">🍳</p>
          {hasFilters || q ? (
            <>
              <p className="text-xl font-bold text-zinc-700">No recipes match</p>
              <p className="text-zinc-400">Try adjusting your search or filters</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-zinc-700">No recipes yet</p>
              <p className="text-zinc-400">Add your first recipe to get started</p>
              <Button
                onClick={() => setImportOpen(true)}
                className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold mt-2"
              >
                Add your first recipe
              </Button>
            </>
          )}
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
