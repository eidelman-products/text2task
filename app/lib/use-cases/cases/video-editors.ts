import type { UseCase } from "../types";

export const videoEditorsUseCase = {
  "slug": "video-editors",
  "audienceLabel": "Video Editors",
  "title": "AI Video Revision Task Manager for Video Editors",
  "seo": {
    "title": "Video Revision & Delivery Task Manager for Editors",
    "description": "Turn client texts, emails, and messages about cuts, timecodes, and exports into organized editing tasks with deadlines, reviewed before saving."
  },
  "listing": {
    "category": "creative-content",
    "label": "Video Editors",
    "title": "Turn video revisions into tasks",
    "description": "Organize timestamped cuts, captions, audio notes, export requirements, deadlines, and revision rounds into a reviewable editing plan.",
    "highlights": [
      "Timestamped cut changes",
      "Caption revisions",
      "Export requirements",
      "Revision rounds"
    ]
  },
  "hero": {
    "title": "Stop scrubbing through texts for timecodes.",
    "highlight": "Keep every cut, format, and deadline together.",
    "description": "Paste a client's text, email, or WhatsApp message about a revision. Text2Task organizes it into tasks, including timecodes, aspect ratios, and export deadlines, that you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/text2task-client-whatsapp-video-editors.png",
      "alt": "Video editing client WhatsApp request containing a shorter testimonial cut, caption and pacing changes, logo end card, aspect-ratio exports, music guidance, deadline, and budget.",
      "label": "Client video revision request",
      "width": 1448,
      "height": 1086,
      "role": "source",
      "priority": true
    }
  },
  "heroVariant": "reversed",
  "accentTone": "slate",
  "signatureModule": {
    "kind": "timeline",
    "title": "A timecoded revision list",
    "description": "Example edit notes pulled from a client text, like Noah's.",
    "note": "Example workflow — not an automated decision.",
    "items": [
      { "marker": "0:38", "label": "Mute background noise" },
      { "marker": "1:42→0:60", "label": "Trim walkthrough for Reels", "description": "9:16 export" },
      { "marker": "—", "label": "16:9 YouTube version", "description": "No changes needed" }
    ]
  },
  "secondaryModule": {
    "kind": "checklist",
    "title": "Export and revision checklist",
    "description": "Confirm these before delivering a cut.",
    "items": [
      "Aspect ratio for each platform",
      "Captions for silent autoplay",
      "Timecodes confirmed against the source",
      "Hard vs. soft deadline",
      "Rate for extra export versions"
    ]
  },
  "transformation": {
    "title": "From a client text to a split editing task list.",
    "description": "Example: a text message asking for a trim, a mute, and a new vertical export with a hard deadline.",
    "beforeLabel": "Client text message",
    "beforeText": "\"hey can u cut the walkthrough down to under 60 sec for reels, its 1:42 now. also mute the part around 0:38 where you can hear the neighbor's dog barking. need the vertical version by thursday am, the listing goes live then. the 16x9 one for youtube is fine as is\" — Noah, Petrosyan Realty Group",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Trim the 1:42 walkthrough to under 60 seconds, 9:16 for Reels",
      "Mute the audio around the 0:38 mark",
      "Deadline: Thursday AM, tied to the listing going live",
      "16:9 YouTube version needs no changes"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Which scenes to keep for the under-60-second cut — a creative call, not automatic",
      "No guidance on captions for silent autoplay viewing",
      "No rate mentioned for the extra vertical export",
      "Confirming Thursday AM is a hard deadline, not a soft target"
    ],
    "value": "The trim, the mute, and the new vertical export stay as three separate tasks, each with its own timecode and deadline."
  },
  "painPoints": {
    "title": "One text can ask for a trim, a mute, and a whole new export.",
    "description": "A message about muting a noisy few seconds can also ask for a shorter cut in a different aspect ratio for a hard deadline, three different deliverables, one text.",
    "supportingDescription": "Text2Task proposes the breakdown. You confirm the timecodes and formats, and nothing saves until you approve it.",
    "items": [
      "Separate a simple trim from a request for a new export or version.",
      "Keep timecoded notes, like '0:38,' attached to the exact task.",
      "Flag missing specs, like aspect ratio or platform, when a client just says 'make it work for social.'",
      "Track hard delivery deadlines alongside creative revision requests."
    ]
  },
  "workflow": {
    "title": "A three-step revision request workflow.",
    "description": "Capture the message, review the breakdown, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the revision request",
        "description": "Paste the text, email, or WhatsApp message describing the cuts, mutes, or new export needed."
      },
      {
        "title": "Review the proposed tasks",
        "description": "Check each timecode, aspect ratio, and deadline before saving."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the edit is ready to work on."
      }
    ]
  },
  "capabilities": {
    "title": "Video editing tasks you can organize in Text2Task",
    "description": "Keep post-production revisions and delivery requests clear without losing the client context needed to complete them.",
    "items": [
      "Timestamped cut and trim requests",
      "B-roll and footage replacements",
      "Caption and subtitle revisions",
      "Audio, music, and sound notes",
      "Intro, outro, and transition changes",
      "Motion graphics and lower thirds",
      "Color and visual adjustment notes",
      "Aspect-ratio and platform versions",
      "Export formats and delivery requirements",
      "Assets, references, deadlines, and priorities"
    ]
  },
  "clientUpdates": {
    "title": "Track the next revision against what's already cut.",
    "description": "When another message comes in, Client Updates checks it against the saved project so a repeat note doesn't get logged twice.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against editing tasks already tracked for this project."
      },
      {
        "title": "See what's new versus already addressed",
        "description": "Review which notes are new, and which may already be reflected in an earlier cut."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You confirm every cut before it's added — Text2Task never edits, exports, or renders video."
  },
  "faq": {
    "title": "Questions about using Text2Task for Video Editors",
    "items": [
      {
        "question": "Can it capture timecoded feedback accurately, like 'mute the part around 0:38'?",
        "answer": "Yes, when a timecode or clear time reference is included in the message, Text2Task keeps it attached to that specific task."
      },
      {
        "question": "Can it flag missing specs, like aspect ratio, when a client just says 'make it work for social'?",
        "answer": "Yes. When a request doesn't name a platform or aspect ratio, Text2Task flags that detail as missing instead of guessing one."
      },
      {
        "question": "Can it tell a small trim apart from a request for a whole new version?",
        "answer": "It can flag language suggesting a separate deliverable, like a different aspect ratio or length, versus a quick trim to the existing cut. The final call is yours."
      },
      {
        "question": "Does it edit, render, or export video for me?",
        "answer": "No. Text2Task only organizes the request into a task you review. It does not touch your footage, export files, or editing software."
      }
    ]
  },
  "relatedSlugs": [
    "social-media-managers",
    "graphic-designers",
    "small-agencies"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Client Feedback to Tasks",
        "href": "/features/client-feedback-to-tasks",
        "description": "Compare a new round of edit notes against a project you've already saved."
      },
      {
        "label": "How to turn client feedback into tasks",
        "href": "/resources/how-to-turn-client-feedback-into-tasks",
        "description": "A closer look at separating new notes from work already handled."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next client revision message into a clear video-editing plan.",
    "description": "Capture the revision request, review the proposed editing tasks, and save only the video work you approve.",
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
    "secondaryModule",
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
