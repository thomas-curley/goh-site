import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "card-wood p-4 transition-shadow duration-200",
        hover && "hover:shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
