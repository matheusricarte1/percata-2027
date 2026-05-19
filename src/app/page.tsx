"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HumanLandingPage } from "@/components/landing/HumanLandingPage";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getSafeUser, supabase } from "@/lib/supabase";

function normalizeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);
  const autoStartRef = React.useRef(false);

  const nextPath = React.useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams],
  );

  const startGoogleOAuth = React.useCallback(
    async (origin: string) => {
      const callbackUrl = new URL("/auth/callback", origin);
      if (nextPath) {
        callbackUrl.searchParams.set("next", nextPath);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            prompt: "select_account consent",
          },
        },
      });

      if (error) {
        toast.error("Falha ao iniciar login Google: " + error.message);
        setLoadingGoogle(false);
      }
    },
    [nextPath],
  );

  React.useEffect(() => {
    const checkUser = async () => {
      const user = await getSafeUser();
      if (user) {
        router.replace("/dashboard");
      }
    };
    checkUser();
  }, [router]);

  React.useEffect(() => {
    if (autoStartRef.current) return;
    if (searchParams.get("oauth") !== "google") return;

    autoStartRef.current = true;
    setLoadingGoogle(true);
    void startGoogleOAuth(window.location.origin);
  }, [searchParams, startGoogleOAuth]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const currentOrigin = window.location.origin;
    const publicOrigin = getPublicSiteOrigin(currentOrigin);

    if (publicOrigin !== currentOrigin) {
      const canonicalLoginUrl = new URL("/login", publicOrigin);
      if (nextPath) {
        canonicalLoginUrl.searchParams.set("next", nextPath);
      }
      canonicalLoginUrl.searchParams.set("oauth", "google");
      window.location.assign(canonicalLoginUrl.toString());
      return;
    }

    await startGoogleOAuth(currentOrigin);
  };

  return (
    <HumanLandingPage
      loadingGoogle={loadingGoogle}
      onGoogleLogin={handleGoogleLogin}
    />
  );
}
