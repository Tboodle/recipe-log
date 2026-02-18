import { Link } from "react-router-dom";
import { Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RecipeListItem } from "@/hooks/useRecipes";

export default function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link to={`/recipes/${recipe.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group h-full">
        {recipe.image_url ? (
          <div className="h-44 overflow-hidden bg-zinc-100">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="h-44 bg-gradient-to-br from-amber-50 to-zinc-100 flex items-center justify-center">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-bold text-lg leading-snug text-zinc-900 line-clamp-2">
            {recipe.title}
          </h3>
          {recipe.description && (
            <p className="text-sm text-zinc-500 line-clamp-2">{recipe.description}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1 flex-wrap">
              {recipe.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  style={{
                    backgroundColor: tag.color + "22",
                    color: tag.color,
                    borderColor: tag.color + "44",
                  }}
                  className="text-xs font-medium border"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
              {recipe.total_time && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {recipe.total_time}m
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {recipe.servings}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
