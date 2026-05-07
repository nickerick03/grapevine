interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
      <h3 className="text-[16px] text-gray-900">{title}</h3>
      <p className="mt-2 text-[13px] text-gray-500">{message}</p>
    </div>
  );
}
