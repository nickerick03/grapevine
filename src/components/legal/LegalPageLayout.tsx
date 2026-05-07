import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h1 className="mb-2 text-[28px] tracking-tight text-gray-900">{title}</h1>
        <p className="mb-4 text-[12px] text-gray-500">Template page. Replace TODO sections before launch.</p>
        <div className="space-y-3 text-[14px] leading-6 text-gray-700">{children}</div>
      </div>
    </div>
  );
}
