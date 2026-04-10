"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CLAN_NAME } from "@/lib/constants";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/account";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscordLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          scopes: "identify guilds",
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch {
      setError("Failed to initiate Discord login. Make sure Supabase is configured.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card hover={false} className="max-w-md w-full text-center py-10 px-8">
        <h1 className="font-display text-3xl text-gnome-green mb-2">
          Welcome to {CLAN_NAME}
        </h1>
        <p className="text-bark-brown-light mb-8">
          Log in with your Discord account to link your RSN, access the admin
          panel, and more.
        </p>

        <Button
          onClick={handleDiscordLogin}
          disabled={loading}
          size="lg"
          className="w-full gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
          </svg>
          {loading ? "Connecting..." : "Login with Discord"}
        </Button>

        {error && (
          <p className="text-red-accent text-sm mt-4">{error}</p>
        )}

        <p className="text-xs text-iron-grey mt-6">
          By logging in, you agree to let us access your Discord profile
          information to verify your membership.
        </p>
      </Card>
    </div>
  );
}
