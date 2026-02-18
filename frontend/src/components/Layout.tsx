import { Outlet } from "react-router-dom";
import Nav from "@/components/Nav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
