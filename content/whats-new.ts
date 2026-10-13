/**
 * The staff "What's New" log, shown at /whats-new (staff only) and used by
 * the page-to-page walkthrough.
 *
 * Add an entry here in the same change as any update staff or members will
 * notice -- newest day first, newest entry first within a day. Keep the
 * wording for clan staff, not developers: what changed, where it is, and how
 * to try it. Each entry's `id` must be unique and must never change (it's
 * how "seen" state is remembered in each browser).
 */

export type WhatsNewKind = "new" | "improved" | "fixed" | "privacy";

/** Who can actually use the change -- shown as a label so staff know whether a link will open for them. */
export type WhatsNewAudience = "everyone" | "staff" | "admin";

export interface WhatsNewLink {
  label: string;
  href: string;
}

export interface WhatsNewEntry {
  id: string;
  /** YYYY-MM-DD, the day it went live. */
  date: string;
  kind: WhatsNewKind;
  audience: WhatsNewAudience;
  title: string;
  summary: string;
  /** Short "how to try it" steps, in order. */
  tryIt?: string[];
  /** Pages to open. The first is where the walkthrough takes you. */
  links: WhatsNewLink[];
}

export const WHATS_NEW: WhatsNewEntry[] = [
  // ── October 13, 2026 ──────────────────────────────────────────────
  {
    id: "2026-10-13-member-profiles-beta",
    date: "2026-10-13",
    kind: "new",
    audience: "staff",
    title: "Member profiles (beta)",
    summary:
      "A profile page for every clan member, in the style of Warcraft Logs: their OSRS character in 3D wearing their gear, plus every skill and boss coloured by where they rank in the clan (gold is best in the clan, then pink, orange, purple, blue, green and grey). It also shows EHP, EHB and their gains over the last week or month. Members who haven't made their character show the clan's gnome fashionscape. Staff only while we test it.",
    tryIt: [
      "Open the Member Profiles (Beta) list and search for a member.",
      "Look at the coloured ranks next to each boss and skill, and switch Recent gains between week and month.",
      "Drag a character to turn it.",
      "Make your own in My Account, under Profile character: pick your look like the in-game character creator, then click a gear slot and search for an item.",
      "Admins: set the clan's default character and refresh rankings in Admin › Member Profiles (Beta).",
    ],
    links: [
      { label: "Member Profiles (Beta)", href: "/members/beta" },
      { label: "My Account › Profile character", href: "/account#outfit" },
      { label: "Admin › Member Profiles (Beta)", href: "/admin/profiles-beta" },
    ],
  },
  // ── October 12, 2026 ──────────────────────────────────────────────
  {
    id: "2026-10-12-dark-mode-text",
    date: "2026-10-12",
    kind: "fixed",
    audience: "everyone",
    title: "Dark mode text is readable again",
    summary:
      "In dark mode some cards kept a light background while their text turned light, so it was hard to read. This showed up on What's New, survey results, the handbook, Clan Rules and other pages. Those cards now switch to dark too.",
    tryIt: ["Switch to dark mode with the moon button in the top bar.", "Open What's New and check the cards are easy to read."],
    links: [{ label: "What's New", href: "/whats-new" }],
  },
  {
    id: "2026-10-12-home-newsletter",
    date: "2026-10-12",
    kind: "new",
    audience: "everyone",
    title: "Newsletter shoutout on the home page",
    summary:
      "The home page's Clan at a Glance section now shows the latest Weekly Glider issue, with its cover, date and headline, and links to read it or browse past issues. It updates automatically when a new issue is published.",
    tryIt: ["Open the home page and scroll to Clan at a Glance.", "Press 'Read the latest issue'."],
    links: [
      { label: "Home page", href: "/" },
      { label: "Newsletter", href: "/newsletter" },
    ],
  },
  {
    id: "2026-10-12-event-images-kept",
    date: "2026-10-12",
    kind: "fixed",
    audience: "admin",
    title: "Editing an event no longer removes its image",
    summary:
      "Saving an event or a recurring series on the site sometimes wiped the cover image from the Discord event, or images from the Discord post. Images now only change when you change them in the form.",
    tryIt: [
      "Go to Admin › Events and edit an event that has a cover image in Discord.",
      "Change something else, like the description, and save.",
      "Check the Discord event and post: the image is still there.",
    ],
    links: [{ label: "Admin › Events", href: "/admin/events" }],
  },
  {
    id: "2026-10-12-whats-new",
    date: "2026-10-12",
    kind: "new",
    audience: "staff",
    title: "This What's New page",
    summary:
      "A staff-only list of site changes, newest first, with links to try each one. The walkthrough takes you to each new thing in turn, with a guide in the corner of the screen. New changes are added here as they go live.",
    tryIt: [
      "Open your account menu (top right) and pick What's New. The red number counts changes you haven't seen.",
      "Press Start walkthrough, then use Next and Back in the guide.",
      "Minimise the guide with – if it's in the way, or close it with ✕.",
    ],
    links: [{ label: "What's New", href: "/whats-new" }],
  },
  {
    id: "2026-10-12-clan-pages",
    date: "2026-10-12",
    kind: "new",
    audience: "everyone",
    title: "Rank Structure and Clan Rules pages",
    summary:
      "The Clan menu now has Rank Structure and Clan Rules pages, open to everyone. Until new graphics are uploaded they show the current rank list and the rules from the old handbook.",
    tryIt: [
      "Open the Clan menu in the top bar.",
      "Pick Rank Structure, then Clan Rules.",
      "Tap any uploaded image to see it full size.",
    ],
    links: [
      { label: "Rank Structure", href: "/rank-structure" },
      { label: "Clan Rules", href: "/clan-rules" },
    ],
  },
  {
    id: "2026-10-12-clan-pages-admin",
    date: "2026-10-12",
    kind: "new",
    audience: "admin",
    title: "Upload the Rank Structure and Clan Rules",
    summary:
      "Upload finished graphics or a PDF for each page. A PDF is turned into page images automatically and also offered as a download.",
    tryIt: [
      "Go to Admin › Rank Structure & Rules.",
      "Choose images or a PDF under the page you want to update.",
      "Reorder if needed, then press Publish.",
    ],
    links: [{ label: "Rank Structure & Rules admin", href: "/admin/clan-pages" }],
  },
  {
    id: "2026-10-12-shoutouts",
    date: "2026-10-12",
    kind: "improved",
    audience: "everyone",
    title: '"Review a Gn0mie" is now "Submit Gn0mie Shoutouts"',
    summary:
      "Renamed to match the Discord channel, and it has a new address. Old links still work. Testimonials moved from the Members menu to the Feedback menu.",
    tryIt: ["Open the Members menu and pick Submit Gn0mie Shoutouts.", "Open the Feedback menu to find Testimonials."],
    links: [
      { label: "Gn0mie Shoutouts", href: "/gnomie-shoutouts" },
      { label: "Testimonials", href: "/testimonials" },
    ],
  },
  {
    id: "2026-10-12-handbook",
    date: "2026-10-12",
    kind: "new",
    audience: "staff",
    title: "New Staff Handbook reader",
    summary:
      "The handbook is now uploaded as a PDF or page images and read in a page viewer, with a contents list, page-by-page navigation, links to a specific page, and 'continue where you left off'.",
    tryIt: [
      "Open the Staff Handbook.",
      "Use the contents list (on phones, tap the page counter at the bottom).",
      "Use the arrow keys or the ‹ › buttons to turn pages.",
      "Press 'Copy link to page' to share an exact page.",
    ],
    links: [
      { label: "Staff Handbook", href: "/staff-handbook" },
      { label: "Upload an edition (admin)", href: "/admin/handbook" },
    ],
  },
  {
    id: "2026-10-12-checkin-codes",
    date: "2026-10-12",
    kind: "new",
    audience: "staff",
    title: "One-click event check-in codes",
    summary:
      "Show, copy, generate or remove an event's check-in code without opening the event editor. The code is shown large enough to read out during the event.",
    tryIt: [
      "Open the Events calendar and click an event.",
      "In the pop-up, use Copy, New code or Remove under the check-in code.",
    ],
    links: [
      { label: "Events calendar", href: "/events" },
      { label: "Admin › Events", href: "/admin/events" },
    ],
  },
  {
    id: "2026-10-12-events-home",
    date: "2026-10-12",
    kind: "improved",
    audience: "everyone",
    title: "Checking in to events is easier",
    summary:
      "Home page event cards open the full event details and have a Check In button. Events that are underway stay on the home page, tagged 'Happening now', until they end. Calendar events now look clickable.",
    tryIt: ["Scroll to the events on the home page.", "Click a card for details, or press Check In."],
    links: [
      { label: "Home page", href: "/" },
      { label: "Events calendar", href: "/events" },
    ],
  },
  {
    id: "2026-10-12-surveys",
    date: "2026-10-12",
    kind: "improved",
    audience: "admin",
    title: "Better survey results",
    summary:
      "Surveys can have up to 50 questions. Results now show who chose each answer, written answers as separate cards with names and a search box, and a 'By respondent' view to step through each person's answers.",
    tryIt: [
      "Go to Admin › Surveys and press View Results on a survey.",
      "Switch between 'By question' and 'By respondent'.",
    ],
    links: [{ label: "Admin › Surveys", href: "/admin/surveys" }],
  },
  {
    id: "2026-10-12-privacy-ips",
    date: "2026-10-12",
    kind: "privacy",
    audience: "admin",
    title: "IP addresses are no longer shown",
    summary:
      "Survey results, the feedback inbox and Gn0mie shoutouts no longer show anyone's IP address, and exports leave them out. Ban IP still works without revealing the address. These submissions can now only be read through the admin pages.",
    links: [{ label: "Admin › Feedback", href: "/admin/feedback" }],
  },
  {
    id: "2026-10-12-newsletter",
    date: "2026-10-12",
    kind: "new",
    audience: "everyone",
    title: "The Weekly Glider newsletter page",
    summary:
      "The newsletter has its own page: the latest issue first, every past issue in the archive, readable on phone and desktop. Issues are uploaded as a PDF or page images.",
    tryIt: [
      "Open Clan › Newsletter.",
      "Tap a page to zoom in, or scroll down for older issues.",
      "Admins: upload new issues from Admin › Newsletter.",
    ],
    links: [
      { label: "Newsletter", href: "/newsletter" },
      { label: "Admin › Newsletter", href: "/admin/newsletter" },
    ],
  },
  {
    id: "2026-10-12-weekly-turnover",
    date: "2026-10-12",
    kind: "improved",
    audience: "admin",
    title: "Weekly SOTW/BotW turnover, rebuilt",
    summary:
      "Posts the results reply, the new competition thread, the raffle winners announcement and next week's voting poll, formatted like our hand-written posts. Pick competitions from dropdowns, including combined weeks, and preview and edit everything before it posts.",
    tryIt: [
      "Go to Admin › Weekly SOTW/BotW.",
      "Choose the finished and next competitions, the poll type, and the raffle winners.",
      "Press Generate Preview, check the posts, then Post Everything.",
    ],
    links: [{ label: "Admin › Weekly SOTW/BotW", href: "/admin/weekly-competition" }],
  },
  {
    id: "2026-10-12-admin-panel",
    date: "2026-10-12",
    kind: "improved",
    audience: "admin",
    title: "Admin panel reorganised",
    summary:
      "The sidebar is grouped, with one group open at a time and Dashboard on top. Red badges count items waiting for review, the Dashboard has a 'Needs attention' panel, and Prize Payouts is split into Payouts, Raffles, and Prize & DM Defaults. Each admin section now checks its own permission.",
    links: [{ label: "Admin Dashboard", href: "/admin" }],
  },
  {
    id: "2026-10-12-channel-pickers",
    date: "2026-10-12",
    kind: "improved",
    audience: "admin",
    title: "Tidier Discord channel pickers",
    summary:
      "Every 'post to channel' dropdown is grouped by Discord category, with active threads under their channel and a filter box.",
    links: [{ label: "Admin › Discord Channels", href: "/admin/alert-channels" }],
  },
];
