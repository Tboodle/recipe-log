import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAuthStore } from "@/store/auth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import RecipeListPage from "@/pages/RecipeListPage";
import RecipeDetailPage from "@/pages/RecipeDetailPage";
import CookModePage from "@/pages/CookModePage";
import ShoppingListsPage from "@/pages/ShoppingListsPage";
import ShoppingListDetailPage from "@/pages/ShoppingListDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="recipes" element={<RecipeListPage />} />
            <Route path="recipes/:id" element={<RecipeDetailPage />} />
            <Route path="shopping" element={<ShoppingListsPage />} />
            <Route path="shopping/:id" element={<ShoppingListDetailPage />} />
          </Route>
          <Route
            path="/recipes/:id/cook"
            element={
              <ProtectedRoute>
                <CookModePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
