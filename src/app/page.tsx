"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HumanLandingPage } from "@/components/landing/HumanLandingPage";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getSafeUser } from "@/lib/supabase";

function normalizeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);

  const nextPath = React.useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams],
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

  const handleGoogleLogin = () => {
    setLoadingGoogle(true);
    const currentOrigin = window.location.origin;
    const publicOrigin = getPublicSiteOrigin(currentOrigin);
    const oauthStartUrl = new URL("/auth/start", publicOrigin);
    if (nextPath) oauthStartUrl.searchParams.set("next", nextPath);
    window.location.assign(oauthStartUrl.toString());
  };

  return (
    <HumanLandingPage
      loadingGoogle={loadingGoogle}
      onGoogleLogin={handleGoogleLogin}
    />
  );
}
