import type { UseCase } from "../types";

export const videoEditorsUseCase = {
  "slug": "video-editors",
  "audienceLabel": "Video Editors",
  "title": "AI Video Revision Task Manager for Video Editors",
  "seo": {
    "title": "Client Feedback Management for Video Editors",
    "description": "Help video editors manage client feedback by turning revision messages, caption changes, export notes, and supported screenshots into reviewable editing tasks."
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
    "title": "Turn scattered video revision notes into a",
    "highlight": "clear editing plan.",
    "description": "Text2Task turns client WhatsApp messages, emails, screenshots, and revision notes into a structured video project and editing tasks you review and edit before saving.",
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
  "painPoints": {
    "title": "Video feedback rarely arrives as one clean revision list.",
    "description": "Timestamped cuts, captions, B-roll, audio, and visual changes can arrive together, with export requests and platform versions mixed into creative feedback.",
    "supportingDescription": "Assets, links, timecodes, references, deadlines, and delivery notes may be buried in the message, while copying every revision into a task manager wastes time and makes small changes easier to miss.",
    "items": [
      "Separate cut, caption, B-roll, audio, transition, and motion-graphics requests into clear tasks.",
      "Keep intros, outros, lower thirds, color notes, and creative revisions visible.",
      "Carry timecodes, assets, references, aspect ratios, exports, deadlines, and priorities into the plan.",
      "Review the organized editing work instead of rebuilding the revision message by hand."
    ]
  },
  "workflow": {
    "title": "From client revision notes to approved video-editing work.",
    "description": "Capture the revision request, check the proposed editing plan, and save only the video tasks you approve.",
    "steps": [
      {
        "title": "Capture the video revision request",
        "description": "Capture the supplied notes for timestamped cuts, B-roll, captions, audio, transitions, motion graphics, intros, outros, or lower thirds."
      },
      {
        "title": "Review the organized editing plan",
        "description": "Check each proposed task, aspect ratio, export format, platform version, asset, reference, and revision deadline before saving."
      },
      {
        "title": "Save the approved revision tasks",
        "description": "Save the approved project and tasks so the requested video work is ready for your editing workflow."
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
    "title": "Handle follow-up video revisions without rebuilding the editing plan.",
    "description": "When a client sends another revision message, Client Updates compares it with the saved video project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved video project",
        "description": "Analyze the client's additional revision notes against the project's existing editing tasks and context."
      },
      {
        "title": "Identify new and already-handled revisions",
        "description": "See genuinely new requests alongside video changes that may already be covered in the editing plan."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and choose what to add or update. Text2Task never modifies the project automatically."
      }
    ],
    "note": "You stay in control: Text2Task suggests the revision updates, and only the changes you approve are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for Video Editors",
    "items": [
      {
        "question": "Can Text2Task separate one client revision message into multiple video-editing tasks?",
        "answer": "Yes. It can organize revision notes provided as text or screenshots into separate editing tasks that you review before saving."
      },
      {
        "question": "Can it extract video revision notes from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the extracted video project and tasks."
      },
      {
        "question": "Can I edit the video plan before saving it?",
        "answer": "Yes. The extracted plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up revisions for an existing video project?",
        "answer": "Client Updates compares the follow-up with the saved project, suggests new or already-handled revisions, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "social-media-managers",
    "graphic-designers",
    "small-agencies"
  ],
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
  }
} satisfies UseCase;
