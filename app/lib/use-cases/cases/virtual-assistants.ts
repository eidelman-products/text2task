import type { UseCase } from "../types";

export const virtualAssistantsUseCase = {
  "slug": "virtual-assistants",
  "audienceLabel": "Virtual Assistants",
  "title": "AI Task Organization for Virtual Assistants",
  "seo": {
    "title": "AI Task Organization for Virtual Assistants | Text2Task",
    "description": "Text2Task helps virtual assistants turn mixed client messages into organized admin projects and tasks, reducing manual task entry while keeping every plan reviewable."
  },
  "listing": {
    "category": "operations-teams",
    "label": "Virtual Assistants",
    "title": "Organize mixed client instructions",
    "description": "Turn follow-ups, scheduling, spreadsheet updates, research, and reminders into reviewable admin tasks.",
    "highlights": [
      "Client follow-ups",
      "Meeting scheduling",
      "Spreadsheet updates",
      "Invoice reminders"
    ]
  },
  "hero": {
    "title": "Turn mixed client instructions into an",
    "highlight": "organized admin plan",
    "description": "Text2Task turns client emails, WhatsApp messages, screenshots, and notes into a structured project with admin tasks you can review and edit before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/virtual-assistants/virtual-assistant-admin-tasks-project-flow.png",
      "alt": "Virtual assistant workflow showing a mixed client admin message becoming a reviewed Text2Task project and organized admin tasks before saving.",
      "label": "Client instructions to organized admin project",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "painPoints": {
    "title": "One client message can contain an entire admin workload.",
    "description": "Follow-up emails, scheduling changes, spreadsheet updates, meeting notes, invoice reminders, and research requests often arrive together.",
    "supportingDescription": "Dates, names, links, files, and small reminders are easy to miss, and copying every instruction into a task manager wastes time.",
    "items": [
      "Separate mixed admin requests into clear, trackable tasks.",
      "Keep dates, names, links, files, and client context with the work.",
      "Make small follow-ups and reminders visible before they slip through.",
      "Review the organized plan instead of rebuilding it by hand."
    ]
  },
  "workflow": {
    "title": "From client instructions to approved admin work.",
    "description": "Capture the instructions, check the organized admin plan, and save only the work you approve.",
    "steps": [
      {
        "title": "Capture the client instructions",
        "description": "Capture the message containing meeting notes, follow-ups, scheduling, spreadsheet work, reminders, research, or document administration."
      },
      {
        "title": "Review the organized admin plan",
        "description": "Check each admin task, deadline, name, link, file reference, and client detail, then edit anything that needs clarification."
      },
      {
        "title": "Save the approved work",
        "description": "Save the approved project and tasks so the client's admin work is ready to manage."
      }
    ]
  },
  "capabilities": {
    "title": "Admin tasks you can organize in Text2Task",
    "description": "Keep varied admin requests clear without losing the details needed to complete the work.",
    "items": [
      "Client follow-ups",
      "Calendar and meeting scheduling",
      "Meeting-note organization",
      "Spreadsheet updates",
      "Invoice reminders",
      "Research requests",
      "Inbox and email tasks",
      "File and document organization",
      "Contact-detail updates",
      "Delivery deadlines"
    ]
  },
  "clientUpdates": {
    "title": "Handle follow-up instructions without rebuilding the project.",
    "description": "When a client sends a follow-up, Client Updates compares it with the saved project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved project",
        "description": "Analyze the additional admin instructions against the project's existing tasks and context."
      },
      {
        "title": "Identify new and already-handled work",
        "description": "See suggested new requests alongside work that may already be covered in the project."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and select what to apply. Text2Task never modifies the project automatically."
      }
    ],
    "note": "The virtual assistant stays in control: Text2Task suggests updates, and only approved changes are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for Virtual Assistants",
    "items": [
      {
        "question": "Can Text2Task separate one client message into multiple admin tasks?",
        "answer": "Yes. It can organize mixed instructions into separate admin tasks that you review before saving."
      },
      {
        "question": "Can it extract admin tasks from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the extracted project and tasks."
      },
      {
        "question": "Can I edit the admin plan before saving it?",
        "answer": "Yes. The extracted plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up client instructions?",
        "answer": "Client Updates compares the follow-up with the saved project, suggests new or already-handled work, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "small-agencies",
    "social-media-managers",
    "web-designers"
  ],
  "finalCta": {
    "title": "Turn the next client request into a clear admin plan.",
    "description": "Capture the request, review the proposed project and tasks, and save only the work you approve.",
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
