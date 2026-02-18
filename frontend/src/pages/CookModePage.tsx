import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Timer, RotateCcw } from "lucide-react";
import { useRecipe } from "@/hooks/useRecipes";
import { Button } from "@/components/ui/button";

export default function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const { data: recipe } = useRecipe(id!);
  const [stepIndex, setStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const steps = recipe?.steps ?? [];
  const currentStep = steps[stepIndex];

  // Reset timer when step changes
  useEffect(() => {
    setTimeLeft(currentStep?.timer_seconds ?? null);
    setTimerRunning(false);
  }, [stepIndex, currentStep?.timer_seconds]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning || timeLeft === null || timeLeft <= 0) {
      if (timeLeft === 0) setTimerRunning(false);
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(id);
  }, [timerRunning, timeLeft]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const goNext = useCallback(() => setStepIndex((i) => Math.min(steps.length - 1, i + 1)), [steps.length]);
  const goPrev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (!recipe) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-zinc-900 text-white flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="max-w-xs">
          <p className="text-zinc-400 text-sm font-medium truncate">{recipe.title}</p>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mt-0.5">
            Step {stepIndex + 1} / {steps.length}
          </p>
        </div>
        <Link to={`/recipes/${id}`}>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-4 overflow-auto">
        {currentStep?.title && (
          <p className="text-zinc-300 font-semibold text-lg mb-3">{currentStep.title}</p>
        )}
        <p className="text-white text-2xl sm:text-3xl font-semibold leading-relaxed">
          {currentStep?.description}
        </p>

        {/* Timer */}
        {timeLeft !== null && (
          <div className="flex items-center gap-4 mt-8">
            <div
              className={`text-5xl font-mono font-bold tabular-nums ${
                timeLeft === 0 ? "text-green-400" : "text-amber-400"
              }`}
            >
              {formatTime(timeLeft)}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-600 text-white hover:bg-zinc-800 gap-1.5"
                onClick={() => setTimerRunning((r) => !r)}
                disabled={timeLeft === 0}
              >
                <Timer className="h-4 w-4" />
                {timerRunning ? "Pause" : timeLeft === 0 ? "Done!" : "Start"}
              </Button>
              {currentStep?.timer_seconds && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-white"
                  onClick={() => {
                    setTimeLeft(currentStep.timer_seconds!);
                    setTimerRunning(false);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-10 pt-4">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              className={`rounded-full transition-all duration-200 ${
                i === stepIndex
                  ? "w-6 h-2 bg-amber-400"
                  : i < stepIndex
                  ? "w-2 h-2 bg-zinc-500"
                  : "w-2 h-2 bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-zinc-400 hover:text-white gap-2 text-base"
            onClick={goPrev}
            disabled={stepIndex === 0}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>

          {isLast ? (
            <Link to={`/recipes/${id}`}>
              <Button className="bg-green-500 text-white hover:bg-green-600 font-bold text-base px-8">
                Done! 🎉
              </Button>
            </Link>
          ) : (
            <Button
              className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold text-base gap-2 px-8"
              onClick={goNext}
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
