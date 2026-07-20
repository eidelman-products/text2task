import type { UseCase } from "../types";

export const wordpressFreelancersUseCase = {
  "slug": "wordpress-freelancers",
  "audienceLabel": "WordPress Freelancers",
  "title": "AI WordPress Maintenance Task Manager for Freelancers",
  "seo": {
    "title": "WordPress Maintenance Task Organizer for Freelancers",
    "description": "Turn WordPress client messages about plugin bugs, content changes, and new requests into organized tasks, split from retainer work and reviewed before saving."
  },
  "listing": {
    "category": "website-development",
    "label": "WordPress Freelancers",
    "title": "Structure WordPress maintenance work",
    "description": "Turn plugin, Elementor, form, mobile, and content requests into reviewable WordPress maintenance tasks.",
    "highlights": [
      "Plugin update requests",
      "Elementor page fixes",
      "Contact-form bugs",
      "Mobile layout issues"
    ]
  },
  "hero": {
    "title": "Stop retyping WhatsApp bug reports into a task list.",
    "highlight": "Keep maintenance and project work apart.",
    "description": "Paste a client's WhatsApp message, email, or screenshot about a broken page, a plugin issue, or a new request. Text2Task organizes it into tasks, separating routine maintenance from new paid work, that you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/text2task-client-gmail-wordpress-freelancers.png",
      "alt": "WordPress client maintenance email containing Elementor spacing, contact-form delivery, content, SEO and cache requests, a deadline, budget, and an attached notes file.",
      "label": "WordPress client maintenance request",
      "width": 1586,
      "height": 992,
      "role": "source",
      "priority": true
    }
  },
  "heroVariant": "panel",
  "accentTone": "amber",
  "signatureModule": {
    "kind": "board",
    "title": "Sort requests before they hit your task list",
    "description": "Example triage for a mixed WordPress message, like Dale's.",
    "note": "Example workflow — not an automated decision.",
    "groups": [
      {
        "label": "Plugin",
        "items": [
          { "label": "Amelia double-booking bug", "tag": "Urgent" }
        ]
      },
      {
        "label": "Theme / Layout",
        "items": [
          { "label": "Homepage banner styling" }
        ]
      },
      {
        "label": "Content",
        "items": [
          { "label": "New 6am HIIT class banner", "tag": "No rush" }
        ]
      },
      {
        "label": "Access / Hosting",
        "items": [
          { "label": "wp-admin access to confirm plugin version" }
        ]
      }
    ]
  },
  "secondaryModule": {
    "kind": "checklist",
    "title": "Details that are often missing",
    "description": "Check for these before starting a WordPress request.",
    "items": [
      "Site URL",
      "Staging or production",
      "Login or admin access",
      "Plugin or theme name",
      "Backup taken before changes",
      "Deadline"
    ]
  },
  "transformation": {
    "title": "From a WhatsApp bug report to a split task list.",
    "description": "Example: a client message mixing an urgent bug with a low-priority design request.",
    "beforeLabel": "WhatsApp message",
    "beforeText": "\"Yo quick one — the class schedule page is showing double bookings again, I think it's the Amelia plugin acting up after the update. Also can you add a banner for our new 6am HIIT class? No rush on the banner but the booking bug is urgent, people are messaging me confused.\" — Dale, Okafor Fitness Studio",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Double-booking bug, tied to the Amelia plugin, marked urgent",
      "New banner request for the 6am HIIT class, marked no rush",
      "A likely trigger mentioned: 'after the update'"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Whether the bug should be reproduced on staging before a fix",
      "wp-admin access to confirm the plugin version (not stated in the message)",
      "Whether the banner falls under the maintenance retainer or is separate paid work",
      "Banner size, placement, and copy, none of which are specified"
    ],
    "value": "The urgent fix and the low-priority banner stay as two separate tasks instead of one blurred request."
  },
  "painPoints": {
    "title": "Maintenance requests and new work often arrive in the same message.",
    "description": "A bug report about a broken booking plugin can show up in the same WhatsApp message as a request for a new banner, one urgent, one not, with no note on which is which.",
    "supportingDescription": "Text2Task proposes the split. You confirm what belongs to the maintenance retainer and what's new, and nothing saves until you approve it.",
    "items": [
      "Separate plugin, theme, and content fixes from new feature requests.",
      "Keep urgency signals, like 'urgent' or 'no rush,' attached to the right task.",
      "Flag when a request needs wp-admin or hosting access you don't have.",
      "Note whether an issue was seen on staging, production, or both."
    ]
  },
  "workflow": {
    "title": "A three-step WordPress request workflow.",
    "description": "Capture the message, review the split, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the client message",
        "description": "Paste the WhatsApp message, email, or screenshot describing the bug, fix, or new request."
      },
      {
        "title": "Review the proposed split",
        "description": "Check which items look like maintenance, which look like new work, and what access or staging details are missing."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the fixes are ready to work on."
      }
    ]
  },
  "capabilities": {
    "title": "WordPress tasks you can organize in Text2Task",
    "description": "Keep maintenance and support requests clear without losing the client context needed to complete the work.",
    "items": [
      "Plugin update requests",
      "Theme and layout changes",
      "Elementor page fixes",
      "Mobile and responsive issues",
      "Contact-form bugs",
      "WooCommerce updates",
      "Content and copy changes",
      "Image and media replacements",
      "Link and navigation fixes",
      "Deadlines, priorities, and client notes"
    ]
  },
  "clientUpdates": {
    "title": "Track the next bug report against what's already fixed.",
    "description": "When another message comes in, Client Updates checks it against the saved project so repeat issues don't get logged twice.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against tasks already tracked for this client."
      },
      {
        "title": "See what's new versus already logged",
        "description": "Review which issues are new, and which may already be marked fixed or in progress."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You confirm every fix before it's added — Text2Task never marks maintenance work done on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for WordPress Freelancers",
    "items": [
      {
        "question": "Can it tell a maintenance-retainer item apart from new paid work in the same message?",
        "answer": "It can separate them into distinct tasks when the message gives enough context, but deciding what's billable stays with you."
      },
      {
        "question": "Can it flag when a request needs hosting or wp-admin access I don't have?",
        "answer": "It can note that access details are missing from the message. It does not connect to your hosting account, wp-admin, or any plugin directly."
      },
      {
        "question": "Can it capture whether an issue was seen on staging or production?",
        "answer": "Yes, when the client mentions it. If the message doesn't say, Text2Task won't assume one or the other."
      },
      {
        "question": "Does it integrate with WordPress, Elementor, or WooCommerce directly?",
        "answer": "No. Text2Task works from the text or screenshot you provide. It doesn't connect to your site, plugins, or dashboard."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "webflow-freelancers",
    "small-agencies"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Screenshot to Tasks",
        "href": "/features/screenshot-to-tasks",
        "description": "Turn a screenshot of a broken page or plugin error into a reviewable task."
      },
      {
        "label": "How to turn screenshots into tasks",
        "href": "/resources/how-to-turn-screenshots-into-tasks",
        "description": "A practical workflow for organizing requests that arrive as images."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next WordPress support request into a clear maintenance plan.",
    "description": "Capture the client request, review the proposed fixes and tasks, and save only the maintenance work you approve.",
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
    "capabilities",
    "faq",
    "clientUpdates",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
