interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className = "h-9 w-auto max-w-[3.4rem]" }: AppLogoProps) {
  return (
    <img
      src="/grapevinelogo_new.svg"
      alt="Grapevine"
      className={`${className} object-contain flex-none`}
      draggable={false}
    />
  );
}
