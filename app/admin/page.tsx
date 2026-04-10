import { Card } from "@/components/ui/Card";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/events">
          <Card>
            <h3 className="font-display text-lg text-bark-brown mb-1">Events</h3>
            <p className="text-sm text-bark-brown-light">
              Create, edit, and manage clan events. Syncs with Discord.
            </p>
          </Card>
        </Link>

        <Link href="/admin/guides">
          <Card>
            <h3 className="font-display text-lg text-bark-brown mb-1">Guides</h3>
            <p className="text-sm text-bark-brown-light">
              Edit guide content with the markdown editor.
            </p>
          </Card>
        </Link>

        <Card hover={false}>
          <h3 className="font-display text-lg text-bark-brown mb-1">
            Announcements
          </h3>
          <p className="text-sm text-bark-brown-light">
            Manage news and announcements on the home page.
          </p>
          <span className="text-xs text-iron-grey mt-2 inline-block">
            Coming with Supabase integration
          </span>
        </Card>
      </div>
    </div>
  );
}
