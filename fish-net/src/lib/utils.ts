import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getKoreanRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    reading1: "1독서",
    reading2: "2독서",
    commentary: "해설",
    accompaniment: "반주",
    prayer: "우리의 기도",
  };
  return roleNames[role] || role;
}

export function getAvailabilityLabel(
  status: "available" | "unavailable" | "uncertain"
): string {
  const labels: Record<string, string> = {
    available: "가능",
    unavailable: "불가능",
    uncertain: "애매",
  };
  return labels[status] || status;
}

export function getAvailabilityColor(
  status: "available" | "unavailable" | "uncertain"
): string {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    unavailable: "bg-red-100 text-red-800",
    uncertain: "bg-yellow-100 text-yellow-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}
