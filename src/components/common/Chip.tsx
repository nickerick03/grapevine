interface ChipProps {
  label: string;
}

export function Chip({ label }: ChipProps) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700">
      {label}
    </span>
  );
}
