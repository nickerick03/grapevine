import { Outlet } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import { FilterProvider } from "./context/FilterContext";
import { UIProvider } from "./context/UIContext";
import { AuthModal } from "./components/AuthModal";
import { ProfileDrawer } from "./components/ProfileDrawer";
import { RateModal } from "./components/RateModal";
import { AdBlockWall } from "./components/AdBlockWall";

export function Root() {
  return (
    <AuthProvider>
      <FilterProvider>
        <UIProvider>
          <div className="size-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-amber-50/40 p-0 sm:p-6">
            <div className="relative w-full h-full sm:max-w-[420px] sm:h-[860px] sm:rounded-[36px] sm:shadow-[0_30px_80px_rgba(0,0,0,0.18)] sm:border sm:border-black/5 overflow-hidden bg-[#fbf8f3]">
              <Outlet />
              <AuthModal />
              <ProfileDrawer />
              <RateModal />
              {/* Ad-block wall — renders above everything when a blocker is detected */}
              <AdBlockWall />
            </div>
          </div>
        </UIProvider>
      </FilterProvider>
    </AuthProvider>
  );
}