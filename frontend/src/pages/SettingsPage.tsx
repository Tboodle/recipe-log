import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw } from "lucide-react";

interface InviteOut {
  invite_url: string;
  token: string;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: invite, isLoading } = useQuery<InviteOut>({
    queryKey: ["household-invite"],
    queryFn: () => api.post("/households/invite").then((r) => r.data),
  });

  const regenerate = useMutation({
    mutationFn: () => api.delete("/households/invite"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["household-invite"] }),
  });

  const copyLink = () => {
    if (!invite) return;
    navigator.clipboard.writeText(invite.invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-800">Invite family members</h2>
        <p className="text-sm text-zinc-500">
          Share this link with anyone you want to add to your household. They'll join automatically when they sign in.
        </p>

        {isLoading && <p className="text-sm text-zinc-400">Generating link...</p>}

        {invite && (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {invite.invite_url}
            </code>
            <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-zinc-500"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending || isLoading}
        >
          <RefreshCw className="h-4 w-4" />
          {regenerate.isPending ? "Regenerating..." : "Regenerate link"}
        </Button>
        <p className="text-xs text-zinc-400">
          Regenerating creates a new link and invalidates the old one.
        </p>
      </section>
    </div>
  );
}
