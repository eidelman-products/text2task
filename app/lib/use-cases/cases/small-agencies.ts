import type { UseCase } from "../types";

export const smallAgenciesUseCase = {
  "slug": "small-agencies",
  "audienceLabel": "Small Agencies",
  "title": "AI Client Request Task Manager for Small Agencies",
  "seo": {
    "title": "Multi-Client Task Organizer for Small Agencies",
    "description": "Turn forwarded client emails and messages into tasks tagged by account and ready to assign, so requests don't get lost across multiple clients."
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
    "title": "Stop letting requests get lost between clients.",
    "highlight": "Keep every account's work separate and owned.",
    "description": "Paste a forwarded client email, WhatsApp message, or account-manager note. Text2Task organizes it into tasks, tagged to the right client and ready to assign, that your team reviews before saving.",
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
  "heroVariant": "wide",
  "accentTone": "teal",
  "signatureModule": {
    "kind": "pipeline",
    "title": "A multi-client delivery pipeline",
    "description": "Example view of active requests across two client accounts.",
    "note": "Example workflow — not an automated decision.",
    "rows": [
      { "client": "Halversen Legal", "project": "Attorney bios update", "owner": "Unassigned", "status": "Waiting for owner" },
      { "client": "Birchmere Dental", "project": "Homepage refresh", "owner": "Web team", "status": "Ready for review" },
      { "client": "Halversen Legal", "project": "New hire headshot", "owner": "Unassigned", "status": "Low priority" }
    ]
  },
  "transformation": {
    "title": "From a forwarded thread to an assigned, client-tagged task.",
    "description": "Example: an account manager forwards a client request with her own note, referencing a previous request that sat too long.",
    "beforeLabel": "Forwarded email thread",
    "beforeText": "Client, Halversen Legal: \"Can someone update the attorney bios page, Rebecca made partner so her title needs to change everywhere, and can we get the new hire's headshot up too, she starts next Monday.\" Deja's forwarded note: \"can someone on web pick this up, low priority but let's not let it sit like the Birchmere one did.\"",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Update Rebecca's title site-wide (partner promotion)",
      "Add the new hire's headshot before she starts Monday",
      "Client: Halversen Legal",
      "Marked low priority by the account manager"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "'Everywhere' likely means more than one page, worth confirming which ones",
      "No headshot file attached or referenced in the forward",
      "No team member assigned yet",
      "Whether 'low priority' still needs a hard deadline before Monday"
    ],
    "value": "The request stays tagged to Halversen Legal with a note on urgency, instead of sitting unowned in a shared inbox."
  },
  "painPoints": {
    "title": "A request forwarded into a shared inbox can sit unassigned.",
    "description": "An account manager forwards a client's email with a quick note on top, but without a clear owner, it can sit exactly where the last one did before someone finally picked it up.",
    "supportingDescription": "Text2Task proposes the task and keeps it tied to the right client. Your team still decides who owns it and when it happens, and nothing saves until someone approves it.",
    "items": [
      "Keep each client's request in its own project, not mixed with another account.",
      "Preserve who a request should be routed to when a name is mentioned.",
      "Flag when a task is time-sensitive for the team, not just whoever received it.",
      "Note when 'update it everywhere' likely means more than one page or file."
    ]
  },
  "workflow": {
    "title": "A three-step multi-client request workflow.",
    "description": "Capture the request, review the assignment, and save only the tasks your team approves.",
    "steps": [
      {
        "title": "Capture the client request",
        "description": "Paste the forwarded email, message, or account-manager note describing the request."
      },
      {
        "title": "Review the proposed task",
        "description": "Check the client it's tagged to, who it should be routed to, and how urgent it actually is."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved task so it's assigned and ready to work on."
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
    "title": "Track the next request without mixing up accounts.",
    "description": "When another message comes in, Client Updates checks it against the saved project for that specific client, not the whole agency's workload.",
    "steps": [
      {
        "title": "Compare the new message with the saved client project",
        "description": "Text2Task checks the follow-up against tasks already tracked for that account."
      },
      {
        "title": "See what's new versus already assigned",
        "description": "Review which requests are new, and which may already be owned by someone on the team."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "Your team confirms every assignment — Text2Task never routes or applies work on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Small Agencies",
    "items": [
      {
        "question": "Can it keep requests separated by client so they don't get mixed into another account's project?",
        "answer": "Yes. Each request is organized into the project you save it to, keeping one client's work distinct from another's."
      },
      {
        "question": "Does it preserve who a request should be routed to?",
        "answer": "Yes, when a name or team is mentioned in the message, Text2Task keeps that detail with the task. It does not assign work in your project-management tool directly."
      },
      {
        "question": "Can it flag when a request buried in a forwarded thread is actually time-sensitive?",
        "answer": "It can surface urgency language when it's stated, like a deadline or a note about priority. It won't infer urgency that wasn't mentioned."
      },
      {
        "question": "Can it organize requests from several clients at once?",
        "answer": "Yes, but each request should be reviewed and saved into the correct client's project. Text2Task doesn't merge separate clients' work into one task list automatically."
      }
    ]
  },
  "relatedSlugs": [
    "virtual-assistants",
    "social-media-managers",
    "web-designers"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Freelancer project management software",
        "href": "/solutions/freelancer-project-management-software",
        "description": "See how projects, tasks, and client updates stay organized across accounts."
      },
      {
        "label": "How to organize client requests as a freelancer",
        "href": "/resources/how-to-organize-client-requests-as-a-freelancer",
        "description": "A workflow for capturing and prioritizing requests before they get lost."
      }
    ]
  },
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
  },
  "sectionOrder": [
    "signatureModule",
    "clientUpdates",
    "transformation",
    "painPoints",
    "workflow",
    "faq",
    "capabilities",
    "relatedLinks",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
