import { extractedFields, type UseCase } from "../types";

export const virtualAssistantsUseCase = {
    slug: "virtual-assistants",
    audienceLabel: "Virtual Assistants",
    title: "AI Task Manager for Virtual Assistants",
    seoTitle: "AI Task Manager for Virtual Assistants | Text2Task",
    metaDescription:
      "Text2Task helps virtual assistants turn mixed admin instructions, follow-ups, scheduling notes, spreadsheet updates, invoices, research, deadlines, and budgets into organized tasks.",
    badge: "Built for admin support work",
    heroTitle: "AI task manager for",
    heroHighlight: "virtual assistants",
    heroDescription:
      "VA clients send follow-ups, scheduling changes, spreadsheet updates, invoice reminders, research tasks, links, deadlines, and notes across email and chat. Text2Task turns those mixed instructions into structured work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Admin requests often mix five tasks in one message.",
    problemDescription:
      "A client might ask for follow-up emails, meeting scheduling, spreadsheet cleanup, research, and invoice reminders in the same note. Text2Task helps separate those requests into clear tasks.",
    beforeMessage:
      "Can you follow up with three leads, schedule the client call, update the tracker, remind accounting about the invoice, and research two vendors before Wednesday? Budget around $350.",
    scenario: {
      title: "Scenario: mixed admin request from a client",
      description:
        "A client email includes follow-ups, scheduling, spreadsheet updates, invoice reminder, research, deadline, and budget.",
      frameType: "email",
      senderName: "Rachel @ ClearPath Consulting",
      senderMeta: "Admin support client",
      subject: "Admin tasks for this week",
      timeLabel: "Today, 8:55 AM",
      message:
        "Can you follow up with three leads, schedule the client call, update the project tracker, remind accounting about the invoice, and research two vendors before Wednesday? Budget is around $350 for this admin batch.",
      attachments: ["lead-list.xlsx", "vendor-notes.pdf"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Follow up with 3 leads",
        "Schedule client call",
        "Update project tracker",
        "Invoice reminder",
        "Research 2 vendors",
        "Deadline: Wednesday",
        "Budget: $350",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "ClearPath Consulting", task: "Follow up with 3 leads", deadline: "Wednesday", budget: "$350", priority: "High" },
      { client: "ClearPath Consulting", task: "Schedule client call", deadline: "Wednesday", budget: "$350", priority: "High" },
      { client: "ClearPath Consulting", task: "Update project tracker", deadline: "Wednesday", budget: "$350", priority: "Medium" },
      { client: "ClearPath Consulting", task: "Research 2 vendors", deadline: "Wednesday", budget: "$350", priority: "Medium" },
    ],
    productProofTitle: "Turn admin instructions into a clean task workspace.",
    productProofDescription:
      "Text2Task helps virtual assistants organize mixed admin requests, follow-ups, scheduling tasks, spreadsheet work, invoice reminders, and research notes by client.",
    productProofImage: "/landing/New-Task-CRM.png",
    productProofImageAlt:
      "Text2Task Task CRM showing organized client tasks for admin and virtual assistant workflows.",
    productProofBullets: [
      "Separate follow-up, scheduling, spreadsheet, invoice, and research tasks.",
      "Keep client notes, deadlines, and budgets attached to the work.",
      "Track admin work without manually rebuilding task lists.",
    ],
    workflowTitle: "From mixed admin notes to organized VA work.",
    workflowDescription:
      "Paste client instructions, review the output, and save admin tasks you can manage across clients.",
    workflowSteps: [
      { title: "Paste admin request", description: "Use email, chat, client notes, or screenshots." },
      { title: "Extract admin tasks", description: "Text2Task finds follow-ups, scheduling, updates, research, deadlines, and budget." },
      { title: "Manage client work", description: "Save structured work to your workspace and track it until done." },
    ],
    benefitsTitle: "Built for how VA client work actually arrives.",
    benefitsDescription:
      "Text2Task helps virtual assistants organize mixed instructions, deadlines, notes, links, and client context without creating a heavy system.",
    benefits: [
      { title: "Separate mixed requests", description: "Turn one long client note into multiple clear tasks." },
      { title: "Track deadlines", description: "Keep due dates visible across admin work." },
      { title: "Keep context attached", description: "Save source notes, client details, and budget with the task." },
      { title: "Move faster", description: "Spend less time manually turning client messages into checklists." },
    ],
    commonTasksTitle: "Common VA tasks Text2Task can help organize",
    specificTasks: [
      "Lead follow-ups",
      "Scheduling",
      "Spreadsheet updates",
      "Invoice reminders",
      "Vendor research",
      "Client trackers",
      "Email tasks",
      "Admin deadlines",
      "Client notes",
      "Budget tracking",
    ],
    faqTitle: "Questions about using Text2Task for Virtual Assistants",
    faq: [
      { question: "Can Text2Task handle mixed admin requests?", answer: "Yes. It can separate multiple tasks from one client message." },
      { question: "Can I manage multiple clients?", answer: "Yes. Text2Task keeps client details connected to tasks." },
      { question: "Can it capture deadlines?", answer: "Yes. It can extract deadlines when clients include them in messages." },
      { question: "Is it a full assistant platform?", answer: "No. Text2Task focuses on turning messy client instructions into structured tasks." },
    ],
    relatedUseCases: ["small-agencies", "social-media-managers", "wordpress-freelancers"],
    finalCtaEyebrow: "Try Text2Task for VA work",
    finalCtaTitle: "Turn your next admin request into clean tasks.",
    finalCtaDescription:
      "Paste a real client admin message or upload a screenshot. Review the AI output, edit if needed, and save structured VA tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-gmail-wordpress-freelancers.png",
      heroImageAlt:
        "Gmail-style client email used as a realistic intake visual for admin and virtual assistant work.",
      heroEmail: {
        senderName: "Rachel Adams",
        senderEmail: "rachel@clearpathconsulting.com",
        subject: "Admin tasks for this week",
        timeLabel: "Today, 8:55 AM",
        body: [
          "Can you help organize a few admin tasks this week?",
          "Please follow up with three leads, schedule the client call, update the project tracker, remind accounting about the invoice, and research two vendors before Wednesday.",
          "Budget is around $350 for this admin batch.",
        ],
        attachments: ["lead-list.xlsx", "vendor-notes.pdf"],
      },
      aiSummaryTitle: "Text2Task finds the actual admin work",
      aiSummaryItems: [
        "Follow up with 3 leads",
        "Schedule client call",
        "Update project tracker",
        "Invoice reminder",
        "Research 2 vendors",
        "Deadline: Wednesday",
        "Budget: $350",
      ],
      transformationTitle: "Mixed admin request to clean task plan.",
      transformationDescription:
        "Instead of manually pulling apart a long client note, Text2Task extracts each admin task, deadline, client detail, and budget into a reviewable plan.",
      transformationInputs: ["Follow-ups and scheduling", "Tracker and invoice notes", "Research task, deadline, and budget"],
      transformationOutputs: ["Structured admin tasks", "Editable VA task list", "Client context, deadline, and source notes"],
      transformationValue: "You keep control of the client workflow while the messy admin request is already organized.",
      flowSteps: [
        {
          title: "Client sends mixed admin work",
          description:
            "Follow-ups, scheduling changes, spreadsheet updates, invoice reminders, research links, and deadlines arrive together.",
        },
        {
          title: "AI separates admin tasks",
          description:
            "Text2Task turns the long client note into clear admin tasks with due dates, client details, priority, and context.",
        },
        {
          title: "VA reviews and saves",
          description:
            "Review the suggested task plan, edit details if needed, and keep the admin work organized across clients.",
        },
      ],
      proofTitle: "Real product flow for VA client work.",
      proofDescription:
        "Use Text2Task to manage admin tasks by client, review new updates, and keep context attached to each project.",
      proofImages: [
        { src: "/landing/New-Task-CRM.png", alt: "Text2Task CRM view for admin tasks and client work.", label: "Task CRM" },
        { src: "/landing/text2task-client-update-review.png", alt: "Text2Task client update review flow for admin updates.", label: "Client update review" },
      ],
      manageTitle: "What virtual assistants can manage",
      manageDescription:
        "A focused workspace for follow-ups, scheduling, spreadsheets, invoice reminders, research tasks, links, deadlines, and client notes.",
      manageItems: [
        "Lead follow-ups",
        "Scheduling",
        "Spreadsheet updates",
        "Invoice reminders",
        "Vendor research",
        "Client trackers",
        "Email tasks",
        "Admin deadlines",
      ],
    },
  } satisfies UseCase;
