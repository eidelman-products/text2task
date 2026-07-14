import type { UseCase } from "../types";

export const smallAgenciesUseCase = {
  "slug": "small-agencies",
  "audienceLabel": "Small Agencies",
  "title": "AI Client Request Task Manager for Small Agencies",
  "seo": {
    "title": "Client Request Management for Small Agencies",
    "description": "Help small agencies manage client requests by turning multi-client project intake, creative feedback, content notes, and updates into reviewable tasks."
  },
  "listing": {
    "category": "operations-teams",
    "label": "Small Agencies",
    "title": "Coordinate requests across clients",
    "description": "Turn each website, creative, content, campaign, or approval request into reviewable project tasks for client delivery.",
    "highlights": [
      "Website requests",
      "Creative revisions",
      "Campaign updates",
      "Delivery requirements"
    ]
  },
  "hero": {
    "title": "Turn scattered requests from multiple clients into a",
    "highlight": "clear agency delivery plan.",
    "description": "Text2Task turns each client email, WhatsApp message, screenshot, revision note, or mixed request into a structured project and tasks you review and edit before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/New-Task-CRM.png",
      "alt": "Text2Task Task CRM showing multiple client projects with tasks, budgets, deadlines, priorities, statuses, resources, and update controls for agency delivery.",
      "label": "Organized multi-client agency work",
      "width": 1241,
      "height": 746,
      "role": "product",
      "priority": true
    }
  },
  "painPoints": {
    "title": "Agency requests rarely arrive as one clean delivery brief.",
    "description": "For each client, website edits, creative requests, campaign changes, content tasks, and approval notes can arrive together while several projects are active.",
    "supportingDescription": "Deadlines, assets, links, budgets, priorities, and client details can be buried across messages, screenshots, and notes, making manual copying slow and small follow-ups easier to miss.",
    "items": [
      "Separate each client's mixed request into clear project tasks.",
      "Keep each client's context, files, links, deadlines, and budget with the correct work.",
      "Make small follow-ups and delivery requirements visible across active projects.",
      "Review the organized plan instead of rebuilding every request manually."
    ]
  },
  "workflow": {
    "title": "From client request to approved agency work.",
    "description": "Capture the request, review the proposed project plan, and save only the client work you approve.",
    "steps": [
      {
        "title": "Capture the client request",
        "description": "Capture website, design, content, campaign, revision, approval, or delivery requests from messages, email, screenshots, or notes."
      },
      {
        "title": "Review the organized delivery plan",
        "description": "Check tasks, client details, deadlines, priorities, budgets, assets, links, and references before saving."
      },
      {
        "title": "Save the approved project work",
        "description": "Save the approved project and tasks so the client work is ready to manage and deliver."
      }
    ]
  },
  "capabilities": {
    "title": "Agency work you can organize in Text2Task",
    "description": "Keep mixed client-service requests clear without losing the context needed for delivery.",
    "items": [
      "Website and landing-page requests",
      "Graphic-design revisions",
      "Social media content tasks",
      "Campaign updates",
      "Client approval notes",
      "Copy and content changes",
      "Assets, links, and reference files",
      "Delivery deadlines",
      "Budgets and priorities",
      "Client contact details"
    ]
  },
  "clientUpdates": {
    "title": "Handle follow-up client requests without rebuilding the delivery plan.",
    "description": "When a client sends another message, Client Updates compares it with the saved project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved client project",
        "description": "Analyze the additional request against the project's existing tasks and delivery context."
      },
      {
        "title": "Identify new and already-handled work",
        "description": "See genuinely new requests alongside work that may already be covered in the project."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and choose what to add or update. Text2Task never modifies the project automatically."
      }
    ],
    "note": "The agency stays in control: Text2Task suggests updates, and only approved changes are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for Small Agencies",
    "items": [
      {
        "question": "Can Text2Task separate one mixed client message into multiple project tasks?",
        "answer": "Yes. It can organize a mixed client request into separate project tasks that you review before saving."
      },
      {
        "question": "Can it extract agency work from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the proposed project and tasks."
      },
      {
        "question": "Can I edit the delivery plan before saving it?",
        "answer": "Yes. The proposed plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up requests for an existing client project?",
        "answer": "Client Updates compares the follow-up with saved work, suggests new or already-handled tasks, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "virtual-assistants",
    "social-media-managers",
    "web-designers"
  ],
  "finalCta": {
    "title": "Turn the next client request into a clear agency delivery plan.",
    "description": "Capture the request, review the proposed project and tasks, and save only the client work you approve.",
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
