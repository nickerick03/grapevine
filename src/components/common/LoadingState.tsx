interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-[13px] text-gray-500">
      {label}
    </div>
  );
}
