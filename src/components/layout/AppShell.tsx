import { Outlet } from "react-router";

import { Footer } from "./Footer";
import { Header } from "./Header";

export function AppShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 to-amber-50/50 text-gray-900">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
