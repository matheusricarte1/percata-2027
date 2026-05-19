"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HumanLandingPage } from "@/components/landing/HumanLandingPage";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { getSafeUser, supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);

  React.useEffect(() => {
    const checkUser = async () => {
      const user = await getSafeUser();
      if (user) {
        router.replace("/dashboard");
      }
    };
    checkUser();
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl(window.location.origin),
        queryParams: {
          prompt: "select_account consent",
        },
      },
    });

    if (error) {
      toast.error("Falha ao iniciar login Google: " + error.message);
      setLoadingGoogle(false);
    }
  };

  return (
    <HumanLandingPage
      loadingGoogle={loadingGoogle}
      onGoogleLogin={handleGoogleLogin}
    />
  );
}
