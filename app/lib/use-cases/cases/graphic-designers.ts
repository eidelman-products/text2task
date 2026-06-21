import type { UseCase } from "../types";

export const graphicDesignersUseCase = {
  "slug": "graphic-designers",
  "audienceLabel": "Graphic Designers",
  "title": "AI Task Manager for Graphic Designers",
  "seo": {
    "title": "AI Task Manager for Graphic Designers | Text2Task",
    "description": "Text2Task helps graphic designers turn client feedback, revision requests, WhatsApp messages, emails, screenshots, deadlines, and budgets into organized projects and tasks."
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
    "title": "Turn graphic design feedback into",
    "highlight": "ready-to-work tasks",
    "description": "Text2Task turns WhatsApp messages, emails, screenshots, and revision notes into an organized design project and tasks you review and edit before saving.",
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
  "painPoints": {
    "title": "From scattered feedback to organized design work.",
    "description": "Client feedback rarely arrives as a clean checklist. Deliverables, brand details, files, deadlines, and budget notes often share the same thread.",
    "supportingDescription": "Text2Task creates a structured first pass so you can spend less time copying requests and more time doing the creative work.",
    "items": [
      "Separate each design deliverable into clear project tasks.",
      "Keep brand notes, reference files, deadlines, and budgets connected to the work.",
      "Review and edit the extracted plan before saving it.",
      "Return to a clearer project plan when the next revision arrives."
    ]
  },
  "workflow": {
    "title": "A simple three-step design intake workflow.",
    "description": "Capture the request, check the proposed work, and save the approved plan.",
    "steps": [
      {
        "title": "Capture the request",
        "description": "Paste the client message or notes, or upload a screenshot of the request."
      },
      {
        "title": "Review the extracted plan",
        "description": "Check the proposed logo, template, and banner tasks, along with brand notes, export requirements, deadlines, budgets, and client details."
      },
      {
        "title": "Save the approved project work",
        "description": "Save the approved project and tasks so the design work is ready to track and deliver."
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
    "title": "Keep follow-up revisions under your control.",
    "description": "Client Updates compares a new message with the saved project and proposes only the work that may need attention.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Analyze the follow-up request against the current design project."
      },
      {
        "title": "Identify new work and already-handled work",
        "description": "See suggested new tasks alongside requests that appear to be covered already."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and choose what to apply; nothing changes automatically."
      }
    ],
    "note": "Text2Task suggests changes; you decide what becomes part of the project."
  },
  "faq": {
    "title": "Questions about using Text2Task for Graphic Designers",
    "items": [
      {
        "question": "Can Text2Task extract design tasks from screenshots?",
        "answer": "Yes. You can upload screenshots and review the extracted tasks before saving them."
      },
      {
        "question": "Can I use it for revision lists?",
        "answer": "Yes. Text2Task is useful for turning revision notes into structured tasks."
      },
      {
        "question": "Can I track budgets?",
        "answer": "Yes. Text2Task can extract amounts from client messages when they are included."
      },
      {
        "question": "Can I export my tasks?",
        "answer": "CSV export is available on the Pro plan."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "social-media-managers",
    "video-editors"
  ],
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
  }
} satisfies UseCase;
