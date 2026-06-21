import { extractedFields, type UseCase } from "../types";

export const webDesignersUseCase = {
    slug: "web-designers",
    audienceLabel: "Web Designers",
    title: "AI Task Manager for Web Designers",
    seoTitle: "AI Task Manager for Web Designers | Text2Task",
    metaDescription:
      "Text2Task helps freelance web designers turn messy website revision requests, screenshots, homepage edits, mobile fixes, assets, deadlines, and budgets into organized tasks.",
    badge: "Built for freelance web designers",
    heroTitle: "AI task manager for",
    heroHighlight: "web designers",
    heroDescription:
      "Clients rarely send web design revisions in a neat list. They ask for homepage edits, pricing section changes, CTA copy, mobile menu fixes, contact form updates, and logo swaps across email, chat, and screenshots. Text2Task turns that into organized work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Client website requests are rarely organized.",
    problemDescription:
      "A client might describe homepage changes in one message, send the new logo somewhere else, mark up mobile layout issues in a screenshot, and mention the first draft deadline halfway through the thread.",
    beforeMessage:
      "Hi, can you update the homepage hero, add the pricing section, fix mobile, change the CTA, update the contact form, and use the new logo? First draft by Friday. Budget is around $850.",
    scenario: {
      title: "Scenario: Friday website revision request",
      description:
        "A client email includes homepage, pricing, mobile, CTA, form, assets, deadline, and budget in one place.",
      frameType: "email",
      senderName: "Sarah @ Northline Studio",
      senderMeta: "Client website update",
      subject: "Homepage revisions before Friday",
      timeLabel: "Today, 10:14 AM",
      message:
        'Hi, can you update the homepage hero, add the new pricing section, fix the mobile menu, change the CTA to "Book a free consult," update the contact form, and use the new logo from the screenshot? First draft by Friday. Budget is around $850.',
      attachments: ["northline-logo.png", "mobile-notes.png"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Homepage hero update",
        "Pricing section",
        "Mobile menu fix",
        "CTA copy change",
        "Contact form update",
        "Logo/assets note",
        "Deadline: Friday",
        "Budget: $850",
      ],
    },
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Phone number",
      "Email address",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      { client: "Northline Studio", task: "Update homepage hero section", deadline: "Friday", budget: "$850", priority: "High" },
      { client: "Northline Studio", task: "Add new pricing section", deadline: "Friday", budget: "$850", priority: "Medium" },
      { client: "Northline Studio", task: "Fix mobile menu behavior", deadline: "Friday", budget: "$850", priority: "High" },
      { client: "Northline Studio", task: "Change CTA copy to Book a free consult", deadline: "Friday", budget: "$850", priority: "Medium" },
      { client: "Northline Studio", task: "Update contact form and logo assets", deadline: "Friday", budget: "$850", priority: "Low" },
    ],
    productProofTitle: "See messy website revisions become a clean project draft.",
    productProofDescription:
      "Text2Task turns homepage, pricing, mobile menu, CTA, form, asset, deadline, and budget details into a reviewable project preview before anything is saved.",
    productProofImage: "/landing/text2task-ai-project-preview.png",
    productProofImageAlt:
      "Text2Task project preview showing website revision tasks, budget, deadline, priority, and client details for a web design project.",
    productProofBullets: [
      "Separate homepage, pricing, CTA, form, and mobile fixes into clear tasks.",
      "Keep the project budget and first-draft deadline attached to the work.",
      "Review client details, source notes, and assets before saving.",
    ],
    workflowTitle: "From website request to organized web design work.",
    workflowDescription:
      "Text2Task acts like a fast intake layer for website revisions. Paste the client message or screenshot, review the homepage edits, mobile fixes, assets, budget, and deadline, then save the work you need to deliver.",
    workflowSteps: [
      { title: "Paste or upload", description: "Paste the client email, chat message, launch note, or screenshot that contains the website revision request." },
      { title: "Review the AI output", description: "Text2Task separates homepage sections, pricing edits, CTA changes, mobile issues, form updates, assets, budget, and deadline." },
      { title: "Save to your workspace", description: "Keep the website revision organized with status, priority, budget, source notes, and a clear first-draft deadline." },
    ],
    benefitsTitle: "Built for how web design requests actually arrive.",
    benefitsDescription:
      "Text2Task helps freelance web designers organize the website edits, launch details, client assets, and revision notes hidden inside messy messages.",
    benefits: [
      { title: "Capture every website revision", description: "Turn scattered homepage edits, pricing changes, form updates, and screenshot notes into trackable tasks." },
      { title: "Keep launch deadlines visible", description: "Extract first draft and pre-launch due dates so website work does not get buried in the thread." },
      { title: "Connect budget and assets", description: "Keep the project amount, logo notes, client screenshots, and contact details attached to the website request." },
      { title: "Stay lighter than a full PM setup", description: "Use Text2Task when you need to capture website revisions quickly before moving into design or build work." },
    ],
    commonTasksTitle: "Common web design tasks Text2Task can help organize",
    specificTasks: [
      "Homepage revisions",
      "Pricing section changes",
      "CTA copy updates",
      "Mobile menu and layout issues",
      "Contact form updates",
      "Logo and asset notes",
      "Screenshot feedback",
      "Deadlines and budget",
    ],
    faqTitle: "Questions about using Text2Task for Web Designers",
    faq: [
      { question: "Can Text2Task read screenshots from clients?", answer: "Yes. You can upload website feedback screenshots and review extracted section edits, layout issues, and notes before saving them." },
      { question: "Does Text2Task replace my project management tool?", answer: "Not necessarily. Text2Task is built to capture messy website requests and turn them into structured tasks. You can manage them inside Text2Task or export your data when needed." },
      { question: "Can I edit the AI output before saving?", answer: "Yes. Every extracted website task appears in an editable preview before it is saved." },
      { question: "Can Text2Task keep the budget connected to the website project?", answer: "Yes. When the client includes a project amount or budget, Text2Task can capture it with the extracted website tasks." },
      { question: "What is included in the free plan?", answer: "The free plan includes 30 total AI extracts so you can test Text2Task with real client messages before upgrading." },
    ],
    relatedUseCases: ["wordpress-freelancers", "webflow-freelancers", "graphic-designers"],
    finalCtaEyebrow: "Try Text2Task for web design work",
    finalCtaTitle: "Turn your next website request into clean tasks.",
    finalCtaDescription:
      "Paste a real website revision message or upload a client screenshot. Review the AI output, edit if needed, and save structured homepage, mobile, pricing, CTA, form, asset, and deadline tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-gmail-web-designers.png",
      heroImageAlt:
        "Gmail client email with a website revision request for homepage, pricing, mobile menu, contact form, logo, deadline, and budget.",
      heroEmail: {
        senderName: "Sarah Lin",
        senderEmail: "sarah@northlinestudio.com",
        subject: "Homepage revisions before Friday",
        timeLabel: "May 29, 2026, 10:42 AM",
        body: [
          "Hope you are doing well. I wanted to follow up with the final list of homepage updates we discussed.",
          "Please update the homepage hero, add the pricing section, fix the mobile menu, change the CTA to Book a free consult, update the contact form, and use the new logo from the attached screenshot.",
          "Please send the first draft by Friday. Our budget is around $850 for this round of edits.",
        ],
        attachments: ["northline-logo.png"],
      },
      aiSummaryTitle: "Text2Task finds the actual website work",
      aiSummaryItems: [
        "Homepage hero update",
        "Pricing section",
        "Mobile menu fix",
        "CTA copy change",
        "Contact form update",
        "Logo/assets note",
        "Deadline: Friday",
        "Budget: $850",
      ],
      transformationTitle: "Messy website request to clean project plan.",
      transformationDescription:
        "Instead of manually rewriting the client email into a task list, Text2Task pulls out the sections, fixes, assets, deadline, and budget so you can review the plan before saving it.",
      transformationInputs: ["Homepage, pricing, mobile, CTA, form, logo, budget", "Client email and screenshot notes", "Deadline hidden inside the message"],
      transformationOutputs: ["Structured website tasks", "Editable project preview", "Deadline, budget, priority, and source notes"],
      transformationValue: "You keep control of the final task list, but the messy intake work is already organized.",
      flowSteps: [
        {
          title: "Client email arrives",
          description:
            "Homepage edits, pricing changes, mobile fixes, CTA copy, assets, deadline, and budget arrive in one request.",
        },
        {
          title: "AI extracts the website work",
          description:
            "Text2Task separates the request into clean website tasks with deadline, budget, client details, and source notes.",
        },
        {
          title: "Designer reviews and saves",
          description:
            "Review the extracted plan, edit anything needed, and save the website revision as organized work.",
        },
      ],
      proofTitle: "Real product flow for website revision work.",
      proofDescription:
        "Use Text2Task to review extracted website work, keep project resources attached, and manage the client request after it becomes a project.",
      proofImages: [
        { src: "/landing/text2task-ai-project-preview.png", alt: "Text2Task AI project preview with extracted website revision tasks.", label: "AI project preview" },
        { src: "/landing/text2task-project-resources.png", alt: "Text2Task project resources view for files, links, and notes.", label: "Project resources" },
      ],
      manageTitle: "What web designers can manage",
      manageDescription:
        "A focused workspace for website edits that usually arrive through email, chat, screenshots, and asset handoffs.",
      manageItems: [
        "Homepage revisions",
        "Pricing section changes",
        "CTA copy updates",
        "Mobile menu and layout issues",
        "Contact form updates",
        "Logo and asset notes",
        "Screenshot feedback",
        "Deadlines and budget",
      ],
    },
  } satisfies UseCase;
