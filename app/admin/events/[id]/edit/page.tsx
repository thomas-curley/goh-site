"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { EventFormFields, EMPTY_FORM, eventTemplateData } from "@/components/admin/EventFormFields";
import type { EventForm } from "@/components/admin/EventFormFields";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { renderTemplate } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";
import { usePermission } from "@/lib/use-permission";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [discordMessageId, setDiscordMessageId] = useState<string | null>(null);
  const [signupThreadMessageId, setSignupThreadMessageId] = useState<string | null>(null);

  const [syncDiscordPost, setSyncDiscordPost] = useState(true);
  const [syncSignupThread, setSyncSignupThread] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [signupThreadTemplateId, setSignupThreadTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);

  const { allowed: canSyncDiscord, loading: permLoading } = usePermission("sync_discord_posts");

  const update = (field: keyof EventForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setForm({
      title: data.title ?? "",
      description: data.description ?? "",
      event_type: data.event_type ?? "pvm",
      start_time: toDatetimeLocal(data.start_time),
      end_time: toDatetimeLocal(data.end_time),
      host_rsn: data.host_rsn ?? "",
      world: data.world ? String(data.world) : "",
      location: data.location ?? "",
      meet_location: data.meet_location ?? "",
      spots: data.spots ?? "Open",
      signup_type: data.signup_type ?? "",
      voice_channel: data.voice_channel ?? "",
      requirements: data.requirements ?? "",
      requirements_list: data.requirements_list ?? "",
      guide_text: data.guide_text ?? "",
      video_url: data.video_url ?? "",
      prize_pool: data.prize_pool ?? "",
      banner_url: data.banner_url ?? "",
      extra_images: [],
      ping_roles: [],
      post_to_discord: false,
      create_signup_thread: false,
    });
    setDiscordMessageId(data.discord_message_id ?? null);
    setSignupThreadMessageId(data.signup_thread_message_id ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  useEffect(() => {
    if (!templateId) {
      setTemplateSections([]);
      return;
    }
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("post_templates")
        .select("sections")
        .eq("id", templateId)
        .single();
      setTemplateSections(data?.sections ?? []);
    })();
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          world: form.world ? parseInt(form.world) : null,
          start_time: form.start_time ? new Date(form.start_time).toISOString() : undefined,
          end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
          sync_discord_post: canSyncDiscord && syncDiscordPost && !!discordMessageId,
          sync_signup_thread: canSyncDiscord && syncSignupThread && !!signupThreadMessageId,
          templateId,
          signupThreadTemplateId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const errors: string[] = data.sync?.errors ?? [];
        setStatus({
          type: errors.length > 0 ? "error" : "success",
          message: errors.length > 0 ? `Event updated. ${errors.join(" ")}` : "Event updated!",
        });
      } else {
        setStatus({ type: "error", message: data.error ?? "Failed to update event." });
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return <p className="text-bark-brown-light">Event not found.</p>;
  }

  const preview = renderTemplate(templateSections, eventTemplateData(form));

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Edit Event</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <EventFormFields form={form} update={update} setForm={setForm} />

          {/* Discord sync — only shown if this event has something postable and the user has permission */}
          {!permLoading && canSyncDiscord && (discordMessageId || signupThreadMessageId) && (
            <Card hover={false}>
              <h2 className="font-display text-lg text-bark-brown mb-4">Update Discord</h2>

              {discordMessageId && (
                <>
                  <label className="flex items-center gap-2 text-sm text-bark-brown-light mb-3">
                    <input type="checkbox" checked={syncDiscordPost} onChange={(e) => setSyncDiscordPost(e.target.checked)} />
                    Update the Discord event post
                  </label>
                  {syncDiscordPost && (
                    <div className="mb-4 ml-6">
                      <TemplateSelector contentType="event_post" value={templateId} onChange={setTemplateId} label="Event Post Template" />
                    </div>
                  )}
                </>
              )}

              {signupThreadMessageId && (
                <>
                  <label className="flex items-center gap-2 text-sm text-bark-brown-light mb-3">
                    <input type="checkbox" checked={syncSignupThread} onChange={(e) => setSyncSignupThread(e.target.checked)} />
                    Update the signup thread
                  </label>
                  {syncSignupThread && (
                    <div className="ml-6">
                      <TemplateSelector contentType="signup_thread" value={signupThreadTemplateId} onChange={setSignupThreadTemplateId} label="Signup Thread Template" />
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
            {status && (
              <span className={`text-sm ${status.type === "error" ? "text-red-accent" : "text-gnome-green"}`}>
                {status.message}
              </span>
            )}
          </div>
        </form>

        {/* Live Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
          <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
              {preview || <span className="text-[#72767d]">Select a template above to preview the update.</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
