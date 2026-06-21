import type { UseCase } from "../types";

export const webDesignersUseCase = {
  "slug": "web-designers",
  "audienceLabel": "Web Designers",
  "title": "AI Website Revision Task Manager for Web Designers",
  "seo": {
    "title": "AI Website Revision Task Manager for Web Designers | Text2Task",
    "description": "Text2Task helps web designers turn client feedback and website revision requests into organized project tasks, reducing manual task entry before design work begins."
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
    "title": "Turn scattered website feedback into a",
    "highlight": "clear revision plan.",
    "description": "Text2Task turns client emails, WhatsApp messages, screenshots, and revision notes into a structured website project and tasks you review and edit before saving.",
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
  "painPoints": {
    "title": "Website feedback rarely arrives as a clean task list.",
    "description": "Homepage and landing-page edits can arrive alongside mobile fixes, copy changes, CTA updates, form requests, and layout revisions in the same message.",
    "supportingDescription": "Deadlines, assets, references, and budget details are easy to miss, while copying each revision into a task manager wastes time.",
    "items": [
      "Separate homepage, landing-page, mobile, copy, form, and layout changes into clear tasks.",
      "Keep images, client assets, references, and contact details connected to the work.",
      "Make delivery deadlines and budget notes visible before revisions begin.",
      "Review the structured plan instead of rebuilding the request by hand."
    ]
  },
  "workflow": {
    "title": "From client feedback to approved website work.",
    "description": "Capture the revision request, check the proposed website plan, and save only the project work you approve.",
    "steps": [
      {
        "title": "Capture the website revision request",
        "description": "Capture the request containing homepage sections, copy changes, mobile fixes, CTA buttons, forms, images, or client details."
      },
      {
        "title": "Review the organized website plan",
        "description": "Check each proposed website task, deadline, asset, reference, and budget note, then edit any details before saving."
      },
      {
        "title": "Save the approved project work",
        "description": "Save the approved project and tasks so the revisions are ready for design or implementation."
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
    "title": "Handle follow-up website revisions without rebuilding the project.",
    "description": "When a client sends more feedback, Client Updates compares it with the saved website project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved website project",
        "description": "Analyze the client's additional revision request against the project's existing tasks and context."
      },
      {
        "title": "Identify new and already-handled revisions",
        "description": "See genuinely new website requests alongside work that may already be covered in the project."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and select what to apply. Text2Task never modifies the project automatically."
      }
    ],
    "note": "The web designer stays in control: Text2Task suggests updates, and only approved changes are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for Web Designers",
    "items": [
      {
        "question": "Can Text2Task separate one website revision message into multiple tasks?",
        "answer": "Yes. It can organize a mixed revision request into separate website tasks that you review before saving."
      },
      {
        "question": "Can it extract website feedback from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the extracted website project and tasks."
      },
      {
        "question": "Can I edit the website plan before saving it?",
        "answer": "Yes. The extracted plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up revisions for an existing website project?",
        "answer": "Client Updates compares the follow-up with the saved project, suggests new or already-handled revisions, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "wordpress-freelancers",
    "webflow-freelancers",
    "graphic-designers"
  ],
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
  }
} satisfies UseCase;
