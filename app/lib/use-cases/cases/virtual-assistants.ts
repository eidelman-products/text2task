import type { UseCase } from "../types";

export const virtualAssistantsUseCase = {
  "slug": "virtual-assistants",
  "audienceLabel": "Virtual Assistants",
  "title": "AI Task Organization for Virtual Assistants",
  "seo": {
    "title": "Admin Task Organizer for Virtual Assistants",
    "description": "Turn client Slack messages, emails, and notes with several requests into separated, reviewable admin tasks, scheduling, follow-ups, and reminders included."
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
    "title": "Stop losing one task inside someone else's paragraph.",
    "highlight": "Split every ask before it slips through.",
    "description": "Paste a client's Slack message, email, or note with several requests in one place. Text2Task separates it into individual tasks, scheduling, follow-ups, research, reminders, that you review before saving.",
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
  "heroVariant": "reversed",
  "accentTone": "blue",
  "signatureModule": {
    "kind": "board",
    "title": "One message, split into operations lanes",
    "description": "Example breakdown of a multi-part request, like Renata's.",
    "note": "Example workflow — not an automated decision.",
    "groups": [
      {
        "label": "Scheduling",
        "items": [
          { "label": "Reschedule 2pm with Marcus to Thursday" }
        ]
      },
      {
        "label": "Follow-up",
        "items": [
          { "label": "Denver conference organizers — speaker fee" }
        ]
      },
      {
        "label": "Research",
        "items": [
          { "label": "Hotel near venue, ~$220/night" }
        ]
      },
      {
        "label": "Admin",
        "items": [
          { "label": "Update client tracker with 3 leads" },
          { "label": "Friday reminder: send Marcus's invoice" }
        ]
      }
    ]
  },
  "transformation": {
    "title": "From one long message to five separate tasks.",
    "description": "Example: a Slack DM asking for a reschedule, a follow-up, a spreadsheet update, travel research, and a reminder, all in one message.",
    "beforeLabel": "Slack DM",
    "beforeText": "\"Hi — can you reschedule my 2pm with Marcus to Thursday, follow up with the Denver conference organizers about my speaker fee (haven't heard back in a week), update the client tracker with the 3 new leads from yesterday's webinar, and see if you can find a nicer hotel near the venue for the Denver trip, budget around $220/night. Also remind me Friday to send Marcus his invoice.\" — Renata, Sowell Consulting",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Reschedule the 2pm with Marcus to Thursday",
      "Follow up with Denver conference organizers about the speaker fee",
      "Update the client tracker with 3 new webinar leads",
      "Research a hotel near the venue, budget around $220/night",
      "Friday reminder to send Marcus his invoice"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "No last name or contact info given for Marcus or the organizers",
      "No deadline stated for the hotel research",
      "Access details for the client tracker not included",
      "Confirming the tone for the overdue follow-up"
    ],
    "value": "Five separate tasks instead of one paragraph, with the details that matter to each one kept attached."
  },
  "painPoints": {
    "title": "One message can hide five unrelated tasks.",
    "description": "A single Slack DM might ask you to reschedule a meeting, chase an unanswered email, update a spreadsheet, book travel, and set a reminder, all in one unnumbered paragraph.",
    "supportingDescription": "Text2Task proposes the split. You confirm contacts, deadlines, and access needs, and nothing saves until you approve it.",
    "items": [
      "Separate several unrelated asks in one message into individual tasks.",
      "Keep a contact's name attached to the right follow-up, even with only a first name given.",
      "Flag when a task needs login or account access you don't have.",
      "Preserve reminders and their exact due date or day."
    ]
  },
  "workflow": {
    "title": "A three-step admin request workflow.",
    "description": "Capture the message, review the split, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the client message",
        "description": "Paste the Slack message, email, or note with the day's requests."
      },
      {
        "title": "Review the proposed tasks",
        "description": "Check that each ask was separated correctly, along with contacts, deadlines, and anything missing."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the admin work is ready to track."
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
    "title": "Track the next round of requests without losing the last one.",
    "description": "When another message comes in, Client Updates checks it against the saved project so a repeated ask doesn't get logged twice.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against admin tasks already tracked for this client."
      },
      {
        "title": "See what's new versus already handled",
        "description": "Review which requests are new, and which may already be in progress or done."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You confirm every task before it's added — Text2Task never sends emails, books travel, or updates records on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Virtual Assistants",
    "items": [
      {
        "question": "Can it split one message with several unrelated asks into separate tasks?",
        "answer": "Yes. When a message contains multiple distinct requests, Text2Task organizes them into individual tasks instead of one combined note."
      },
      {
        "question": "Can it flag when a task needs account access or login details I don't have?",
        "answer": "It can note that access information wasn't included in the request. It does not log into any account, tool, or system on your behalf."
      },
      {
        "question": "Can it keep a follow-up tied to the right contact, even with only a first name?",
        "answer": "Yes, it keeps whatever contact detail is given attached to that task. If more than one person shares a name, it's worth double-checking before you reach out."
      },
      {
        "question": "Does it send emails, schedule meetings, or book anything automatically?",
        "answer": "No. Text2Task only turns the request into a reviewable task. It does not send messages, update calendars, or make bookings on its own."
      }
    ]
  },
  "relatedSlugs": [
    "small-agencies",
    "social-media-managers",
    "web-designers"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Email to Tasks",
        "href": "/features/email-to-tasks",
        "description": "Turn a long client email with several requests into a reviewable project."
      },
      {
        "label": "How to extract action items from text",
        "href": "/resources/how-to-extract-action-items-from-text",
        "description": "A practical workflow for separating action items without losing context."
      }
    ]
  },
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
  },
  "sectionOrder": [
    "signatureModule",
    "painPoints",
    "transformation",
    "workflow",
    "faq",
    "capabilities",
    "clientUpdates",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
