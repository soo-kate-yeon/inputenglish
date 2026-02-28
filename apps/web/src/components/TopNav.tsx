"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function TopNav() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const isSessionActive =
    pathname === "/home" ||
    pathname?.startsWith("/session") ||
    pathname?.startsWith("/shadowing");
  const isArchiveActive = pathname?.startsWith("/archive");

  return (
    <header
      className="h-14 flex items-center justify-between sticky top-0 z-10 bg-bg-subtle px-6"
      style={{
        borderBottom:
          "var(--border-width-strong) solid var(--color-border-default)",
      }}
    >
      {/* Left: Navigation */}
      <nav className="flex items-center gap-6">
        <Link
          href="/home"
          className={`text-base font-medium transition-colors ${
            isSessionActive ? "text-text-brand" : "text-text-muted"
          }`}
        >
          세션
        </Link>
        <Link
          href="/archive"
          className={`text-base font-medium transition-colors ${
            isArchiveActive ? "text-text-brand" : "text-text-muted"
          }`}
        >
          노트
        </Link>
      </nav>

      {/* Right: Profile Icon */}
      {isLoading ? (
        <div className="w-9 h-9 rounded-full animate-pulse bg-bg-muted" />
      ) : user ? (
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 bg-bg-muted text-text-muted"
        >
          {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
            <img
              src={user.user_metadata.avatar_url || user.user_metadata.picture}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            user.email?.[0]?.toUpperCase() || "U"
          )}
        </Link>
      ) : null}
    </header>
  );
}
