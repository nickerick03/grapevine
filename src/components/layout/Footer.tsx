import { Link } from "react-router";

const links = [
  { to: "/privacy", label: "Privacy" },
  { to: "/cookies", label: "Cookies" },
  { to: "/terms", label: "Terms" },
  { to: "/impressum", label: "Impressum" },
  { to: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6">
        <p className="text-[12px] text-gray-500">Find places by character, not just stars.</p>
        <nav className="flex flex-wrap gap-3 text-[12px] text-gray-500">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-gray-800">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
