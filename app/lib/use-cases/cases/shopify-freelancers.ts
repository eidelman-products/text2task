import type { UseCase } from "../types";

export const shopifyFreelancersUseCase = {
  "slug": "shopify-freelancers",
  "audienceLabel": "Shopify Freelancers",
  "title": "AI Shopify Request Organizer for Freelancers",
  "seo": {
    "title": "Client Request Management for Shopify Freelancers",
    "description": "Help Shopify freelancers manage client requests by turning store updates, product changes, promotion notes, and supported screenshots into reviewable project tasks."
  },
  "listing": {
    "category": "website-development",
    "label": "Shopify Freelancers",
    "title": "Stop rebuilding storefront briefs by hand",
    "description": "Organize product, collection, pricing, promotion, banner, mobile, and storefront requests into proposed projects and tasks you review before saving.",
    "highlights": [
      "Product and collection updates",
      "Pricing and promotion requests",
      "Storefront banners and assets",
      "Mobile, cart, and checkout notes"
    ]
  },
  "hero": {
    "title": "Spend less time copying store updates—and",
    "highlight": "more time improving the storefront.",
    "description": "Paste a Shopify client message, email, or screenshot. Text2Task extracts product updates, collection changes, banners, promotions, mobile fixes, deadlines, priorities, assets, and budgets into a project you review and edit before saving.",
    "primaryCta": {
      "label": "Try Text2Task",
      "href": "/signup"
    },
    "secondaryCta": {
      "label": "See the workflow",
      "href": "#workflow"
    },
    "visual": {
      "src": "/landing/use-cases/shopify-freelancers/shopify-store-request-project-flow.png",
      "alt": "Shopify freelancer workflow showing a client store request becoming proposed product, collection, promotion, banner, mobile, deadline, and budget tasks for review before saving.",
      "label": "Store request to reviewed storefront project",
      "width": 1672,
      "height": 941,
      "role": "workflow",
      "priority": true
    }
  },
  "painPoints": {
    "title": "Store update briefs turn into hours of manual task entry.",
    "description": "One Shopify client message can combine product-page changes, collection updates, supplied pricing and promotion details, banners, images, navigation, mobile fixes, cart notes, links, assets, deadlines, priorities, and budgets.",
    "supportingDescription": "Copying every item into a task manager wastes time before storefront work begins, and small sale or launch requirements can be missed. Text2Task proposes the project and tasks, and the freelancer reviews and approves the result before anything is saved.",
    "items": [
      "Separate product, collection, promotion, banner, navigation, and mobile requests.",
      "Keep supplied prices, discount notes, product links, and asset references with the correct work.",
      "Preserve campaign dates, priorities, budgets, and delivery requirements.",
      "Review late storefront changes against the saved project instead of rebuilding the task list."
    ]
  },
  "workflow": {
    "title": "Get the storefront workload ready before launch day.",
    "description": "Paste the store brief, check the proposed project and tasks, and save only the Shopify work you approve—without copying every request manually.",
    "steps": [
      {
        "title": "Capture the store brief",
        "description": "Paste the client’s Shopify request or upload a screenshot containing product, collection, promotion, banner, navigation, mobile, cart, or checkout instructions."
      },
      {
        "title": "Review the proposed store tasks",
        "description": "Check product links, supplied prices, discount notes, banners, images, campaign dates, assets, priorities, deadlines, and budgets before saving."
      },
      {
        "title": "Approve the store project",
        "description": "Edit or remove unclear items, then save only the project and store tasks you approve."
      }
    ]
  },
  "capabilities": {
    "title": "Keep storefront details out of the copy-and-paste cycle.",
    "description": "Keep every supplied product, promotion, asset, deadline, and mobile note connected to the proposed work without manually rebuilding the brief.",
    "items": [
      "Product-page updates",
      "Collection changes",
      "Supplied pricing changes",
      "Promotion and discount requests",
      "Homepage banners",
      "Product-image replacements",
      "Navigation updates",
      "Mobile storefront fixes",
      "Supplied cart and checkout notes",
      "Campaign deadlines, assets, priorities, and budgets"
    ]
  },
  "clientUpdates": {
    "title": "Keep late store changes from forcing another manual rebuild.",
    "description": "When a client sends another store change, Client Updates compares it with the saved project so you can review what is new without manually checking and rebuilding the full task list.",
    "steps": [
      {
        "title": "Compare the follow-up with the saved store project",
        "description": "Analyze the supplied request against existing product, collection, promotion, banner, and mobile tasks."
      },
      {
        "title": "Separate new requests from covered work",
        "description": "Review possible additions beside store changes that may already be handled in the saved project."
      },
      {
        "title": "Approve the selected updates",
        "description": "Choose which suggested tasks or project details should be applied."
      }
    ],
    "note": "Text2Task suggests storefront updates; you choose what to apply, and no saved work changes without approval."
  },
  "faq": {
    "title": "Questions about using Text2Task for Shopify Freelancers",
    "items": [
      {
        "question": "Does Text2Task connect directly to my Shopify store?",
        "answer": "No. You paste client text or upload a screenshot. Text2Task does not access Shopify Admin or the client’s store."
      },
      {
        "question": "Can Text2Task change prices, discounts, or publish promotions?",
        "answer": "No. It can organize supplied pricing and promotion instructions into proposed tasks, but it cannot apply or publish them."
      },
      {
        "question": "Can it preserve product links, images, and campaign details?",
        "answer": "Yes. When links, asset references, deadlines, priorities, or budgets appear in the supplied request, Text2Task can keep them with the proposed project and tasks."
      },
      {
        "question": "How are late storefront changes handled?",
        "answer": "Client Updates compares the follow-up with the saved project and lets you approve the relevant additions or changes."
      }
    ]
  },
  "relatedSlugs": [
    "web-designers",
    "wordpress-freelancers",
    "webflow-freelancers"
  ],
  "finalCta": {
    "title": "Skip the manual task setup on your next Shopify request.",
    "description": "Paste the store brief, review the proposed project and store tasks, and save only the work you approve.",
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
