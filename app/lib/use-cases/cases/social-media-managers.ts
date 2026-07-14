import type { UseCase } from "../types";

export const socialMediaManagersUseCase = {
  "slug": "social-media-managers",
  "audienceLabel": "Social Media Managers",
  "title": "AI Social Media Task Manager for Client Content",
  "seo": {
    "title": "Client Request Management for Social Media Managers",
    "description": "Help social media managers manage client requests by turning content requests, approval feedback, campaign notes, and deadlines into reviewable tasks."
  },
  "listing": {
    "category": "creative-content",
    "label": "Social Media Managers",
    "title": "Plan client content requests",
    "description": "Structure posts, captions, campaign changes, approval notes, and content deadlines before production.",
    "highlights": [
      "Instagram and LinkedIn posts",
      "Story and carousel tasks",
      "Caption and CTA changes",
      "Approval and revision notes"
    ]
  },
  "hero": {
    "title": "Turn scattered client content requests into a",
    "highlight": "clear social media plan.",
    "description": "Text2Task turns client WhatsApp messages, emails, screenshots, and revision notes into a structured social media project and tasks you review and edit before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/text2task-client-whatsapp-social-media-managers.png",
      "alt": "Social media client WhatsApp request containing Instagram captions, story slides, a LinkedIn post, content timing, shared assets, deadline, budget, and brand-tone instructions.",
      "label": "Client social media content request",
      "width": 1448,
      "height": 1086,
      "role": "source",
      "priority": true
    }
  },
  "painPoints": {
    "title": "Social media requests rarely arrive as one clean content brief.",
    "description": "Posts, captions, stories, carousel changes, and Reel notes can arrive together, with platform-specific requests mixed into campaign changes and approval comments.",
    "supportingDescription": "Assets, links, brand instructions, campaign dates, CTAs, hashtags, and references may be buried in the message, while copying every request into a task manager wastes time and makes small revisions easier to miss.",
    "items": [
      "Separate posts, stories, carousels, captions, CTAs, and short-video notes into clear tasks.",
      "Keep platform-specific versions, campaign changes, and approval comments visible.",
      "Carry assets, links, brand voice, hashtags, dates, and references into the social media plan.",
      "Review the organized social media work instead of rebuilding the request by hand."
    ]
  },
  "workflow": {
    "title": "From client content request to approved social media work.",
    "description": "Capture the content request, check the proposed social media plan, and save only the campaign tasks you approve.",
    "steps": [
      {
        "title": "Capture the content request",
        "description": "Capture the request containing Instagram or LinkedIn posts, stories, carousels, captions, CTAs, short-video notes, or platform-specific versions."
      },
      {
        "title": "Review the organized social media plan",
        "description": "Check each proposed task, campaign date, brand-voice note, hashtag, approval comment, asset, link, and client reference before saving."
      },
      {
        "title": "Save the approved campaign tasks",
        "description": "Save the approved project and tasks so the requested content work is ready for your production workflow."
      }
    ]
  },
  "capabilities": {
    "title": "Social media tasks you can organize in Text2Task",
    "description": "Keep client content, campaign, approval, and revision requests clear without losing the context needed to complete them.",
    "items": [
      "Instagram and LinkedIn post requests",
      "Story and carousel tasks",
      "Reel and short-video notes",
      "Caption and CTA changes",
      "Platform-specific deliverables",
      "Content-calendar deadlines",
      "Client approval and revision notes",
      "Brand voice and hashtag instructions",
      "Assets, links, and references",
      "Campaign updates and priorities"
    ]
  },
  "clientUpdates": {
    "title": "Handle follow-up content changes without rebuilding the campaign plan.",
    "description": "When a client sends more feedback, Client Updates compares it with the saved social media project and proposes what may need attention.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved social media project",
        "description": "Analyze the client's additional content requests against the project's existing campaign tasks and context."
      },
      {
        "title": "Identify new and already-handled revisions",
        "description": "See genuinely new requests alongside content changes that may already be covered in the campaign plan."
      },
      {
        "title": "Approve only what should change",
        "description": "Review the suggestions and choose what to add or update. Text2Task never modifies the project automatically."
      }
    ],
    "note": "You stay in control: Text2Task suggests the content updates, and only the changes you approve are applied."
  },
  "faq": {
    "title": "Questions about using Text2Task for Social Media Managers",
    "items": [
      {
        "question": "Can Text2Task separate one client content message into multiple social media tasks?",
        "answer": "Yes. It can organize a mixed content request into separate social media tasks that you review before saving."
      },
      {
        "question": "Can it extract content requests from screenshots or email text?",
        "answer": "Yes. You can upload a screenshot or paste email text, then review the extracted social media project and tasks."
      },
      {
        "question": "Can I edit the social media plan before saving it?",
        "answer": "Yes. The extracted plan remains editable, so you can correct details and decide what should be saved."
      },
      {
        "question": "How does Text2Task handle follow-up content changes for an existing campaign?",
        "answer": "Client Updates compares the follow-up with the saved project, suggests new or already-handled revisions, and lets you approve what should change."
      }
    ]
  },
  "relatedSlugs": [
    "graphic-designers",
    "video-editors",
    "small-agencies"
  ],
  "finalCta": {
    "title": "Turn the next client content request into a clear social media plan.",
    "description": "Capture the client request, review the proposed content tasks, and save only the campaign work you approve.",
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
