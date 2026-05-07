import { Link, NavLink } from "react-router";

import { AuthButton } from "@/components/auth/AuthButton";

const links = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/account", label: "Account" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[#fbf8f3]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-[20px] tracking-tight text-gray-900">
          Grapevine
        </Link>

        <nav className="hidden items-center gap-4 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-[13px] transition ${isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <AuthButton />
      </div>
    </header>
  );
}
