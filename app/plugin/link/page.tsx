import { requireAuth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { LinkApproveForm } from "@/components/plugin/LinkApproveForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link RuneLite",
  description: "Approve a RuneLite plugin client for your account.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where the plugin sends a member to approve pairing (step 2 of the device
 * flow -- see lib/plugin-link.ts). Requires a signed-in session: the whole
 * point is binding the code to a verified account, so an anonymous visitor
 * is bounced through Discord login and brought straight back here.
 */
export default async function PluginLinkPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code: rawCode } = await searchParams;
  const code = (rawCode ?? "").trim().toUpperCase();

  await requireAuth(`/plugin/link${code ? `?code=${encodeURIComponent(code)}` : ""}`);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="font-display text-3xl text-gnome-green mb-2">Link RuneLite</h1>
      <p className="text-bark-brown-light mb-6">
        A RuneLite client is asking to connect to your account. Only approve this if you just clicked
        &ldquo;Link this client&rdquo; in the plugin yourself.
      </p>

      {code ? (
        <Card hover={false}>
          <p className="text-xs text-iron-grey uppercase tracking-wide text-center mb-1">Code shown in RuneLite</p>
          <p className="font-mono text-3xl font-bold text-gnome-green text-center tracking-[0.3em] mb-6">{code}</p>
          <LinkApproveForm code={code} />
          <p className="text-xs text-iron-grey text-center mt-4">
            This creates a key for that client on your Account page, where you can revoke it any time.
          </p>
        </Card>
      ) : (
        <Card hover={false} className="text-center">
          <p className="text-sm text-bark-brown-light">
            No code found. Click &ldquo;Link this client&rdquo; in the RuneLite plugin to start.
          </p>
        </Card>
      )}
    </div>
  );
}
