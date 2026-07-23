/**
 * Data for the admin product tours (see components/admin/tour/PageTour.tsx
 * for the engine that interprets these). Each step's `target` must match a
 * `data-tour="..."` attribute on the page named by the tour's `path` — there
 * is no compile-time link between the two, so keep them in sync by hand.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: TourPlacement;
}

export interface TourDefinition {
  id: string;
  label: string;
  description: string;
  path: string;
  steps: TourStep[];
}

export const ANNOUNCEMENT_TOUR: TourDefinition = {
  id: "announcement",
  label: "Posting an Announcement",
  description: "Walk through writing, styling, and publishing an announcement to the site and Discord.",
  path: "/admin/announcements",
  steps: [
    {
      target: "announcement-title",
      title: "Give it a title",
      body: "This is the headline members will see, both on the site and at the top of the Discord post — keep it short, like “Weekly Update.”",
    },
    {
      target: "announcement-content",
      title: "Write the announcement",
      body: "This is the main body text. Not reading well? Hit “Reformat” below the box and let the bot clean up the wording.",
    },
    {
      target: "announcement-category",
      title: "Pick a category",
      body: "Categories help members filter announcements on the site — pick whichever fits best.",
    },
    {
      target: "announcement-banner",
      title: "Add a banner (optional)",
      body: "Generate a themed banner image — it'll show at the top of this post on the site and in Discord.",
    },
    {
      target: "announcement-template",
      title: "Choose a post template",
      body: "Templates control how this gets laid out in Discord. Pick one, or leave it blank to use the clan's default.",
    },
    {
      target: "announcement-role-pings",
      title: "Ping some roles",
      body: "Select any Discord roles you want notified — like @everyone or a specific rank — when this goes out.",
    },
    {
      target: "announcement-post-discord",
      title: "Post to Discord",
      body: "Leave this checked to send the announcement straight to #announcements when you publish.",
    },
    {
      target: "announcement-publish",
      title: "Publish it",
      body: "This saves the announcement and, if checked above, posts it to Discord. That's the whole flow!",
    },
  ],
};

export const EVENT_RECAP_TOUR: TourDefinition = {
  id: "recap",
  label: "Posting an Event Recap",
  description: "Walk through writing up how an event went and posting the recap to Discord.",
  path: "/admin/event-recap",
  steps: [
    {
      target: "recap-link-event",
      title: "Link a past event (optional)",
      body: "If this recap is for an event on the calendar, pick it here to auto-fill the title and date.",
    },
    {
      target: "recap-destination",
      title: "Set the destination",
      body: "Paste the Discord message link (or channel/thread ID) for the forum post you're recapping — right-click the post in Discord and “Copy Message Link.”",
    },
    {
      target: "recap-title",
      title: "Title the recap",
      body: "Give it a clear title, like “Hueycotl Boss Night Recap.”",
    },
    {
      target: "recap-description",
      title: "Describe how it went",
      body: "A short summary — how many showed up, what happened, the overall vibe.",
    },
    {
      target: "recap-highlights",
      title: "Call out highlights",
      body: "Add a few standout moments from the night. “+ Add” gives you more slots.",
    },
    {
      target: "recap-winners",
      title: "List any winners",
      body: "If there were prizes or a competitive element, list the winning RSNs and what they earned.",
    },
    {
      target: "recap-screenshots",
      title: "Attach screenshots",
      body: "Upload a few screenshots — these get posted alongside the recap in Discord.",
    },
    {
      target: "recap-template",
      title: "Choose a template",
      body: "Pick the layout this recap should use, or leave it as the clan's default.",
    },
    {
      target: "recap-role-pings",
      title: "Ping some roles",
      body: "Choose which Discord roles get notified when this recap goes live.",
    },
    {
      target: "recap-submit",
      title: "Post it to Discord",
      body: "This posts the recap straight to the destination above. You're all set!",
      placement: "top",
    },
  ],
};

export const TEMPLATE_TOUR: TourDefinition = {
  id: "template",
  label: "Setting Up a Post Template",
  description: "Walk through building a reusable template — we'll use an Event Recap template as the example.",
  path: "/admin/templates",
  steps: [
    {
      target: "template-new-event-recap",
      title: "Start a new Event Recap template",
      body: "Click “+ New Template” right here in the Event Recaps section to open the editor — go ahead and click it now, then hit Next.",
    },
    {
      target: "template-editor-name",
      title: "Name your template",
      body: "Give it a short, descriptive name — you'll pick it by name later when posting a recap.",
    },
    {
      target: "template-editor-import",
      title: "Or import one from Discord",
      body: "Already have a template pasted in a pinned Discord message? Expand this and paste it in — the bot does its best to turn it into sections automatically.",
    },
    {
      target: "template-editor-add-library",
      title: "Add sections from the library",
      body: "Build the template from reusable sections — like Title, Highlights, or Winners — pulled from the shared library.",
    },
    {
      target: "template-editor-sections",
      title: "Arrange your sections",
      body: "Reorder with the arrows, click a section to configure it, and toggle “blank line before” to control spacing in the final Discord post.",
    },
    {
      target: "template-editor-preview",
      title: "Check the live preview",
      body: "This shows exactly how the template renders in Discord using sample data — watch it as you build.",
      placement: "left",
    },
    {
      target: "template-editor-save",
      title: "Save the template",
      body: "Once it looks right, save it here — it'll show up as an option next time you post an event recap.",
    },
  ],
};

export const ALL_TOURS: TourDefinition[] = [ANNOUNCEMENT_TOUR, EVENT_RECAP_TOUR, TEMPLATE_TOUR];
