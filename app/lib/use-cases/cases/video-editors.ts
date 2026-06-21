import { extractedFields, type UseCase } from "../types";

export const videoEditorsUseCase = {
    slug: "video-editors",
    audienceLabel: "Video Editors",
    title: "AI Task Manager for Video Editors",
    seoTitle: "AI Task Manager for Video Editors | Text2Task",
    metaDescription:
      "Text2Task helps video editors turn messy client revision notes, cuts, captions, exports, deadlines, and budgets into organized tasks.",
    badge: "Built for video revision work",
    heroTitle: "AI task manager for",
    heroHighlight: "video editors",
    heroDescription:
      "Video clients send cut notes, timestamp-style revisions, caption requests, export formats, music notes, logo cards, delivery deadlines, and budgets through chat and email. Text2Task helps turn those notes into trackable tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Video revision notes are easy to lose.",
    problemDescription:
      "When feedback arrives as long messages, screenshots, or mixed notes, it becomes hard to track what was requested, what was fixed, and what still needs delivery.",
    beforeMessage:
      "Can you cut the 2-minute testimonial to 45 seconds, add captions, remove pauses and filler, add the logo end card, export 9:16 and 16:9, and send first cut by Friday? Budget around $400.",
    scenario: {
      title: "Scenario: video revision request in WhatsApp",
      description:
        "A client sends edit length, caption request, cleanup notes, logo card, export formats, deadline, music note, and budget in one chat thread.",
      frameType: "chat",
      senderName: "Alex @ FrameCut Media",
      senderMeta: "Video revision client",
      timeLabel: "Today, 2:08 PM",
      message:
        "Can you cut the 2-minute testimonial down to 45 seconds, add dynamic captions, remove pauses and filler, add a logo end card, and export both 9:16 and 16:9? First cut by Friday. Budget is around $400. Use the music from the last version if it still fits.",
      attachments: ["testimonial-final.mp4", "logo-end-card.png"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "45-second testimonial cut",
        "Dynamic captions",
        "Remove pauses and filler",
        "Logo end card",
        "9:16 and 16:9 exports",
        "Music note",
        "Deadline: Friday",
        "Budget: $400",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "FrameCut Media", task: "Cut testimonial to 45 seconds", deadline: "Friday", budget: "$400", priority: "High" },
      { client: "FrameCut Media", task: "Add dynamic captions", deadline: "Friday", budget: "$400", priority: "Medium" },
      { client: "FrameCut Media", task: "Remove pauses and filler", deadline: "Friday", budget: "$400", priority: "Medium" },
      { client: "FrameCut Media", task: "Export 9:16 and 16:9 versions", deadline: "Friday", budget: "$400", priority: "High" },
    ],
    productProofTitle: "Keep urgent video revisions visible.",
    productProofDescription:
      "Text2Task helps video editors turn scattered revision notes into a clear delivery checklist with deadlines, budgets, priority, and status.",
    productProofImage: "/landing/text2task-urgent-board.png",
    productProofImageAlt:
      "Text2Task urgent board showing time-sensitive tasks and priority work for client projects.",
    productProofBullets: [
      "Capture revision rounds, captions, cuts, exports, and delivery notes.",
      "Keep first cuts and final delivery deadlines visible.",
      "Track what needs attention before revisions get buried.",
    ],
    workflowTitle: "From video notes to organized revision work.",
    workflowDescription:
      "Paste client feedback, review the output, and save the video tasks you need to complete.",
    workflowSteps: [
      { title: "Paste revision notes", description: "Use feedback from chat, email, screenshots, or client review notes." },
      { title: "Extract editing tasks", description: "Turn revisions, deadlines, budgets, and client instructions into clean tasks." },
      { title: "Track until final delivery", description: "Manage the work until the client receives the final version." },
    ],
    benefitsTitle: "Built for the way video feedback actually arrives.",
    benefitsDescription:
      "Text2Task helps video editors organize revision notes, timestamps, export requests, delivery deadlines, and client context.",
    benefits: [
      { title: "Organize revision rounds", description: "Keep each requested video change visible and trackable." },
      { title: "Capture delivery deadlines", description: "Extract due dates and keep urgent edits from getting buried." },
      { title: "Keep notes connected", description: "Save client instructions and source messages with each task." },
      { title: "Avoid manual rewriting", description: "Turn messy feedback into a task list faster." },
    ],
    commonTasksTitle: "Common video tasks Text2Task can help organize",
    specificTasks: [
      "Shortening cuts",
      "Dynamic captions",
      "Remove pauses",
      "Logo end cards",
      "9:16 exports",
      "16:9 exports",
      "Music notes",
      "First cut deadlines",
      "Revision rounds",
      "Video budgets",
    ],
    faqTitle: "Questions about using Text2Task for Video Editors",
    faq: [
      { question: "Can Text2Task extract video revision tasks?", answer: "Yes. It can turn client revision notes into structured tasks with deadlines and priorities." },
      { question: "Can it understand timestamps?", answer: "Text2Task can capture timestamp-style notes when they appear in the client message, but you should always review the output before saving." },
      { question: "Does Text2Task edit videos?", answer: "No. It organizes the work. You still complete the editing in your editing software." },
      { question: "Can I use it for client screenshots?", answer: "Yes. Screenshot extraction is supported." },
    ],
    relatedUseCases: ["social-media-managers", "graphic-designers", "small-agencies"],
    finalCtaEyebrow: "Try Text2Task for video work",
    finalCtaTitle: "Turn your next video revision into clean tasks.",
    finalCtaDescription:
      "Paste a real client revision message or upload a screenshot. Review the AI output, edit if needed, and save structured video tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-whatsapp-video-editors.png",
      heroImageAlt:
        "WhatsApp client chat with a video editing request for testimonial cut, captions, pauses, logo card, exports, deadline, and budget.",
      heroEmail: {
        senderName: "Alex Morgan",
        senderEmail: "alex@framecutmedia.com",
        subject: "Testimonial edit revisions",
        timeLabel: "Today, 2:08 PM",
        body: [
          "Please cut the 2-minute testimonial down to 45 seconds, add dynamic captions, remove pauses and filler, and add the logo end card.",
          "Please export both 9:16 and 16:9 versions. First cut by Friday. Budget is around $400.",
          "Use the music from the last version if it still fits.",
        ],
        attachments: ["testimonial-final.mp4", "logo-end-card.png"],
      },
      aiSummaryTitle: "Text2Task finds the actual edit work",
      aiSummaryItems: [
        "45-second testimonial cut",
        "Dynamic captions",
        "Remove pauses and filler",
        "Logo end card",
        "9:16 export",
        "16:9 export",
        "Deadline: Friday",
        "Budget: $400",
      ],
      transformationTitle: "Messy video feedback to clean revision plan.",
      transformationDescription:
        "Instead of manually rewriting edit notes into a checklist, Text2Task extracts cuts, captions, exports, assets, deadline, and budget into a reviewable plan.",
      transformationInputs: ["Cut notes and captions", "Export formats and assets", "Deadline and budget"],
      transformationOutputs: ["Structured video tasks", "Editable revision checklist", "Deadline, budget, priority, and source notes"],
      transformationValue: "You keep creative control while the messy revision notes are already organized.",
      flowSteps: [
        {
          title: "Client sends revision notes",
          description:
            "Cut requests, timestamps, captions, export formats, music notes, logo cards, deadline, and budget arrive together.",
        },
        {
          title: "AI extracts editing tasks",
          description:
            "Text2Task separates the message into clear video revision tasks with deadline, priority, budget, and source context.",
        },
        {
          title: "Editor reviews and tracks delivery",
          description:
            "Review the edit plan, save the revision tasks, and keep urgent cuts visible until final delivery.",
        },
      ],
      proofTitle: "Real product flow for video revision work.",
      proofDescription:
        "Use Text2Task to keep urgent edits visible and manage video revisions until final delivery.",
      proofImages: [
        { src: "/landing/text2task-urgent-board.png", alt: "Text2Task urgent board for tracking time-sensitive video edits.", label: "Urgent board" },
        { src: "/landing/New-Task-CRM.png", alt: "Text2Task CRM view for managing video editing tasks and client projects.", label: "Task CRM" },
      ],
      manageTitle: "What video editors can organize",
      manageDescription:
        "A focused workspace for revision rounds, cuts, captions, export formats, logo cards, music notes, first cuts, deadlines, and budgets.",
      manageItems: [
        "Shortening cuts",
        "Dynamic captions",
        "Remove pauses",
        "Logo end cards",
        "9:16 exports",
        "16:9 exports",
        "Music notes",
        "First cut deadlines",
      ],
    },
  } satisfies UseCase;
