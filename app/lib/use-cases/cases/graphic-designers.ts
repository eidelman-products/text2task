import { extractedFields, type UseCase } from "../types";

export const graphicDesignersUseCase = {
    slug: "graphic-designers",
    audienceLabel: "Graphic Designers",
    title: "AI Task Manager for Graphic Designers",
    seoTitle: "AI Task Manager for Graphic Designers | Text2Task",
    metaDescription:
      "Text2Task helps graphic designers turn messy client design requests, logo revisions, brand notes, social assets, deadlines, and budgets into organized tasks.",
    badge: "Built for design requests",
    heroTitle: "AI task manager for",
    heroHighlight: "graphic designers",
    heroDescription:
      "Design clients send logo changes, banner edits, brand notes, social assets, screenshots, deadlines, and budget details in chat. Text2Task turns those scattered requests into clear tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Design feedback often arrives as messy notes.",
    problemDescription:
      "A client may send five design changes in one message, attach screenshots, mention a deadline, and forget the final budget. Text2Task helps capture the details before they get lost.",
    beforeMessage:
      "Can you refine logo version 2, create 3 Instagram story templates, update the LinkedIn banner, use the color palette and brand notes, and send the first draft tomorrow? Budget around $300.",
    scenario: {
      title: "Scenario: graphic design feedback in WhatsApp",
      description:
        "A client sends logo revisions, story templates, banner updates, brand notes, deadline, and budget in one chat thread.",
      frameType: "chat",
      senderName: "Mia @ Bright Pixel Co",
      senderMeta: "Graphic design client",
      timeLabel: "Today, 10:14 AM",
      message:
        "Can you refine logo version 2, create 3 Instagram story templates, update the LinkedIn banner, and use the attached color palette and brand notes? First draft tomorrow afternoon. Budget is around $300. Please keep everything in the same brand style.",
      attachments: ["color-palette.png", "brand-notes.pdf"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Logo v2 refinement",
        "3 Instagram story templates",
        "LinkedIn banner update",
        "Brand style note",
        "Deadline: tomorrow afternoon",
        "Budget: $300",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "Bright Pixel Co", task: "Refine logo version 2", deadline: "Tomorrow afternoon", budget: "$300", priority: "High" },
      { client: "Bright Pixel Co", task: "Create 3 Instagram story templates", deadline: "Tomorrow afternoon", budget: "$300", priority: "High" },
      { client: "Bright Pixel Co", task: "Update LinkedIn banner", deadline: "Tomorrow afternoon", budget: "$300", priority: "Medium" },
      { client: "Bright Pixel Co", task: "Use color palette and brand notes", deadline: "Tomorrow afternoon", budget: "$300", priority: "Medium" },
    ],
    productProofTitle: "Use screenshots and resources to capture visual feedback.",
    productProofDescription:
      "Text2Task supports image-based and message-based requests so graphic designers can turn client screenshots, logo notes, brand changes, deadlines, and budgets into tasks.",
    productProofImage: "/landing/text2task-upload-screenshot.png",
    productProofImageAlt:
      "Text2Task screenshot upload interface for analyzing client image feedback and turning it into project tasks.",
    productProofBullets: [
      "Upload or paste screenshots containing visual client feedback.",
      "Extract logo, banner, brand color, and revision notes into tasks.",
      "Keep design deadlines and budgets connected to the request.",
    ],
    workflowTitle: "From design feedback to organized creative tasks.",
    workflowDescription:
      "Paste design notes, review the output, and save the deliverables you need to create.",
    workflowSteps: [
      { title: "Capture design feedback", description: "Paste WhatsApp notes, screenshots, brand comments, or revision lists." },
      { title: "Extract creative tasks", description: "Text2Task finds deliverables, deadline, budget, and asset notes." },
      { title: "Manage delivery", description: "Keep each client design request organized until the draft is delivered." },
    ],
    benefitsTitle: "Built for how design feedback actually arrives.",
    benefitsDescription:
      "Text2Task helps graphic designers organize client notes, screenshots, revision lists, deliverables, deadlines, and budget details.",
    benefits: [
      { title: "Track design revisions", description: "Turn scattered feedback into clear tasks with priority and status." },
      { title: "Keep deliverables visible", description: "Separate banners, logos, brand assets, and edits into individual tasks." },
      { title: "Reduce missed notes", description: "Capture details from text and screenshots before they disappear." },
      { title: "Work faster with clients", description: "Move from messy requests to structured work without building a heavy system." },
    ],
    commonTasksTitle: "Common design tasks Text2Task can help organize",
    specificTasks: [
      "Logo revisions",
      "Instagram story templates",
      "LinkedIn banners",
      "Brand color updates",
      "Client screenshot notes",
      "Typography edits",
      "Ad creative changes",
      "Presentation graphics",
      "First draft deadlines",
      "Design budgets",
    ],
    faqTitle: "Questions about using Text2Task for Graphic Designers",
    faq: [
      { question: "Can Text2Task extract design tasks from screenshots?", answer: "Yes. You can upload screenshots and review the extracted tasks before saving them." },
      { question: "Can I use it for revision lists?", answer: "Yes. Text2Task is useful for turning revision notes into structured tasks." },
      { question: "Can I track budgets?", answer: "Yes. Text2Task can extract amounts from client messages when they are included." },
      { question: "Can I export my tasks?", answer: "CSV export is available on the Pro plan." },
    ],
    relatedUseCases: ["web-designers", "social-media-managers", "video-editors"],
    finalCtaEyebrow: "Try Text2Task for design work",
    finalCtaTitle: "Turn your next design request into clean tasks.",
    finalCtaDescription:
      "Paste a real client message or upload a screenshot. Review the AI output, edit if needed, and save structured design tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-whatsapp-graphic-designers.png",
      heroImageAlt:
        "WhatsApp client chat with a graphic design request for logo revision, Instagram story templates, LinkedIn banner, brand notes, deadline, and budget.",
      heroEmail: {
        senderName: "Mia Carter",
        senderEmail: "mia@brightpixel.co",
        subject: "Design revisions for tomorrow",
        timeLabel: "Today, 10:14 AM",
        body: [
          "Please refine logo version 2, create 3 Instagram story templates, update the LinkedIn banner, and use the attached color palette and brand notes.",
          "First draft tomorrow afternoon. Budget is around $300.",
          "Please keep everything in the same brand style.",
        ],
        attachments: ["color-palette.png", "brand-notes.pdf"],
      },
      aiSummaryTitle: "Text2Task finds the actual design work",
      aiSummaryItems: [
        "Logo v2 refinement",
        "3 Instagram story templates",
        "LinkedIn banner update",
        "Color palette note",
        "Brand style note",
        "Deadline: tomorrow afternoon",
        "Budget: $300",
      ],
      transformationTitle: "Messy design feedback to clean creative plan.",
      transformationDescription:
        "Instead of rewriting client chat notes into a design checklist, Text2Task extracts the deliverables, assets, deadline, and budget so you can review the plan before saving.",
      transformationInputs: ["Logo and banner feedback", "Brand notes and palette", "Deadline and budget"],
      transformationOutputs: ["Structured design tasks", "Asset notes attached", "Deadline, budget, and priority"],
      transformationValue: "You keep creative control while the messy client feedback is already organized.",
      flowSteps: [
        {
          title: "Client sends design feedback",
          description:
            "Logo notes, banner edits, social assets, brand comments, screenshots, deadline, and budget arrive through chat.",
        },
        {
          title: "AI extracts creative tasks",
          description:
            "Text2Task separates the request into clear design deliverables, assets, revisions, deadline, and client notes.",
        },
        {
          title: "Designer reviews and saves",
          description:
            "Review the creative plan, adjust the task list, and keep the design work organized by client.",
        },
      ],
      proofTitle: "Real product flow for graphic design requests.",
      proofDescription:
        "Use Text2Task to upload screenshots, keep project resources attached, and manage design revisions by client.",
      proofImages: [
        { src: "/landing/text2task-upload-screenshot.png", alt: "Text2Task screenshot upload flow for design feedback.", label: "Screenshot extraction" },
        { src: "/landing/text2task-project-resources.png", alt: "Text2Task project resources view for design files, links, and notes.", label: "Project resources" },
      ],
      manageTitle: "What graphic designers can manage",
      manageDescription:
        "A focused workspace for logo revisions, banners, social assets, screenshots, brand notes, first drafts, deadlines, and budgets.",
      manageItems: [
        "Logo revisions",
        "Story templates",
        "LinkedIn banners",
        "Brand color notes",
        "Screenshot feedback",
        "First draft deadlines",
        "Asset handoffs",
        "Design budgets",
      ],
    },
  } satisfies UseCase;
