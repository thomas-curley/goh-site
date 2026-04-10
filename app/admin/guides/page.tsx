import { Card } from "@/components/ui/Card";

export default function AdminGuidesPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">
        Manage Guides
      </h1>

      <Card hover={false}>
        <h2 className="font-display text-xl text-bark-brown mb-4">
          Guide Content Editor
        </h2>
        <p className="text-sm text-bark-brown-light mb-4">
          Guides are currently managed as MDX files in the{" "}
          <code className="font-mono text-gnome-green bg-parchment-dark px-1 rounded">
            /content/guides/
          </code>{" "}
          directory. You can edit them directly or submit changes via GitHub.
        </p>
        <div className="space-y-3">
          <div className="text-sm">
            <h3 className="font-semibold text-bark-brown">Current Guide Files:</h3>
            <ul className="mt-2 space-y-1 text-bark-brown-light">
              <li>
                <code className="font-mono text-xs">content/guides/raids/chambers-of-xeric.mdx</code>
              </li>
            </ul>
          </div>
          <div className="text-sm text-iron-grey border-t border-parchment-dark pt-3">
            A rich markdown editor will be added here when Supabase CMS (Option B)
            is implemented. For now, edit the MDX files directly.
          </div>
        </div>
      </Card>
    </div>
  );
}
