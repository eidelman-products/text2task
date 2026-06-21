import { extractedFields, type UseCase } from "../types";

export const socialMediaManagersUseCase = {
    slug: "social-media-managers",
    audienceLabel: "Social Media Managers",
    title: "AI Task Manager for Social Media Managers",
    seoTitle: "AI Task Manager for Social Media Managers | Text2Task",
    metaDescription:
      "Text2Task helps social media managers organize client content requests, captions, story slides, LinkedIn posts, screenshots, scheduling deadlines, and budgets into structured tasks.",
    badge: "Built for client content work",
    heroTitle: "AI task manager for",
    heroHighlight: "social media managers",
    heroDescription:
      "Clients send captions, story ideas, campaign changes, content approvals, scheduling notes, screenshots, deadlines, and budgets across chat and email. Text2Task turns those messy requests into clear tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Content requests come from everywhere.",
    problemDescription:
      "A client might send post ideas in WhatsApp, ad changes by email, and approval comments in screenshots. Text2Task helps organize the work before it becomes chaos.",
    beforeMessage:
      "Please write 7 Instagram captions, create 3 story slides for the promo, write one LinkedIn case study post, schedule Friday at 9 AM, and use the product screenshots from Drive. Content plan by Thursday. Budget around $450.",
    scenario: {
      title: "Scenario: weekly content batch in WhatsApp",
      description:
        "A client sends captions, story slides, LinkedIn post, scheduling time, assets, deadline, tone, and budget in one chat thread.",
      frameType: "chat",
      senderName: "Daniel @ GrowthSpark Media",
      senderMeta: "Content planning client",
      timeLabel: "Today, 9:42 AM",
      message:
        "Can you prepare 7 Instagram captions for next week, 3 story slides for the promo, and 1 LinkedIn post about the case study? Please schedule the Friday post for 9 AM and use the product screenshots from Drive. Content plan by Thursday. Monthly budget around $450. Keep the tone professional but friendly.",
      attachments: ["drive-screenshots", "case-study-notes.docx"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "7 Instagram captions",
        "3 promo story slides",
        "LinkedIn case study post",
        "Friday 9 AM schedule note",
        "Product screenshots",
        "Tone: professional but friendly",
        "Deadline: Thursday",
        "Budget: $450",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "GrowthSpark Media", task: "Write 7 Instagram captions", deadline: "Thursday", budget: "$450", priority: "High" },
      { client: "GrowthSpark Media", task: "Create 3 promo story slides", deadline: "Thursday", budget: "$450", priority: "High" },
      { client: "GrowthSpark Media", task: "Write LinkedIn case study post", deadline: "Thursday", budget: "$450", priority: "Medium" },
      { client: "GrowthSpark Media", task: "Schedule Friday post for 9 AM", deadline: "Friday 9 AM", budget: "$450", priority: "High" },
    ],
    productProofTitle: "Turn content requests into trackable client work.",
    productProofDescription:
      "Text2Task helps social media managers turn chat requests, caption batches, campaign notes, approvals, screenshots, budgets, and deadlines into structured tasks.",
    productProofImage: "/landing/text2task-whatsapp-message.png",
    productProofImageAlt:
      "Text2Task example of a messy WhatsApp client message that becomes structured client work.",
    productProofBullets: [
      "Separate captions, posts, stories, approvals, and scheduling notes.",
      "Keep deadlines, budgets, assets, and tone notes attached to the client.",
      "Track content work without rewriting every message by hand.",
    ],
    workflowTitle: "From client content message to organized workload.",
    workflowDescription:
      "Text2Task is designed as a fast capture layer for client content work. Paste a request, review the output, and save tasks you can manage.",
    workflowSteps: [
      { title: "Paste content request", description: "Use messages, campaign notes, screenshots, or email requests." },
      { title: "Extract content tasks", description: "Turn posts, captions, ad edits, deadlines, and budgets into structured tasks." },
      { title: "Manage the workload", description: "Track what needs to be created, approved, scheduled, or delivered." },
    ],
    benefitsTitle: "Built for the way client content work actually arrives.",
    benefitsDescription:
      "Text2Task helps service providers organize the exact work hidden inside client messages, notes, and screenshots.",
    benefits: [
      { title: "Organize content batches", description: "Break client requests into posts, captions, ads, approvals, and campaign tasks." },
      { title: "Track deadlines clearly", description: "Keep campaign deadlines visible before they become urgent." },
      { title: "Save client notes", description: "Keep instructions, screenshots, and source messages connected to each task." },
      { title: "Reduce manual cleanup", description: "Spend less time rewriting messy messages into task lists." },
    ],
    commonTasksTitle: "Common social media tasks Text2Task can help organize",
    specificTasks: [
      "Instagram captions",
      "Story slide requests",
      "LinkedIn posts",
      "Promo campaigns",
      "Scheduling notes",
      "Product screenshots",
      "Tone notes",
      "Client approvals",
      "Content plan deadlines",
      "Monthly budget",
    ],
    faqTitle: "Questions about using Text2Task for Social Media Managers",
    faq: [
      { question: "Can Text2Task organize social media content requests?", answer: "Yes. It can extract content tasks, deadlines, budgets, and notes from messy client messages." },
      { question: "Can I use screenshots?", answer: "Yes. Text2Task supports screenshot-based extraction." },
      { question: "Can I manage multiple clients?", answer: "Yes. Tasks are organized with client details so you can manage work across clients." },
      { question: "Is it a full social media scheduler?", answer: "No. Text2Task is focused on extracting and organizing tasks. It does not publish posts directly." },
    ],
    relatedUseCases: ["graphic-designers", "video-editors", "virtual-assistants"],
    finalCtaEyebrow: "Try Text2Task for content work",
    finalCtaTitle: "Turn your next content request into clean tasks.",
    finalCtaDescription:
      "Paste a real client content message or upload a screenshot. Review the AI output, edit if needed, and save structured content tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-whatsapp-social-media-managers.png",
      heroImageAlt:
        "WhatsApp client chat with a social media content request for captions, story slides, LinkedIn post, scheduling, screenshots, deadline, and budget.",
      heroEmail: {
        senderName: "Daniel Reed",
        senderEmail: "daniel@growthsparkmedia.com",
        subject: "Content plan for next week",
        timeLabel: "Today, 9:42 AM",
        body: [
          "Please prepare 7 Instagram captions for next week, 3 story slides for the promo, and 1 LinkedIn post about the case study.",
          "Schedule the Friday post for 9 AM and use the product screenshots from the shared drive.",
          "The content plan is due by Thursday. Monthly budget is around $450. Keep the tone professional but friendly.",
        ],
        attachments: ["shared-drive-screenshots", "case-study-notes.docx"],
      },
      aiSummaryTitle: "Text2Task finds the actual content work",
      aiSummaryItems: [
        "7 Instagram captions",
        "3 promo story slides",
        "LinkedIn case study post",
        "Friday 9 AM schedule",
        "Product screenshots",
        "Tone note",
        "Deadline: Thursday",
        "Budget: $450",
      ],
      transformationTitle: "Messy content chat to clean weekly plan.",
      transformationDescription:
        "Instead of manually turning chat instructions into a content board, Text2Task extracts posts, captions, assets, tone, schedule, deadline, and budget into a reviewable plan.",
      transformationInputs: ["Captions, stories, and LinkedIn post", "Screenshots and tone notes", "Schedule, deadline, and budget"],
      transformationOutputs: ["Structured content tasks", "Editable weekly plan", "Assets, deadline, budget, and source notes"],
      transformationValue: "You keep control of the final content plan while the messy intake is already organized.",
      flowSteps: [
        {
          title: "Client sends content requests",
          description:
            "Post ideas, caption notes, campaign changes, approval comments, deadlines, and content batches arrive in chat.",
        },
        {
          title: "AI extracts content tasks",
          description:
            "Text2Task turns the message into organized content work with captions, posts, deadlines, budget, and client notes.",
        },
        {
          title: "Manager reviews and schedules work",
          description:
            "Review the extracted tasks, edit if needed, and save the campaign work before creating or scheduling content.",
        },
      ],
      proofTitle: "Real product flow for social media client work.",
      proofDescription:
        "Use Text2Task to capture social content requests from messages and manage them in a clean task workspace.",
      proofImages: [
        { src: "/landing/text2task-whatsapp-message.png", alt: "Text2Task WhatsApp-style message example for client requests.", label: "Client message intake" },
        { src: "/landing/New-Task-CRM.png", alt: "Text2Task CRM view for managing content tasks and client projects.", label: "Task CRM" },
      ],
      manageTitle: "What social media managers can organize",
      manageDescription:
        "A focused workspace for posts, captions, campaign notes, content batches, approvals, deadlines, client feedback, and recurring content work.",
      manageItems: [
        "Instagram captions",
        "Story slide requests",
        "LinkedIn posts",
        "Promo campaigns",
        "Scheduling notes",
        "Product screenshots",
        "Tone notes",
        "Monthly budget",
      ],
    },
  } satisfies UseCase;
