import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-body font-semibold rounded-md transition-colors duration-200 cursor-pointer",
        variant === "primary" &&
          "bg-gnome-green text-text-light hover:bg-gnome-green-light",
        variant === "secondary" &&
          "bg-bark-brown text-text-light hover:bg-bark-brown-light",
        variant === "ghost" &&
          "bg-transparent text-text-primary hover:bg-parchment-dark",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-5 py-2.5 text-base",
        size === "lg" && "px-7 py-3 text-lg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
