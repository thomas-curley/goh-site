"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AttendanceRecord {
  id: string;
  discord_id: string;
  discord_username: string | null;
  discord_nickname: string | null;
  rsn: string | null;
  source: string;
  signed_up: boolean;
  attended: boolean;
  marked_by: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  start_time: string;
  discord_message_id: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  signup_reaction: "Discord Signup",
  voice_channel: "Voice Channel",
  manual: "Manual",
};

export default function EventAttendancePage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [addRsn, setAddRsn] = useState("");
  const [myRsn, setMyRsn] = useState<string>("Admin");
  const [scanning, setScanning] = useState(false);
  const [scannedNames, setScannedNames] = useState<{ rsn: string; discord_id: string | null; matched: boolean }[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState("");

  const supabase = createSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    // Get event info
    const { data: ev } = await supabase
      .from("events")
      .select("id, title, start_time, discord_message_id")
      .eq("id", eventId)
      .single();
    if (ev) setEvent(ev);

    // Get attendance
    const res = await fetch(`/api/events/${eventId}/attendance`);
    if (res.ok) {
      const data = await res.json();
      setAttendance(data.attendance ?? []);
    }

    // Get admin's RSN
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("rsn")
        .eq("id", user.id)
        .single();
      if (profile?.rsn) setMyRsn(profile.rsn);
    }

    setLoading(false);
  }, [supabase, eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setStatus("Working...");
    const res = await fetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, marked_by: myRsn, ...extra }),
    });
    const data = await res.json();
    setStatus(data.message ?? data.error ?? "Done");
    await loadData();
  };

  const toggleAttended = (record: AttendanceRecord) => {
    if (record.attended) {
      handleAction("mark_not_attended", { discord_ids: [record.discord_id] });
    } else {
      handleAction("mark_attended", { discord_ids: [record.discord_id] });
    }
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRsn.trim()) return;
    handleAction("add_manual", { rsn: addRsn.trim(), discord_id: `manual_${Date.now()}`, attended: true });
    setAddRsn("");
  };

  const markAllAttended = () => {
    const signedUp = attendance.filter((a) => a.signed_up && !a.attended);
    if (signedUp.length === 0) return;
    handleAction("mark_attended", { discord_ids: signedUp.map((a) => a.discord_id) });
  };

  const signedUpCount = attendance.filter((a) => a.signed_up).length;
  const attendedCount = attendance.filter((a) => a.attended).length;

  const inputClass = "px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary focus:outline-none focus:ring-2 focus:ring-gnome-green";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return <p className="text-bark-brown-light">Event not found.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Attendance</h1>
      <p className="text-bark-brown-light mb-6">
        {event.title} — {new Date(event.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </p>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">
          {status}
        </div>
      )}

      {/* Stats + Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card hover={false} className="text-center">
          <p className="font-stats text-2xl text-gold-display font-bold">{signedUpCount}</p>
          <p className="text-xs text-bark-brown-light">Signed Up</p>
        </Card>
        <Card hover={false} className="text-center">
          <p className="font-stats text-2xl text-gnome-green font-bold">{attendedCount}</p>
          <p className="text-xs text-bark-brown-light">Attended</p>
        </Card>
        <Card hover={false} className="text-center">
          <p className="font-stats text-2xl text-bark-brown font-bold">{attendance.length}</p>
          <p className="text-xs text-bark-brown-light">Total Tracked</p>
        </Card>
        <Card hover={false} className="text-center">
          <p className="font-stats text-2xl text-iron-grey font-bold">
            {signedUpCount > 0 ? Math.round((attendedCount / signedUpCount) * 100) : 0}%
          </p>
          <p className="text-xs text-bark-brown-light">Show Rate</p>
        </Card>
      </div>

      {/* Import buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button size="sm" variant="secondary" onClick={() => handleAction("import_signups")}>
          Import Signups from Discord
        </Button>
        <Button size="sm" variant="ghost" onClick={markAllAttended} disabled={signedUpCount === attendedCount}>
          Mark All Signed Up as Attended
        </Button>
      </div>

      {/* Add manual attendee */}
      <Card hover={false} className="mb-6">
        <h3 className="font-display text-base text-bark-brown mb-3">Add Attendee Manually</h3>
        <form onSubmit={handleAddManual} className="flex gap-2">
          <input
            type="text"
            value={addRsn}
            onChange={(e) => setAddRsn(e.target.value)}
            className={`${inputClass} flex-1 font-mono text-sm`}
            placeholder="RSN or Discord username"
          />
          <Button type="submit" size="sm">Add</Button>
        </form>
      </Card>

      {/* Screenshot Scanner */}
      <Card hover={false} className="mb-6">
        <h3 className="font-display text-base text-bark-brown mb-3">Scan Screenshot for Attendees</h3>
        <p className="text-xs text-bark-brown-light mb-3">
          Upload an OSRS screenshot and AI will detect player names and add them to the attendance list.
        </p>

        {/* Upload */}
        {!screenshotUrl && (
          <label className="block">
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const fileName = `scan_${Date.now()}_${file.name}`;
                const { error } = await supabase.storage
                  .from("banners")
                  .upload(fileName, file, { contentType: file.type });
                if (error) {
                  setStatus("Upload failed: " + error.message);
                  setUploading(false);
                  return;
                }
                const { data: pub } = supabase.storage.from("banners").getPublicUrl(fileName);
                setScreenshotUrl(pub.publicUrl);
                setUploading(false);
              }}
              className="block w-full text-sm text-bark-brown-light file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gnome-green file:text-text-light hover:file:bg-gnome-green-light file:cursor-pointer cursor-pointer"
            />
            {uploading && <p className="text-xs text-iron-grey mt-2">Uploading...</p>}
          </label>
        )}

        {/* Preview + Scan */}
        {screenshotUrl && !scannedNames && (
          <div>
            <img src={screenshotUrl} alt="Screenshot" className="w-full rounded-md border border-bark-brown-light max-h-64 object-contain mb-3" />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={scanning}
                onClick={async () => {
                  setScanning(true);
                  setStatus(null);
                  try {
                    const res = await fetch(`/api/events/${eventId}/attendance/scan-screenshot`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrl: screenshotUrl }),
                    });
                    const data = await res.json();
                    if (res.ok && data.names) {
                      setScannedNames(data.names);
                      setStatus(data.message);
                    } else {
                      setStatus(data.error ?? "Scan failed");
                    }
                  } catch {
                    setStatus("Screenshot scan failed.");
                  } finally {
                    setScanning(false);
                  }
                }}
              >
                {scanning ? "Scanning..." : "Scan for Player Names"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setScreenshotUrl(""); setScannedNames(null); }}>
                Remove
              </Button>
            </div>
          </div>
        )}

        {/* Scan results */}
        {scannedNames && (
          <div>
            <img src={screenshotUrl} alt="Screenshot" className="w-full rounded-md border border-bark-brown-light max-h-48 object-contain mb-3" />
            <h4 className="text-sm font-semibold text-bark-brown mb-2">
              Detected {scannedNames.length} player name(s)
            </h4>
            <div className="space-y-1 mb-4">
              {scannedNames.map((name, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded border border-parchment-dark">
                  <span className="font-mono text-sm text-gnome-green">{name.rsn}</span>
                  <span className="text-xs text-iron-grey">
                    {name.matched ? "✓ Linked profile found" : "No profile match"}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  setStatus("Adding scanned names...");
                  for (const name of scannedNames) {
                    await handleAction("add_manual", {
                      rsn: name.rsn,
                      discord_id: name.discord_id ?? `scan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      discord_username: name.rsn,
                      attended: true,
                    });
                  }
                  setStatus(`Added ${scannedNames.length} attendee(s) from screenshot.`);
                  setScannedNames(null);
                  setScreenshotUrl("");
                  await loadData();
                }}
              >
                Add All to Attendance
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setScannedNames(null); setScreenshotUrl(""); }}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Attendance list */}
      <Card hover={false}>
        <h3 className="font-display text-lg text-bark-brown mb-4">
          Attendance List ({attendance.length})
        </h3>

        {attendance.length === 0 ? (
          <p className="text-sm text-iron-grey">No attendance records yet. Import signups or add attendees manually.</p>
        ) : (
          <div className="space-y-2">
            {attendance.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border border-parchment-dark"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Attended checkbox */}
                  <button
                    onClick={() => toggleAttended(record)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      record.attended
                        ? "bg-gnome-green border-gnome-green"
                        : "border-bark-brown-light hover:border-gnome-green"
                    }`}
                    title={record.attended ? "Mark as not attended" : "Mark as attended"}
                  >
                    {record.attended && (
                      <svg className="w-4 h-4 text-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bark-brown truncate">
                      {record.rsn ? (
                        <span className="font-mono text-gnome-green">{record.rsn}</span>
                      ) : (
                        record.discord_nickname ?? record.discord_username ?? "Unknown"
                      )}
                    </p>
                    <p className="text-xs text-iron-grey truncate">
                      {record.discord_nickname && record.discord_username && (
                        <>{record.discord_nickname} ({record.discord_username})</>
                      )}
                      {!record.discord_nickname && record.discord_username && record.rsn && (
                        <>{record.discord_username}</>
                      )}
                      {record.signed_up && <span className="ml-2 text-gold-display">📋 Signed up</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-iron-grey">
                    {SOURCE_LABELS[record.source] ?? record.source}
                  </span>
                  <button
                    onClick={() => handleAction("remove", { discord_id: record.discord_id })}
                    className="text-xs text-red-accent hover:underline cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
