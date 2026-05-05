"use client";

import { cn } from "@/shared/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

interface UserAvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

const AVATAR_COLORS = [
  "bg-[#2d2b52] text-[#a89fff]", // brand purple
  "bg-[#1a2d3a] text-[#5fb3d4]", // teal
  "bg-[#2a1f3d] text-[#c084fc]", // violet
  "bg-[#1e2d1e] text-[#4ade80]", // green
  "bg-[#2d2218] text-[#fb923c]", // amber
  "bg-[#2d1a1a] text-[#f87171]", // rose
  "bg-[#1a2040] text-[#60a5fa]", // blue
  "bg-[#241a2d] text-[#e879f9]", // fuchsia
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
};

export function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  const fallback = name?.trim() ? name : "?";
  return (
    <div
      aria-label={fallback}
      className={cn(
        "rounded-full flex items-center justify-center font-semibold shrink-0",
        "select-none",
        SIZE_CLASSES[size],
        getColor(fallback),
        className,
      )}
    >
      {getInitials(fallback)}
    </div>
  );
}
