import type { UseCase } from "../types";

export const seoFreelancersUseCase = {
  "slug": "seo-freelancers",
  "audienceLabel": "SEO Freelancers",
  "title": "AI SEO Request Organizer for Freelancers",
  "seo": {
    "title": "AI SEO Task Organizer for Freelancers | Text2Task",
    "description": "Save time by turning pasted client SEO instructions, page URLs, metadata changes, internal links, redirects, screenshots, and deadlines into proposed tasks you review before saving."
  },
  "listing": {
    "category": "website-development",
    "label": "SEO Freelancers",
    "title": "Reduce manual task entry for client SEO changes",
    "description": "Organize supplied page URLs, metadata changes, internal links, content notes, redirects, alt text requests, priorities, and deadlines into proposed SEO tasks you review before saving.",
    "highlights": [
      "Page-level SEO changes",
      "Title tags and meta descriptions",
      "Internal links and redirects",
      "Priorities and deadlines"
    ]
  },
  "hero": {
    "title": "Skip the SEO task setup.",
    "highlight": "Start improving pages sooner.",
    "description": "Paste a client email, message, or screenshot. Text2Task extracts supplied page URLs, title tag and meta description changes, internal links, content notes, redirects, alt text requests, priorities, and deadlines into a project and tasks you review before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/seo-freelancers/seo-client-request-project-flow.png",
      "alt": "SEO freelancer workflow showing a client request becoming proposed page URL, title tag, meta description, internal link, redirect, alt text, priority, and deadline tasks for review before saving.",
      "label": "Client SEO instructions to reviewed page tasks",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "painPoints": {
    "title": "SEO work stalls when every page change has to be typed out by hand.",
    "description": "One client request can combine several URLs, title tags, meta descriptions, internal links, headings, content notes, redirects, alt text requests, approvals, priorities, and deadlines.",
    "supportingDescription": "Creating and organizing each page task by hand wastes time before optimization begins and can attach details to the wrong work or miss them entirely. Text2Task proposes the project and tasks for you to review and approve before saving; it does not audit, crawl, research, or implement the changes.",
    "items": [
      "Separate page-level metadata, content, linking, redirect, and image requests.",
      "Keep supplied URLs, keywords, headings, links, and reference notes with the correct page task.",
      "Preserve priorities, deadlines, approvals, and implementation instructions.",
      "Compare follow-up SEO changes with the saved project instead of rebuilding the task list."
    ]
  },
  "workflow": {
    "title": "Move from client instructions to page-level SEO work without rebuilding the brief.",
    "description": "Paste the SEO request, review the proposed project and tasks, and save only the page changes you approve.",
    "steps": [
      {
        "title": "Capture the supplied SEO instructions",
        "description": "Paste the client message or upload a screenshot containing the available page URLs, metadata, content, linking, redirect, image, and deadline requirements."
      },
      {
        "title": "Review the proposed page tasks",
        "description": "Check URLs, title tags, meta descriptions, headings, internal links, redirects, alt text notes, supplied keywords, priorities, deadlines, and approvals."
      },
      {
        "title": "Approve the SEO project and tasks",
        "description": "Edit unclear details, remove incorrect assumptions, and save only the page-level work you approve."
      }
    ]
  },
  "capabilities": {
    "title": "Keep every supplied SEO change attached to the right page",
    "description": "Keep URLs, metadata, links, content notes, redirects, deadlines, and supplied search instructions connected to the proposed tasks instead of typing everything into a task manager by hand.",
    "items": [
      "Page URLs and page-level instructions",
      "Title tag changes",
      "Meta description changes",
      "Internal link requests",
      "Heading and on-page copy updates",
      "Content brief requirements",
      "Keyword instructions supplied by the client",
      "Redirect requests",
      "Image alt text requests",
      "Priorities, deadlines, and approvals"
    ]
  },
  "clientUpdates": {
    "title": "Review the next SEO change without checking the whole task list again.",
    "description": "When a client sends another page change or SEO instruction, Client Updates compares it with the saved project so you can review possible additions without manually rebuilding the full task list.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved SEO project",
        "description": "Analyze the supplied request against existing page, metadata, content, linking, redirect, and image tasks."
      },
      {
        "title": "Separate possible additions from covered work",
        "description": "Review potentially new changes beside requests that may already be represented in the saved project."
      },
      {
        "title": "Approve only the selected changes",
        "description": "Choose which suggested tasks or project details should be applied."
      }
    ],
    "note": "Text2Task proposes SEO task updates; you choose what to apply, and no saved work changes without approval."
  },
  "faq": {
    "title": "Questions about using Text2Task for SEO Freelancers",
    "items": [
      {
        "question": "Does Text2Task crawl or audit the client’s website?",
        "answer": "No. Text2Task only organizes SEO instructions contained in text or screenshots you provide."
      },
      {
        "question": "Does it connect to Google Search Console or Google Analytics?",
        "answer": "No. It does not access Search Console, Analytics, ranking tools, or the client’s website."
      },
      {
        "question": "Can it organize page URLs, title tags, links, redirects, and alt text requests?",
        "answer": "Yes. When those details appear in the supplied request, Text2Task can keep them with the proposed project and page-level tasks."
      },
      {
        "question": "How are follow-up SEO changes handled?",
        "answer": "Client Updates compares the follow-up with the saved project and lets you approve the relevant additions or changes."
      }
    ]
  },
  "relatedSlugs": [
    "wordpress-freelancers",
    "shopify-freelancers",
    "web-designers"
  ],
  "finalCta": {
    "title": "Skip the SEO admin work. Spend more time improving pages.",
    "description": "Paste the client instructions, review the proposed project and page-level tasks, and save only the work you approve.",
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
