import { RouterProvider, createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { ExploreScreen } from "./components/screens/ExploreScreen";
import { FilterScreen } from "./components/screens/FilterScreen";
import { DetailScreen } from "./components/screens/DetailScreen";
import { RateScreen } from "./components/screens/RateScreen";
import { SimilarScreen } from "./components/screens/SimilarScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { AuthScreen } from "./components/screens/AuthScreen";
import { ResetPasswordScreen } from "./components/screens/ResetPasswordScreen";
import { NearbyScreen } from "./components/screens/NearbyScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { SavedScreen } from "./components/screens/SavedScreen";
import { AdBlockScreen } from "./components/screens/AdBlockScreen";
import { AddPlaceScreen } from "./components/screens/AddPlaceScreen";
import { LeaderboardScreen } from "./components/screens/LeaderboardScreen";
import { PhotoEditScreen } from "./components/screens/PhotoEditScreen";
import { EditProfileScreen } from "./components/screens/EditProfileScreen";
import { PublicProfileScreen } from "./components/screens/PublicProfileScreen";
import { ProfileRatingsScreen } from "./components/screens/ProfileRatingsScreen";
import { TraitPillGuideScreen } from "./components/screens/TraitPillGuideScreen";
import { TraitPillScreen } from "./components/screens/TraitPillScreen";
import { NotFoundScreen } from "./components/screens/NotFoundScreen";
import { AuthCallbackScreen } from "./components/screens/AuthCallbackScreen";
import { PrivacyDataScreen } from "./components/screens/PrivacyDataScreen";
import {
  ContactInfoScreen,
  CookiePolicyScreen,
  DataDeletionRequestScreen,
  ImpressumScreen,
  PrivacyPolicyScreen,
  TermsOfServiceScreen,
} from "./components/screens/LegalInfoScreens";
import { ReportBugScreen } from "./components/screens/ReportBugScreen";
import { AdminOverviewScreen } from "./components/screens/AdminOverviewScreen";
import { AdminVenuesScreen } from "./components/screens/AdminVenuesScreen";
import { AdminUsersScreen } from "./components/screens/AdminUsersScreen";
import { AdminBugsScreen } from "./components/screens/AdminBugsScreen";
import { AdminFlagsScreen } from "./components/screens/AdminFlagsScreen";
import { AdminLegalScreen } from "./components/screens/AdminLegalScreen";

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
      { path: "profile/ratings", Component: ProfileRatingsScreen },
      { path: "profile/:username", Component: PublicProfileScreen },
      { path: "auth", Component: AuthScreen },
      { path: "auth/callback", Component: AuthCallbackScreen },
      { path: "/auth/callback", Component: AuthCallbackScreen },
      { path: "auth/reset", Component: ResetPasswordScreen },
      { path: "/auth/reset", Component: ResetPasswordScreen },
      { path: "nearby", Component: NearbyScreen },
      { path: "saved", Component: SavedScreen },
      { path: "settings", Component: SettingsScreen },
      { path: "adblock", Component: AdBlockScreen },
      { path: "add-place", Component: AddPlaceScreen },
      { path: "leaderboard", Component: LeaderboardScreen },
      { path: "photo-edit", Component: PhotoEditScreen },
      { path: "edit-profile", Component: EditProfileScreen },
      { path: "settings/pills", Component: TraitPillGuideScreen },
      { path: "/settings/pills", Component: TraitPillGuideScreen },
      { path: "settings/privacy-data", Component: PrivacyDataScreen },
      { path: "/settings/privacy-data", Component: PrivacyDataScreen },
      { path: "settings/privacy-policy", Component: PrivacyPolicyScreen },
      { path: "/settings/privacy-policy", Component: PrivacyPolicyScreen },
      { path: "settings/cookie-policy", Component: CookiePolicyScreen },
      { path: "/settings/cookie-policy", Component: CookiePolicyScreen },
      { path: "settings/terms-of-service", Component: TermsOfServiceScreen },
      { path: "/settings/terms-of-service", Component: TermsOfServiceScreen },
      { path: "settings/impressum", Component: ImpressumScreen },
      { path: "/settings/impressum", Component: ImpressumScreen },
      { path: "settings/data-deletion", Component: DataDeletionRequestScreen },
      { path: "/settings/data-deletion", Component: DataDeletionRequestScreen },
      { path: "settings/contact", Component: ContactInfoScreen },
      { path: "/settings/contact", Component: ContactInfoScreen },
      { path: "settings/report-bug", Component: ReportBugScreen },
      { path: "/settings/report-bug", Component: ReportBugScreen },
      { path: "admin", Component: AdminOverviewScreen },
      { path: "/admin", Component: AdminOverviewScreen },
      { path: "admin/venues", Component: AdminVenuesScreen },
      { path: "/admin/venues", Component: AdminVenuesScreen },
      { path: "admin/users", Component: AdminUsersScreen },
      { path: "/admin/users", Component: AdminUsersScreen },
      { path: "admin/flags", Component: AdminFlagsScreen },
      { path: "/admin/flags", Component: AdminFlagsScreen },
      { path: "admin/legal", Component: AdminLegalScreen },
      { path: "/admin/legal", Component: AdminLegalScreen },
      { path: "admin/bugs", Component: AdminBugsScreen },
      { path: "/admin/bugs", Component: AdminBugsScreen },
      { path: "pill/:slug", Component: TraitPillScreen },
      { path: "/pill/:slug", Component: TraitPillScreen },
      { path: "*", Component: NotFoundScreen },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
