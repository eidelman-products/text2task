import type { UseCase } from "../types";

export const webflowFreelancersUseCase = {
  "slug": "webflow-freelancers",
  "audienceLabel": "Webflow Freelancers",
  "title": "AI Webflow Launch Task Manager for Freelancers",
  "seo": {
    "title": "Webflow Launch & Revision Task Manager for Freelancers",
    "description": "Turn Webflow client feedback about CMS updates, breakpoints, and interactions into organized tasks, split from new build work and reviewed before saving."
  },
  "listing": {
    "category": "website-development",
    "label": "Webflow Freelancers",
    "title": "Turn Webflow feedback into launch tasks",
    "description": "Organize CMS updates, responsive fixes, component changes, forms, and launch notes into a reviewable project plan.",
    "highlights": [
      "CMS collection updates",
      "Responsive breakpoint fixes",
      "Component changes",
      "Launch requirements"
    ]
  },
  "hero": {
    "title": "Stop rebuilding CMS requests from a screenshot.",
    "highlight": "Keep content edits separate from new builds.",
    "description": "Paste a client's message or forward a screenshot about a CMS update, a broken breakpoint, or a new interaction. Text2Task organizes it into tasks, flagging what's a content edit versus a design build, that you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/text2task-client-gmail-webflow-freelancers.png",
      "alt": "Webflow client launch email containing CMS layout, mobile navigation, form connection, content, image, FAQ, deadline, budget, and attached launch-asset requests.",
      "label": "Webflow client launch request",
      "width": 1586,
      "height": 992,
      "role": "source",
      "priority": true
    }
  },
  "heroVariant": "centered",
  "accentTone": "teal",
  "signatureModule": {
    "kind": "timeline",
    "title": "A launch-readiness checkpoint flow",
    "description": "Example sequence for getting a Webflow site ready to publish.",
    "note": "Example workflow — not an automated decision.",
    "items": [
      { "marker": "01", "label": "CMS content confirmed", "description": "Collection entries and copy match the brief." },
      { "marker": "02", "label": "Components reviewed" },
      { "marker": "03", "label": "Breakpoints checked", "description": "Desktop, tablet, and mobile layouts hold up." },
      { "marker": "04", "label": "Interactions tested" },
      { "marker": "05", "label": "Forms connected" },
      { "marker": "06", "label": "Domain and publishing settings confirmed" },
      { "marker": "07", "label": "Final client approval" }
    ]
  },
  "transformation": {
    "title": "From a forwarded screenshot to a split task list.",
    "description": "Example: an internal client thread forwarded as a screenshot, mixing a CMS update with a layout fix.",
    "beforeLabel": "Forwarded screenshot",
    "beforeText": "A Slack thread, forwarded as an image: the client's ops manager writes, \"the Locations CMS collection needs the new Riverside branch added, plus can we make the pricing table collapse into an accordion on tablet, right now it just looks broken between 768–991px,\" and the client replies, \"agree, let's get this in before we open bookings next month.\" — Priya, Loomwell Coworking",
    "inputTitle": "What Text2Task can identify",
    "inputs": [
      "Add a new Riverside branch entry to the Locations CMS Collection",
      "Fix the pricing table layout specifically at the 768–991px tablet range",
      "Deadline tied to 'opening bookings next month,' though no exact date is given"
    ],
    "outputTitle": "What still needs a decision",
    "outputs": [
      "Whether the accordion behavior needs a new Interaction built, not just a layout tweak",
      "Content for the new Riverside entry: address, hours, and images aren't included",
      "The exact launch date, to set a real deadline",
      "Who has Editor access versus who needs the Designer"
    ],
    "value": "The CMS content update and the interaction build stay as two separate, clearly scoped tasks."
  },
  "painPoints": {
    "title": "Webflow feedback mixes CMS edits with real design work.",
    "description": "A request to add a CMS Collection entry can arrive in the same thread as a request for a new accordion interaction, one is a content update, the other is a build.",
    "supportingDescription": "Text2Task proposes the split. You confirm what's a quick CMS edit and what needs Designer-level work, and nothing saves until you approve it.",
    "items": [
      "Separate CMS Collection updates from interaction and layout builds.",
      "Flag feedback tied to a specific breakpoint, like mobile, tablet, or desktop.",
      "Keep launch or publish deadlines attached to the right task.",
      "Note whether the client wants to make a change themselves in the Client Editor."
    ]
  },
  "workflow": {
    "title": "A three-step Webflow request workflow.",
    "description": "Capture the request, review the split, and save only the tasks you approve.",
    "steps": [
      {
        "title": "Capture the client request",
        "description": "Paste the message or upload a screenshot describing the CMS change, layout issue, or new interaction."
      },
      {
        "title": "Review the proposed split",
        "description": "Check which items are content edits, which need Designer-level work, and which breakpoint is affected."
      },
      {
        "title": "Save the tasks you approve",
        "description": "Edit anything unclear, then save the approved tasks so the build work is ready to start."
      }
    ]
  },
  "capabilities": {
    "title": "Webflow tasks you can organize in Text2Task",
    "description": "Keep build, revision, and launch requests clear without losing the client context needed to complete the work.",
    "items": [
      "CMS collection updates",
      "Responsive breakpoint fixes",
      "Component changes",
      "Section and layout revisions",
      "Form connection requests",
      "Interaction and animation notes",
      "Content and image replacements",
      "Navigation and link updates",
      "SEO and metadata notes",
      "Launch deadlines and client references"
    ]
  },
  "clientUpdates": {
    "title": "Track the next request against what's already live.",
    "description": "When another message comes in, Client Updates checks it against the saved project so repeat requests don't get built twice.",
    "steps": [
      {
        "title": "Compare the new message with the saved project",
        "description": "Text2Task checks the follow-up against tasks already tracked for this site."
      },
      {
        "title": "See what's new versus already handled",
        "description": "Review which requests are new, and which may already be published or in progress."
      },
      {
        "title": "Approve what should change",
        "description": "Choose which updates to apply. Nothing changes in your saved project automatically."
      }
    ],
    "note": "You confirm every change before it's added — Text2Task never publishes or edits your Webflow site on its own."
  },
  "faq": {
    "title": "Questions about using Text2Task for Webflow Freelancers",
    "items": [
      {
        "question": "Can it tell a CMS content edit apart from a request that needs a new build?",
        "answer": "It can flag language that suggests new interactions, layout changes, or structural work, separate from a simple content edit. The final call on scope stays with you."
      },
      {
        "question": "Can it capture feedback tied to a specific breakpoint?",
        "answer": "Yes, when the client names or clearly describes the breakpoint, like 'on tablet' or 'between 768 and 991px.' It won't invent a breakpoint that wasn't mentioned."
      },
      {
        "question": "Does it publish changes or connect to my Webflow site?",
        "answer": "No. Text2Task only organizes the text or screenshot you provide. It does not access your Webflow account, CMS, or Designer."
      },
      {
        "question": "Can it flag when a client wants to make an edit themselves in the Client Editor?",
        "answer": "It can note that intent when it's stated in the message, so you know which tasks are yours to build and which the client plans to handle."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "wordpress-freelancers",
    "small-agencies"
  ],
  "relatedLinks": {
    "title": "Related reading",
    "links": [
      {
        "label": "Explore Client Feedback to Tasks",
        "href": "/features/client-feedback-to-tasks",
        "description": "Compare a new round of feedback against a Webflow project you've already saved."
      },
      {
        "label": "How to turn screenshots into tasks",
        "href": "/resources/how-to-turn-screenshots-into-tasks",
        "description": "A practical workflow for organizing requests that arrive as forwarded screenshots."
      }
    ]
  },
  "finalCta": {
    "title": "Turn the next Webflow feedback message into a clear launch plan.",
    "description": "Capture the client request, review the proposed changes and tasks, and save only the launch work you approve.",
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
    "capabilities",
    "workflow",
    "painPoints",
    "relatedLinks",
    "faq",
    "clientUpdates",
    "related",
    "finalCta"
  ]
} satisfies UseCase;
