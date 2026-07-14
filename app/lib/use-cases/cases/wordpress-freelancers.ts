import type { UseCase } from "../types";

export const wordpressFreelancersUseCase = {
  "slug": "wordpress-freelancers",
  "audienceLabel": "WordPress Freelancers",
  "title": "AI WordPress Maintenance Task Manager for Freelancers",
  "seo": {
    "title": "Client Request Management for WordPress Freelancers",
    "description": "Help WordPress freelancers manage client requests by turning maintenance notes, plugin fixes, page edits, and supported screenshots into reviewable project tasks."
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
    "title": "Turn scattered WordPress requests into a",
    "highlight": "clear maintenance plan.",
    "description": "Text2Task turns WordPress client emails, WhatsApp messages, screenshots, and support notes into a structured project and tasks you review and edit before saving.",
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
  "painPoints": {
    "title": "WordPress support requests rarely arrive as one clean ticket.",
    "description": "Plugin, theme, Elementor, content, and form requests can arrive together, with mobile issues mixed into WooCommerce or checkout changes.",
    "supportingDescription": "URLs, screenshots, access notes, assets, deadlines, and priorities can be buried in the message, while copying each issue into a task manager wastes time and makes fixes easier to miss.",
    "items": [
      "Separate plugin, theme, Elementor, content, and form requests into clear tasks.",
      "Keep mobile, WooCommerce, and checkout issues visible beside the rest of the maintenance work.",
      "Carry URLs, screenshots, access notes, assets, deadlines, and priorities into the project plan.",
      "Review the organized maintenance plan instead of rebuilding the support request by hand."
    ]
  },
  "workflow": {
    "title": "From a WordPress support request to approved maintenance work.",
    "description": "Capture the support request, check the proposed maintenance plan, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the WordPress request",
        "description": "Capture the request containing plugin or theme updates, Elementor fixes, mobile problems, broken forms, WooCommerce changes, or content edits."
      },
      {
        "title": "Review the organized maintenance plan",
        "description": "Check each proposed WordPress task, link, deadline, image, client note, and priority, then edit any details before saving."
      },
      {
        "title": "Save the approved tasks",
        "description": "Save the approved project and tasks so the maintenance work is ready for you to complete."
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
    "title": "Handle follow-up WordPress fixes without rebuilding the maintenance plan.",
    "description": "When a client sends another support message, Client Updates compares it with the saved WordPress project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved WordPress project",
        "description": "Analyze the client's additional fixes against the project's existing maintenance tasks and context."
      },
      {
        "title": "Identify new and already-handled fixes",
        "description": "See genuinely new requests alongside work that may already be covered in the maintenance plan."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and choose what to add or update. Text2Task never modifies the project automatically."
      }
    ],
    "note": "You stay in control: Text2Task suggests the fixes, and only the changes you approve are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for WordPress Freelancers",
    "items": [
      {
        "question": "Can Text2Task separate one WordPress support message into multiple tasks?",
        "answer": "Yes. It can organize a mixed support request into separate WordPress tasks that you review before saving."
      },
      {
        "question": "Can it extract WordPress fixes from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the extracted maintenance project and tasks."
      },
      {
        "question": "Can I edit the maintenance plan before saving it?",
        "answer": "Yes. The extracted plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up fixes for an existing WordPress project?",
        "answer": "Client Updates compares the follow-up with the saved project, suggests new or already-handled fixes, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "webflow-freelancers",
    "small-agencies"
  ],
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
  }
} satisfies UseCase;
