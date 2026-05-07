interface AdSlotProps {
  label?: string;
  className?: string;
}

export function AdSlot({ label = "Ad placement reserved", className = "" }: AdSlotProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 px-3 py-2 text-center text-[12px] text-gray-500 ${className}`}
    >
      {label}
    </div>
  );
}
