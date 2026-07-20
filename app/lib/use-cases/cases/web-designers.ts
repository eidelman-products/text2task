import type { UseCase } from "../types";

export const webDesignersUseCase = {
  "slug": "web-designers",
  "audienceLabel": "Web Designers",
  "title": "AI Website Revision Task Manager for Web Designers",
  "seo": {
    "title": "Website Revision Task Manager for Web Designers",
    "description": "Turn client revision emails, WhatsApp messages, and marked-up screenshots into tracked website tasks, organized by page and reviewed before saving."
  },
  "listing": {
    "category": "website-development",
    "label": "Web Designers",
    "title": "Organize website revision requests",
    "description": "Turn client website feedback, mobile fixes, copy changes, assets, deadlines, and budgets into reviewable tasks.",
    "highlights": [
      "Homepage revisions",
      "Mobile and responsive fixes",
      "CTA and form updates",
      "Image and asset replacements"
    ]
  },
  "hero": {
    "title": "Stop rebuilding revision emails into task lists.",
    "highlight": "Start tracking each page change.",
    "description": "Paste a client's revision email, WhatsApp message, or a marked-up screenshot. Text2Task extracts the page or section it affects, the deadline, and whether it looks like a quick fix or bigger scope — organized into a project you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/website-homepage-update-flow.png",
      "alt": "Web designer workflow showing a client website revision message becoming a reviewed Text2Task project with organized homepage, pricing, mobile, CTA, and content tasks.",
      "label": "Website feedback to organized revision project",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "heroVariant": "editorial",
  "accentTone": "blue",
  "signatureModule": {
    "kind": "board",
    "title": "How one revision message gets sorted",
    "description": "Example workflow: each part of Marisol's homepage feedback gets classified before it becomes a task.",
    "note": "Example workflow — not an automated decision.",
    "groups": [
      {
        "label": "Requested change",
        "items": [
          { "label": "Soften the hero headline" },
          { "label": "Enlarge the 'Book a Consultation' button" }
        ]
      },
      {
        "label": "Existing scope",
        "items": [
          { "label": "Hero image swap", "tag": "Revision" },
          { "label": "Button color and size", "tag": "Revision" }
        ]
      },
      {
        "label": "Needs clarification",
        "items": [
          { "label": "Which page the mobile bug affects" },
          { "label": "Exact show date for the deadline" }
        ]
      },
      {
        "label": "Approved task",
        "items": [
          { "label": "Fix oversized testimonial text on mobile", "tag": "Ready" }
        ]
      }
    ]
  },
  "proof": {
    "title": "The mechanism behind the revision board",
    "description": "A client screenshot, and the structured task list it becomes.",
    "images": [
      {
        "src": "/landing/text2task-website-redesign-workflow-hero.png",
        "alt": "Illustration of a website screenshot being converted into a structured list of build and revision tasks",
        "label": "Screenshot to structured tasks",
        "width": 1448,
        "height": 1086,
        "role": "supporting"
      }
    ]
  },
  "transformation": {
    "title": "From one revision email to a tracked task list.",
    "description": "Example: a client's feedback on a homepage draft, before and after Text2Task organizes it.",
    "beforeLabel": "Client email",
    "beforeText": "\"Hi! We looked at the homepage draft with the team. Can you swap the hero image for the one I sent last week (living room shot), and the 'Book a Consultation' button feels lost — can it stand out more, maybe match the gold accent on the logo? Also on phones the testimonials section text is huge. Trying to get this live before the Bellevue show opens.\" — Marisol, Fenn & Co. Interiors",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Swap the hero image (the client references an earlier message, not an attachment here)",
      "Restyle the 'Book a Consultation' button",
      "Fix oversized testimonial text on mobile",
      "Deadline tied to the Bellevue show, though no exact date is given"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Whether 'stand out more' means a color and size tweak or a new component",
      "Confirming the hero image is the one from last week's thread",
      "The exact show date, to set a real deadline",
      "Priority order across the three requests"
    ],
    "value": "The draft task list is ready to review in minutes — you still confirm scope and the exact deadline before anything is saved."
  },
  "painPoints": {
    "title": "Revision rounds pile up fast when feedback isn't tied to a page.",
    "description": "One client email can touch the hero section, a mobile bug, and a missing testimonial, with no note on which round of feedback this is or what's still outstanding from the last one.",
    "supportingDescription": "Text2Task proposes the task breakdown. You still decide whether something is an in-scope revision or a new request, and nothing is saved until you approve it.",
    "items": [
      "Separate hero, section, and page-specific feedback into individual tasks.",
      "Flag requests that read like new scope instead of a routine revision.",
      "Keep missing assets and copy visible instead of buried in a thread.",
      "Track launch deadlines and approval status alongside the work."
    ]
  },
  "workflow": {
    "title": "A three-step revision workflow.",
    "description": "Capture the message, review what Text2Task found, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the revision message",
        "description": "Paste the email or WhatsApp message, or upload a marked-up screenshot showing what the client wants changed."
      },
      {
        "title": "Check what's tied to which page",
        "description": "Review each proposed task against the page or section it affects, the deadline, and whether it reads as a revision or new scope."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the revisions are ready to build."
      }
    ]
  },
  "capabilities": {
    "title": "Website tasks you can organize in Text2Task",
    "description": "Keep website revisions clear without losing the client context and delivery details needed to complete them.",
    "items": [
      "Homepage revisions",
      "Landing-page updates",
      "Copy and content changes",
      "Mobile and responsive fixes",
      "CTA and button updates",
      "Contact-form changes",
      "Layout and spacing revisions",
      "Image and asset replacements",
      "Client details and references",
      "Delivery deadlines and budget notes"
    ]
  },
  "clientUpdates": {
    "title": "Handle the next round of feedback without losing the first.",
    "description": "When more feedback arrives, Client Updates checks it against the saved project so you can see what's genuinely new.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against the revision tasks already on file."
      },
      {
        "title": "See what's new versus already flagged",
        "description": "Review which requests are new, and which ones may already be tracked from an earlier round."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You review every round before it's added — Text2Task never applies a revision on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Web Designers",
    "items": [
      {
        "question": "Can Text2Task tell a small revision apart from a request for new scope?",
        "answer": "It can flag language that suggests a bigger change, like a new section or feature, so you can review it before treating it as part of the current revision round. The judgment call stays with you."
      },
      {
        "question": "Can it capture which page or section feedback is about?",
        "answer": "Yes, when the client's message names or clearly implies the page or section. If that detail is missing, Text2Task won't guess at it."
      },
      {
        "question": "Can it work from a marked-up screenshot, not just text?",
        "answer": "Yes. Upload a screenshot with circles, arrows, or notes, and Text2Task organizes the visible feedback into tasks you review before saving."
      },
      {
        "question": "Does it connect to my design files or staging site?",
        "answer": "No. Text2Task only works with the text or screenshot you provide. It does not access Figma, a staging URL, or your website directly."
      }
    ]
  },
  "relatedSlugs": [
    "wordpress-freelancers",
    "webflow-freelancers",
    "graphic-designers"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Client Feedback to Tasks",
        "href": "/features/client-feedback-to-tasks",
        "description": "Compare a new round of feedback against a project you've already saved."
      },
      {
        "label": "How web designers can manage client revisions faster",
        "href": "/resources/manage-client-revisions-web-designers",
        "description": "A closer look at separating revisions from new scope, round by round."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next website revision request into a clear project plan.",
    "description": "Capture the request, review the proposed website tasks, and save only the project work you approve.",
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
    "clientUpdates",
    "faq",
    "capabilities",
    "proof",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
