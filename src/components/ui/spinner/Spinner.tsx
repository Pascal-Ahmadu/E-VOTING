import React from "react";

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-[3px]",
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}

export default function Spinner({ size = "md", className = "", label = "Loading" }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${SIZES[size]} ${className}`}
    />
  );
}
