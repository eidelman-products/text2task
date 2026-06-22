import type { UseCase } from "../types";

export const freelanceDevelopersUseCase = {
  "slug": "freelance-developers",
  "audienceLabel": "Freelance Developers",
  "title": "AI Client Request Organizer for Freelance Developers",
  "seo": {
    "title": "AI Task Organizer for Freelance Developers | Text2Task",
    "description": "Save time by turning pasted client requests, feature changes, screenshots, mobile fixes, priorities, and deadlines into proposed development tasks you review before saving."
  },
  "listing": {
    "category": "website-development",
    "label": "Freelance Developers",
    "title": "Spend less time turning client requests into tasks",
    "description": "Organize feature requests, UI changes, mobile fixes, client-reported bugs, screenshots, priorities, and deadlines into proposed development tasks you review before saving.",
    "highlights": [
      "Client bug reports",
      "Feature and UI requests",
      "Browser and device details",
      "Priorities and deadlines"
    ]
  },
  "hero": {
    "title": "Stop typing client requests into task lists.",
    "highlight": "Get back to building.",
    "description": "Paste a client message, email, or screenshot. Text2Task extracts feature requests, UI changes, mobile fixes, bug notes, priorities, deadlines, and supplied technical details into a project and tasks you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/freelance-developers/freelance-developer-client-request-project-flow.png",
      "alt": "Freelance developer workflow showing a client request becoming proposed feature, UI, mobile, fix, priority, deadline, and technical-context tasks for review before saving.",
      "label": "Client bug report to reviewed development project",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "painPoints": {
    "title": "Manual task entry steals time from the actual development work.",
    "description": "A client message can combine feature requests, UI changes, mobile fixes, client-reported bugs, screenshots, browser or device details, priorities, and deadlines.",
    "supportingDescription": "Creating and organizing each task by hand wastes time before development starts and can separate technical details from the request they belong to. Text2Task proposes the project and tasks for you to review and approve before saving; it does not investigate, debug, test, code, or implement the request.",
    "items": [
      "Separate feature requests, UI changes, mobile fixes, and client-reported bugs.",
      "Keep supplied screenshots, reproduction notes, browser, device, and error details with the relevant task.",
      "Preserve page URLs, priorities, deadlines, and acceptance requirements.",
      "Compare follow-up requests with the saved project instead of rebuilding the task list."
    ]
  },
  "workflow": {
    "title": "Get client requests ready for development without rebuilding the task list.",
    "description": "Paste the request, review the proposed project and tasks, and save only the development work you approve.",
    "steps": [
      {
        "title": "Capture the client request",
        "description": "Paste the client message or upload a screenshot containing the available features, fixes, issue details, and requested changes."
      },
      {
        "title": "Review the proposed development work",
        "description": "Check UI changes, mobile fixes, bug notes, supplied reproduction details, URLs, screenshots, browser and device information, priorities, deadlines, and acceptance requirements."
      },
      {
        "title": "Approve the project and tasks",
        "description": "Edit assumptions, remove unclear items, and save only the development work you approve."
      }
    ]
  },
  "capabilities": {
    "title": "Keep client request details organized without manual task entry",
    "description": "Keep features, fixes, screenshots, deadlines, and supplied technical context connected to the proposed tasks instead of typing everything into a task manager by hand.",
    "items": [
      "Feature requests",
      "UI changes",
      "Mobile and responsive fixes",
      "Client-reported bugs",
      "Supplied reproduction notes",
      "Browser and device details",
      "Error text supplied by the client",
      "Page URLs and screenshot references",
      "Priorities and deadlines",
      "Follow-up and acceptance requirements"
    ]
  },
  "clientUpdates": {
    "title": "Review follow-up requests without checking every saved task by hand.",
    "description": "When a client sends another change or requirement, Client Updates compares it with the saved development project so you can review possible additions without manually rebuilding the task list.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved development project",
        "description": "Analyze the supplied change or requirement against existing features, fixes, UI work, and project context."
      },
      {
        "title": "Separate possible additions from covered work",
        "description": "Review potentially new requests beside items that may already be represented in the saved project."
      },
      {
        "title": "Approve only the selected changes",
        "description": "Choose which suggested tasks or project details should be applied."
      }
    ],
    "note": "Text2Task proposes development-task updates; you choose what to apply, and no saved work changes without approval."
  },
  "faq": {
    "title": "Questions about using Text2Task for Freelance Developers",
    "items": [
      {
        "question": "Can Text2Task access my source code or repository?",
        "answer": "No. Text2Task only organizes text and screenshots you provide. It does not access source code, repositories, or version-control platforms."
      },
      {
        "question": "Can it organize feature requests, UI changes, and client-reported bugs?",
        "answer": "Yes. It can organize those details when they are included in supplied text or screenshots. It does not investigate, debug, test, code, or implement them."
      },
      {
        "question": "Can it preserve screenshots, browser details, priorities, and deadlines?",
        "answer": "Yes. When those details appear in supplied text or a screenshot, Text2Task can keep them with the proposed project and tasks."
      },
      {
        "question": "How are follow-up development requests handled?",
        "answer": "Client Updates compares the supplied follow-up with the saved project and lets you approve relevant additions or changes. It does not change code, deploy work, or update the project automatically."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "wordpress-freelancers",
    "project-managers"
  ],
  "finalCta": {
    "title": "Skip the task setup. Spend more time on the project.",
    "description": "Paste the client request, review the proposed project and tasks, and save only the development work you approve.",
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
