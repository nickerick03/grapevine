import { RouterProvider, createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { ExploreScreen } from "./components/screens/ExploreScreen";
import { FilterScreen } from "./components/screens/FilterScreen";
import { DetailScreen } from "./components/screens/DetailScreen";
import { RateScreen } from "./components/screens/RateScreen";
import { SimilarScreen } from "./components/screens/SimilarScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { AuthScreen } from "./components/screens/AuthScreen";
import { NearbyScreen } from "./components/screens/NearbyScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { SavedScreen } from "./components/screens/SavedScreen";
import { AdBlockScreen } from "./components/screens/AdBlockScreen";
import { AddPlaceScreen } from "./components/screens/AddPlaceScreen";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: ExploreScreen },
      { path: "filter", Component: FilterScreen },
      { path: "detail/:id", Component: DetailScreen },
      { path: "rate/:id", Component: RateScreen },
      { path: "rate", Component: RateScreen },
      { path: "similar/:id", Component: SimilarScreen },
      { path: "similar", Component: SimilarScreen },
      { path: "profile", Component: ProfileScreen },
      { path: "auth", Component: AuthScreen },
      { path: "nearby", Component: NearbyScreen },
      { path: "saved", Component: SavedScreen },
      { path: "settings", Component: SettingsScreen },
      { path: "adblock", Component: AdBlockScreen },
      { path: "add-place", Component: AddPlaceScreen },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}