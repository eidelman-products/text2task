import type { UseCase } from "../types";

export const graphicDesignersUseCase = {
  "slug": "graphic-designers",
  "audienceLabel": "Graphic Designers",
  "title": "AI Task Manager for Graphic Designers",
  "seo": {
    "title": "Design Revision & Delivery Tracker for Graphic Designers",
    "description": "Turn client feedback, voice-note summaries, and screenshots into tracked design tasks, including file formats and delivery deadlines, reviewed before saving."
  },
  "listing": {
    "category": "creative-content",
    "label": "Graphic Designers",
    "title": "Organize graphic design feedback",
    "description": "Turn revision notes, brand context, assets, and deadlines into a clear design task plan.",
    "highlights": [
      "Logo revisions",
      "Social templates",
      "Brand guidelines",
      "Export formats"
    ]
  },
  "hero": {
    "title": "Stop replaying voice notes to catch every revision.",
    "highlight": "Track rounds, formats, and final delivery.",
    "description": "Paste a client's message, forward a voice-note summary, or upload a screenshot of their feedback. Text2Task organizes it into tasks, including file format and delivery details, that you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/graphic-designers/graphic-designer-client-message-project-flow.png",
      "alt": "Text2Task workflow showing a graphic design client message turned into a reviewable project and task plan.",
      "label": "Client message to project flow",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "heroVariant": "overlap",
  "accentTone": "violet",
  "signatureModule": {
    "kind": "board",
    "title": "A deliverable and version board",
    "description": "Example status view for a logo and social package nearing delivery.",
    "note": "Example workflow — not an automated decision.",
    "groups": [
      {
        "label": "Logo",
        "items": [
          { "label": "Roaster icon resize", "tag": "Revision" },
          { "label": "Black-and-white stamp version", "tag": "New deliverable" }
        ]
      },
      {
        "label": "Social templates",
        "items": [
          { "label": "3 Instagram story templates", "tag": "New deliverable" }
        ]
      },
      {
        "label": "Source files",
        "items": [
          { "label": "Print-ready vector export", "tag": "Missing" }
        ]
      },
      {
        "label": "Delivery",
        "items": [
          { "label": "Final files by Thursday", "tag": "Final export" }
        ]
      }
    ]
  },
  "proof": {
    "title": "A real request, organized",
    "description": "One client WhatsApp message, and the structured project Text2Task proposed from it.",
    "images": [
      {
        "src": "/landing/text2task-client-whatsapp-graphic-designers.png",
        "alt": "WhatsApp message from a graphic design client listing a logo revision, three Instagram story templates, and a LinkedIn banner update with budget and deadline",
        "label": "Client WhatsApp request",
        "width": 1448,
        "height": 1086,
        "role": "source"
      },
      {
        "src": "/landing/text2task-client-whatsapp-graphic-designers%20extracted.png",
        "alt": "Text2Task project preview showing the same request organized into a social media content package with budget, deadline, priority, and three ready subtasks",
        "label": "Organized project preview",
        "width": 959,
        "height": 901,
        "role": "product"
      }
    ]
  },
  "transformation": {
    "title": "From a voice-note summary to a tracked task list.",
    "description": "Example: a client's spoken feedback, summarized into text, about a logo nearing final delivery.",
    "beforeLabel": "Voice-note summary",
    "beforeText": "\"Tobias called about the logo, he likes round 2 but wants the roaster icon a little smaller and asked if we can get a black-and-white version for the coffee bag stamp, plus he needs the final files 'the kind the printer wants' by the time he places his bag order Thursday. He didn't say if that's the horizontal or stacked lockup.\" — Tobias, Wren & Salt Roastery",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Resize the roaster icon (round 2 feedback)",
      "Produce a black-and-white version for the coffee bag stamp",
      "Deliver print-ready files by Thursday"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Which lockup, horizontal or stacked, needs the black-and-white version",
      "Whether 'the kind the printer wants' means vector or a specific press-ready format",
      "No budget mentioned in this message",
      "Whether this is the final round or another revision may follow"
    ],
    "value": "The resize, the new format, and the delivery deadline are separated into three clear tasks instead of one voicemail to replay."
  },
  "painPoints": {
    "title": "Design feedback rarely says which round it's replying to.",
    "description": "A client note about resizing a logo icon can arrive without saying whether it's the second round of changes or a request for final, print-ready files.",
    "supportingDescription": "Text2Task proposes the breakdown. You confirm the round and the delivery requirements, and nothing saves until you approve it.",
    "items": [
      "Separate revision notes from a request for final delivery files.",
      "Capture file-format needs, like print-ready vector files versus web files, when mentioned.",
      "Flag which lockup or version feedback applies to, when it's unclear.",
      "Keep delivery deadlines and budget notes with the right task."
    ]
  },
  "workflow": {
    "title": "A three-step design feedback workflow.",
    "description": "Capture the note, review the breakdown, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the feedback",
        "description": "Paste the message, forward a voice-note summary, or upload a screenshot of the client's notes."
      },
      {
        "title": "Review the proposed tasks",
        "description": "Check the round, the file formats needed, and the delivery deadline before saving."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the revision or delivery work is ready to track."
      }
    ]
  },
  "capabilities": {
    "title": "Graphic design tasks you can organize in Text2Task",
    "description": "Text2Task is useful when client feedback needs to become concrete creative deliverables without losing the brief.",
    "items": [
      "Logo revisions",
      "Social media templates",
      "LinkedIn banners",
      "Brand guidelines",
      "Color palettes",
      "Typography changes",
      "Export formats",
      "Revision rounds",
      "Delivery deadlines",
      "Client assets and reference files"
    ]
  },
  "clientUpdates": {
    "title": "Track the next round without losing count.",
    "description": "When more feedback arrives, Client Updates checks it against the saved project so you can see which round you're actually on.",
    "steps": [
      {
        "title": "Compare the new note with the saved project",
        "description": "Text2Task checks the follow-up against the design tasks already on file."
      },
      {
        "title": "See what's new versus already addressed",
        "description": "Review which feedback is new, and which may already be handled from an earlier round."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You decide what counts as the next round — Text2Task never marks a delivery final on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Graphic Designers",
    "items": [
      {
        "question": "Can it tell 'one more round of changes' apart from 'send the final files'?",
        "answer": "It can flag language that suggests a delivery request versus ongoing revisions, but confirming which round you're on stays with you."
      },
      {
        "question": "Can it capture file-format requirements, like print versus web?",
        "answer": "Yes, when the client mentions it, for example needing vector files for a printer versus PNGs for the web. It won't assume a format that wasn't stated."
      },
      {
        "question": "Can I track budget and export tasks?",
        "answer": "Yes. Text2Task can extract amounts from client messages when they are included, and CSV export is available on the Pro plan."
      },
      {
        "question": "Does it work from a voice note or only text and screenshots?",
        "answer": "You provide a summary or transcript of the voice note as text, or upload a screenshot. Text2Task does not record or transcribe audio directly."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "social-media-managers",
    "video-editors"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Screenshot to Tasks",
        "href": "/features/screenshot-to-tasks",
        "description": "Turn a screenshot of marked-up design feedback into a reviewable task."
      },
      {
        "label": "How to turn client feedback into tasks",
        "href": "/resources/how-to-turn-client-feedback-into-tasks",
        "description": "A closer look at comparing a new round of feedback against saved work."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next design request into a clear project plan.",
    "description": "Capture the request, review the proposed design tasks, and save only the project work you approve.",
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
    "proof",
    "painPoints",
    "transformation",
    "workflow",
    "faq",
    "capabilities",
    "clientUpdates",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
