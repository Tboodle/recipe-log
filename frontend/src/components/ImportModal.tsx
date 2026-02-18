import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function ImportModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [imageError, setImageError] = useState("");

  // Fetch parsed data from URL, then save as recipe
  const urlImport = useMutation({
    mutationFn: async (url: string) => {
      const { data: parsed } = await api.post("/import/url", { url });
      const { data: recipe } = await api.post("/recipes", parsed);
      return recipe;
    },
    onSuccess: (recipe) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      onOpenChange(false);
      setUrl("");
      navigate(`/recipes/${recipe.id}`);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not parse that URL. Try a different site or use manual entry.";
      setUrlError(detail);
    },
  });

  const imageImport = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data: parsed } = await api.post("/import/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { data: recipe } = await api.post("/recipes", parsed);
      return recipe;
    },
    onSuccess: (recipe) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      onOpenChange(false);
      navigate(`/recipes/${recipe.id}`);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not read that image. Try a clearer photo.";
      setImageError(detail);
    },
  });

  const handleUrlSubmit = () => {
    setUrlError("");
    if (!url.trim()) return;
    urlImport.mutate(url.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Add a Recipe</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="url">From URL</TabsTrigger>
            <TabsTrigger value="image">From Photo</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Recipe URL</Label>
              <Input
                placeholder="https://www.allrecipes.com/recipe/..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              {urlError && <p className="text-sm text-red-500">{urlError}</p>}
            </div>
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || urlImport.isPending}
              className="w-full bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold h-11"
            >
              {urlImport.isPending ? "Importing..." : "Import Recipe"}
            </Button>
            <p className="text-xs text-zinc-400 text-center">
              Works with AllRecipes, NYT Cooking, BBC Food, and 500+ more sites
            </p>
          </TabsContent>

          {/* Photo Tab */}
          <TabsContent value="image" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Photo of a recipe card or cookbook page</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors">
                <span className="text-3xl mb-1">📷</span>
                <span className="text-sm text-zinc-500">
                  {imageImport.isPending ? "Extracting text..." : "Click to upload a photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageImport.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setImageError(""); imageImport.mutate(file); }
                  }}
                />
              </label>
              {imageError && <p className="text-sm text-red-500">{imageError}</p>}
            </div>
            <p className="text-xs text-zinc-400 text-center">
              Best results with a clear, well-lit photo of a printed recipe
            </p>
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4 pt-4">
            <p className="text-zinc-500 text-sm">
              Enter your recipe step by step using our recipe editor.
            </p>
            <Button
              className="w-full bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold h-11"
              onClick={() => {
                onOpenChange(false);
                navigate("/recipes/new");
              }}
            >
              Open Recipe Editor
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
