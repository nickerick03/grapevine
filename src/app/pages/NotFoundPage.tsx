import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center">
      <h1 className="text-[36px] tracking-tight text-gray-900">Page not found</h1>
      <p className="mt-2 text-[14px] text-gray-500">The page you requested does not exist.</p>
      <Link to="/explore" className="mt-5 inline-flex rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white">
        Go to Explore
      </Link>
    </div>
  );
}
