import { Card } from "@/components/ui/Card";
import { CLAN_NAME, DISCORD_INVITE } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${CLAN_NAME} collects and uses data, including third-party advertising.`,
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-8">Privacy Policy</h1>

      <Card hover={false} className="space-y-6 text-sm text-bark-brown-light leading-relaxed">
        <section>
          <h2 className="font-display text-lg text-bark-brown mb-2">Account &amp; Login</h2>
          <p>
            You can sign in with Discord. We store your Discord ID, username, and avatar, along
            with any RuneScape username (RSN) you choose to link, so the site and our Discord bot
            can recognize you. We don&apos;t sell this data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-bark-brown mb-2">Advertising</h2>
          <p>
            This site shows ads served by Google AdSense. Google and its partners may use cookies
            or similar technologies to serve ads based on your prior visits to this or other
            websites. You can opt out of personalized advertising by visiting{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gnome-green hover:underline"
            >
              Google Ads Settings
            </a>
            . Ad revenue helps cover hosting and event costs for {CLAN_NAME}.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-bark-brown mb-2">Cookies</h2>
          <p>
            We use cookies to keep you signed in and remember basic preferences. Third-party ad
            and analytics providers may set their own cookies as described above.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-bark-brown mb-2">Questions</h2>
          <p>
            Reach out on our{" "}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gnome-green hover:underline"
            >
              Discord
            </a>{" "}
            if you have questions about this policy or want your data removed.
          </p>
        </section>
      </Card>
    </div>
  );
}
