import React from "react";

interface Props {
  className?: string;
  rounded?: "default" | "full" | "lg" | "xl" | "2xl" | "none";
}

const ROUNDED = {
  default: "rounded",
  full: "rounded-full",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  none: "",
} as const;

export default function Skeleton({ className = "", rounded = "default" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-gray-200 dark:bg-gray-800 ${ROUNDED[rounded]} ${className}`}
    />
  );
}
