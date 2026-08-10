"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TemplateSelector } from "@/components/admin/TemplateSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { EventFormFields, EMPTY_FORM, eventTemplateData } from "@/components/admin/EventFormFields";
import type { EventForm } from "@/components/admin/EventFormFields";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { renderTemplate, getUsedFields } from "@/lib/post-templates";
import type { SectionInstance } from "@/lib/post-templates";

export default function AdminEventsPage() {
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [signupThreadTemplateId, setSignupThreadTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<SectionInstance[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [destination, setDestination] = useState("");

  const update = (field: keyof EventForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!templateId) {
      setTemplateSections([]);
      setSectionsLoaded(false);
      return;
    }
    // Deliberately doesn't reset sectionsLoaded/templateSections to their
    // "unloaded" state before the fetch — keeps showing the previous
    // template's fields until the new one is ready, instead of the form
    // flashing to "everything hidden" or "everything shown" mid-switch.
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("post_templates")
        .select("sections")
        .eq("id", templateId)
        .single();
      setTemplateSections(data?.sections ?? []);
      setSectionsLoaded(true);
    })();
  }, [templateId]);

  // Only narrow the visible fields once we've actually loaded a template's
  // sections, and only while posting to Discord is on — otherwise (still
  // loading, or not posting to Discord at all) show every field.
  const visibleFields = form.post_to_discord && sectionsLoaded ? getUsedFields(templateSections) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          world: form.world ? parseInt(form.world) : null,
          start_time: form.start_time ? new Date(form.start_time).toISOString() : undefined,
          end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
          templateId,
          signupThreadTemplateId,
          destination,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const discordNote = form.post_to_discord
          ? " and posted to Discord"
          : "";
        const threadNote = data.signup_thread_created
          ? " + sign-up thread created"
          : "";
        setStatus({
          type: "success",
          message: `Event "${form.title}" created${discordNote}${threadNote}!`,
        });
        setForm(EMPTY_FORM);
        setDestination("");
      } else {
        setStatus({ type: "error", message: data.error ?? "Failed to create event." });
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  const preview = renderTemplate(templateSections, eventTemplateData(form));

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-6">Create Event</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Post to Discord — up top since it controls which fields below are shown */}
          <Card hover={false}>
            <div className="flex items-start gap-3 mb-4">
              <button
                type="button"
                onClick={() => update("post_to_discord", !form.post_to_discord)}
                className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  form.post_to_discord
                    ? "bg-gnome-green border-gnome-green"
                    : "border-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {form.post_to_discord && (
                  <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-semibold text-bark-brown">Post to Discord</p>
                <p className="text-xs text-bark-brown-light">
                  Creates a Discord Scheduled Event and posts the formatted event
                  message to the events channel. Uncheck if the event already
                  exists in Discord.
                </p>
              </div>
            </div>
            {form.post_to_discord && (
              <div className="ml-9 space-y-4">
                <TemplateSelector contentType="event_post" value={templateId} onChange={setTemplateId} label="Event Post Template" />
                {visibleFields && (
                  <p className="text-xs text-iron-grey">
                    The form below only shows the fields this template uses — pick a different one to see more.
                  </p>
                )}
                <div className="space-y-2">
                  <ChannelSelector value={destination} onChange={setDestination} label="Post To (optional)" allowBlank />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary font-mono text-xs focus:outline-none focus:ring-2 focus:ring-gnome-green"
                    placeholder="Or paste a link/ID manually (leave blank to use the default events channel)"
                  />
                </div>
              </div>
            )}
          </Card>

          <EventFormFields form={form} update={update} setForm={setForm} visibleFields={visibleFields} />

          {/* Sign-up Thread + Submit */}
          <Card hover={false}>
            <div className="flex items-start gap-3 mb-4">
              <button
                type="button"
                onClick={() => update("create_signup_thread", !form.create_signup_thread)}
                className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  form.create_signup_thread
                    ? "bg-gnome-green border-gnome-green"
                    : "border-bark-brown-light hover:border-gnome-green"
                }`}
              >
                {form.create_signup_thread && (
                  <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-semibold text-bark-brown">Create Sign-up Thread</p>
                <p className="text-xs text-bark-brown-light">
                  Creates a thread in #event-signups where members can react or
                  reply to sign up for this event.
                </p>
              </div>
            </div>
            {form.create_signup_thread && (
              <div className="mb-6 ml-9">
                <TemplateSelector contentType="signup_thread" value={signupThreadTemplateId} onChange={setSignupThreadTemplateId} label="Signup Thread Template" />
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? "Creating..." : "Create Event"}
              </Button>
              {status && (
                <span className={`text-sm ${status.type === "error" ? "text-red-accent" : "text-gnome-green"}`}>
                  {status.message}
                </span>
              )}
            </div>
          </Card>
        </form>

        {/* Live Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <h2 className="font-display text-lg text-bark-brown mb-4">Discord Preview</h2>
          <div className="bg-[#313338] text-[#dbdee1] font-sans text-sm leading-relaxed overflow-auto max-h-[80vh] rounded-lg border border-[#1e1f22] p-4 shadow-lg">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
              {preview || <span className="text-[#72767d]">Fill in the form to see a preview...</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
