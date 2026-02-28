"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

export default function DataLoader() {
  const loadUserData = useStore((state) => state.loadUserData);
  const { user, isAuthenticated, isLoading } = useAuth();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load data once when user is authenticated
    if (!isLoading && isAuthenticated && user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadUserData();
    }

    // Reset when user logs out
    if (!isAuthenticated) {
      hasLoadedRef.current = false;
    }
  }, [isLoading, isAuthenticated, user, loadUserData]);

  return null; // This component doesn't render anything
}
