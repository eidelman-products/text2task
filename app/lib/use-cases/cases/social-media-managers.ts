import type { UseCase } from "../types";

export const socialMediaManagersUseCase = {
  "slug": "social-media-managers",
  "audienceLabel": "Social Media Managers",
  "title": "AI Social Media Task Manager for Client Content",
  "seo": {
    "title": "Social Content Request Organizer for Social Media Managers",
    "description": "Turn client DMs, emails, and WhatsApp messages about content changes into organized tasks with platform, asset, and deadline details, reviewed before saving."
  },
  "listing": {
    "category": "creative-content",
    "label": "Social Media Managers",
    "title": "Plan client content requests",
    "description": "Structure posts, captions, campaign changes, approval notes, and content deadlines before production.",
    "highlights": [
      "Instagram and LinkedIn posts",
      "Story and carousel tasks",
      "Caption and CTA changes",
      "Approval and revision notes"
    ]
  },
  "hero": {
    "title": "Stop losing calendar changes in a DM thread.",
    "highlight": "Keep every platform and deadline straight.",
    "description": "Paste a client's DM, email, or WhatsApp message about a content change. Text2Task organizes it into tasks, with the platform, asset status, and posting deadline, that you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/text2task-client-whatsapp-social-media-managers.png",
      "alt": "Social media client WhatsApp request containing Instagram captions, story slides, a LinkedIn post, content timing, shared assets, deadline, budget, and brand-tone instructions.",
      "label": "Client social media content request",
      "width": 1448,
      "height": 1086,
      "role": "source",
      "priority": true
    }
  },
  "heroVariant": "panel",
  "accentTone": "rose",
  "signatureModule": {
    "kind": "calendar",
    "title": "A weekly content plan",
    "description": "Example week built from a single client DM, like Camille's.",
    "note": "Example workflow — not an automated decision.",
    "entries": [
      { "day": "Mon", "label": "Facial peel post", "meta": "Rescheduled from Sunday" },
      { "day": "Wed", "label": "Caption update", "meta": "Discount code removed" },
      { "day": "Fri", "label": "New esthetician Story", "meta": "Needs photo asset" },
      { "day": "Mon (next)", "label": "Review upcoming captions", "meta": "Approval pending" }
    ]
  },
  "transformation": {
    "title": "From an Instagram DM to a split content task list.",
    "description": "Example: a client's DM mixing a reschedule, a caption edit, and a brand-new Story request.",
    "beforeLabel": "Instagram DM",
    "beforeText": "\"hey!! can we push the facial peel post to tomorrow instead of today, and change the caption, take out the discount code, we're not running that promo anymore. also do we have a story for the new esthetician joining us? she starts Monday and I want people to know.\" — Camille, Duarte Skin Bar",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Reschedule the facial peel post by one day",
      "Remove the discount code from the caption",
      "New Story request about an esthetician starting Monday"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Whether the discount code needs removing from other already-scheduled posts too",
      "No photo or asset provided for the new esthetician Story",
      "No name or bio details given for the new hire",
      "Confirming the caption change before it's reposted"
    ],
    "value": "The reschedule, the caption edit, and the new Story request stay as three separate tasks instead of one easy-to-miss DM."
  },
  "painPoints": {
    "title": "One quick DM can touch several posts at once.",
    "description": "A message about rescheduling one post can also mean pulling a promo code from other scheduled posts, plus a brand-new request for a Story, all without saying which platform or when.",
    "supportingDescription": "Text2Task proposes the breakdown. You confirm the platform, the assets, and the deadline, and nothing saves until you approve it.",
    "items": [
      "Separate a reschedule, a caption edit, and a new post request into distinct tasks.",
      "Flag when a caption or copy change might affect other already-scheduled posts.",
      "Note when a request is missing the photo or video asset it needs.",
      "Keep platform-specific instructions, like Instagram-only, not LinkedIn, with the task."
    ]
  },
  "workflow": {
    "title": "A three-step content request workflow.",
    "description": "Capture the message, review the breakdown, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the client message",
        "description": "Paste the DM, email, or WhatsApp message describing the content change or new request."
      },
      {
        "title": "Review the proposed tasks",
        "description": "Check the platform, the deadline, and whether any asset or approval is still missing."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the content work is ready to schedule."
      }
    ]
  },
  "capabilities": {
    "title": "Social media tasks you can organize in Text2Task",
    "description": "Keep client content, campaign, approval, and revision requests clear without losing the context needed to complete them.",
    "items": [
      "Instagram and LinkedIn post requests",
      "Story and carousel tasks",
      "Reel and short-video notes",
      "Caption and CTA changes",
      "Platform-specific deliverables",
      "Content-calendar deadlines",
      "Client approval and revision notes",
      "Brand voice and hashtag instructions",
      "Assets, links, and references",
      "Campaign updates and priorities"
    ]
  },
  "clientUpdates": {
    "title": "Track the next content change against the calendar.",
    "description": "When another message comes in, Client Updates checks it against the saved project so a change doesn't get missed on the calendar.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against content tasks already tracked for this client."
      },
      {
        "title": "See what's new versus already scheduled",
        "description": "Review which requests are new, and which may already be reflected in the plan."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You confirm every change before it's added — Text2Task never edits or reschedules a post on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Social Media Managers",
    "items": [
      {
        "question": "Can it capture platform-specific instructions, like 'Instagram only, not LinkedIn'?",
        "answer": "Yes, when the client states it. Without that detail, Text2Task won't assume which platform a request applies to."
      },
      {
        "question": "Does it flag when a caption request is missing the photo or video it needs?",
        "answer": "It can note that no asset was included with the request, so you know to follow up before it's schedulable."
      },
      {
        "question": "Can it preserve a deadline tied to a specific posting date?",
        "answer": "Yes, when the client gives a date or a clear reference point, like 'she starts Monday.' Vague timing like 'soon' is flagged as unclear rather than guessed."
      },
      {
        "question": "Does it post, schedule, or publish content for me?",
        "answer": "No. Text2Task only organizes the request into a task you review. It does not connect to Instagram, Meta Business Suite, or any scheduling tool."
      }
    ]
  },
  "relatedSlugs": [
    "graphic-designers",
    "video-editors",
    "small-agencies"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore the AI Task Extractor",
        "href": "/features/ai-task-extractor",
        "description": "See how a single DM or message becomes a reviewable task."
      },
      {
        "label": "Turn client messages into tasks",
        "href": "/resources/turn-client-messages-into-tasks",
        "description": "A closer look at separating what's explicit from what's implied in one message."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next client content request into a clear social media plan.",
    "description": "Capture the client request, review the proposed content tasks, and save only the campaign work you approve.",
    "primary": {
      "label": "Start free",
      "href": "/signup"
    },
    "secondary": {
      "label": "Explore use cases",
      "href": "/use-cases"
    }
  },
  "sectionOrder": [
    "signatureModule",
    "transformation",
    "painPoints",
    "workflow",
    "faq",
    "capabilities",
    "clientUpdates",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
