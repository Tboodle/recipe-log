import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  household_name: z.string().min(1, "Household name is required"),
  name: z.string().min(1, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setToken, fetchMe } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const registerMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/auth/register", data).then((r) => r.data),
    onSuccess: async (data) => {
      setToken(data.access_token);
      await fetchMe();
      navigate("/");
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      setError("root", { message: detail ?? "Registration failed. Please try again." });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-4xl font-extrabold tracking-tight">
            recipe<span className="text-amber-400">log</span>
          </CardTitle>
          <p className="text-zinc-500">Create your household account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="household_name">Household name</Label>
              <Input
                id="household_name"
                placeholder="The Smith Family"
                {...register("household_name")}
              />
              {errors.household_name && (
                <p className="text-sm text-red-500">{errors.household_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" placeholder="Alice" {...register("name")} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            {errors.root && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {errors.root.message}
              </p>
            )}
            <Button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full bg-amber-400 text-zinc-900 font-bold hover:bg-amber-500 text-base h-11"
            >
              {registerMutation.isPending ? "Creating account..." : "Create household"}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-amber-500 hover:text-amber-600">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
