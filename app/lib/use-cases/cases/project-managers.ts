import type { UseCase } from "../types";

export const projectManagersUseCase = {
  "slug": "project-managers",
  "audienceLabel": "Project Managers",
  "title": "AI Project Request Organizer for Project Managers",
  "seo": {
    "title": "AI Project Request Organizer for Project Managers | Text2Task",
    "description": "Save time by turning pasted stakeholder requests, meeting notes, screenshots, and scope changes into proposed projects and tasks you review before saving."
  },
  "listing": {
    "category": "operations-teams",
    "label": "Project Managers",
    "title": "Stop rebuilding stakeholder requests by hand",
    "description": "Turn stakeholder messages, meeting notes, scope changes, deadlines, approvals, and blocker notes into proposed projects and tasks you review before saving.",
    "highlights": [
      "Stakeholder action items",
      "Scope-change requests",
      "Blocker and dependency notes",
      "Approvals and deadlines"
    ]
  },
  "hero": {
    "title": "Stop retyping stakeholder requests into",
    "highlight": "projects and tasks.",
    "description": "Paste a stakeholder message, meeting note, or screenshot. Text2Task extracts the action items, deadlines, priorities, budgets, approval requirements, and blocker notes into a project you review and edit before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/project-managers/project-manager-stakeholder-request-project-flow.png",
      "alt": "Project management workflow showing a stakeholder request becoming proposed action items, blocker notes, deadlines, priorities, and approvals for review before saving.",
      "label": "Stakeholder request to reviewed project work",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "painPoints": {
    "title": "Project managers lose hours rebuilding stakeholder messages by hand.",
    "description": "Stakeholder messages can contain deliverables, action items, deadlines, approvals, blocker notes, details about who is responsible, priorities, and budget information in one place.",
    "supportingDescription": "Manually copying those details into a project and rebuilding its tasks wastes time and can separate important work from its original context. Text2Task proposes the organized project and tasks, and you review and approve the result before anything is saved.",
    "items": [
      "Separate deliverables, action items, decisions, and scope changes.",
      "Preserve owner, blocker, dependency, and approval notes supplied in the source.",
      "Keep deadlines, priorities, budgets, links, and meeting references visible.",
      "Compare follow-ups with saved work before accepting project changes."
    ]
  },
  "workflow": {
    "title": "Make stakeholder input ready for project review.",
    "description": "Paste the request, review the proposed project and tasks, and save only the work you approve—without rebuilding everything manually.",
    "steps": [
      {
        "title": "Capture the decision context",
        "description": "Paste a stakeholder request or meeting notes, or upload a screenshot containing the supplied action items and project details."
      },
      {
        "title": "Inspect the proposed project work",
        "description": "Review deliverables, action items, owner notes supplied in the request, blocker and dependency context, deadlines, priorities, budgets, links, and approval requirements found in the source."
      },
      {
        "title": "Approve the project record",
        "description": "Edit or remove anything that is unclear, then save only the project and tasks you approve."
      }
    ]
  },
  "capabilities": {
    "title": "Project details worth preserving from the first message",
    "description": "Keep the stakeholder context with the proposed work without manually retyping every action item, deadline, approval, or blocker note.",
    "items": [
      "Stakeholder requests",
      "Meeting action items",
      "Scope-change requests",
      "Deliverables and acceptance notes",
      "Owner notes supplied in the request",
      "Blocker and dependency notes",
      "Approval requirements",
      "Deadlines and milestones",
      "Priorities and budget constraints",
      "Files, links, and meeting references"
    ]
  },
  "clientUpdates": {
    "title": "See what a scope change adds—and what the project already covers.",
    "description": "When another stakeholder message arrives, Client Updates compares it with the saved project and proposes what may need attention, so you can review the follow-up without manually rebuilding the full task list.",
    "steps": [
      {
        "title": "Compare the scope note with the saved project",
        "description": "Analyze the supplied follow-up against existing deliverables, tasks, and project context."
      },
      {
        "title": "Review new and covered work",
        "description": "See possible additions beside requests that may already be handled in the saved project."
      },
      {
        "title": "Select the approved changes",
        "description": "Choose which suggested tasks or project details should be applied."
      }
    ],
    "note": "Text2Task proposes project updates; the project manager chooses what to apply, and no saved work changes without approval."
  },
  "faq": {
    "title": "Questions about using Text2Task for Project Managers",
    "items": [
      {
        "question": "Does Text2Task replace Jira, Asana, ClickUp, Trello, or monday.com?",
        "answer": "No. It organizes supplied stakeholder requests into proposed project work that you review before using in your workflow."
      },
      {
        "question": "Can Text2Task identify blockers and dependencies?",
        "answer": "It can preserve blocker and dependency details stated in the supplied text or screenshot. It does not discover, calculate, or automate them."
      },
      {
        "question": "Can it organize meeting notes and screenshots?",
        "answer": "Yes. Paste meeting notes or upload a screenshot, then review the proposed project and action items before saving."
      },
      {
        "question": "Are scope changes applied automatically?",
        "answer": "No. Client Updates suggests possible changes, and you decide what should be applied."
      }
    ]
  },
  "relatedSlugs": [
    "small-agencies",
    "virtual-assistants",
    "web-designers"
  ],
  "finalCta": {
    "title": "Skip the manual project setup on your next stakeholder request.",
    "description": "Paste the message, review the proposed project and action items, and save only the work you approve.",
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
