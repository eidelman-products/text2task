import { extractedFields, type UseCase } from "../types";

export const smallAgenciesUseCase = {
    slug: "small-agencies",
    audienceLabel: "Small Agencies",
    title: "AI Task Manager for Small Agencies",
    seoTitle: "AI Task Manager for Small Agencies | Text2Task",
    metaDescription:
      "Text2Task helps small agencies turn messy client requests, landing page edits, creative requests, content notes, deadlines, budgets, and project handoffs into organized tasks.",
    badge: "Built for small agency work",
    heroTitle: "AI task manager for",
    heroHighlight: "small agencies",
    heroDescription:
      "Small agencies receive client requests through email, WhatsApp, screenshots, notes, and quick calls. Text2Task helps turn those scattered requests into structured tasks your team can review and deliver.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Agency requests often include multiple services at once.",
    problemDescription:
      "One client can ask for landing page edits, ad creative, copy changes, form fixes, and a deadline in the same message. Text2Task helps turn it into organized work.",
    beforeMessage:
      "Can your team update the landing page hero, create 2 ad creatives, rewrite the CTA section, fix the lead form, and send everything before next Friday? Budget around $1,200.",
    scenario: {
      title: "Scenario: multi-service client request",
      description:
        "A client sends website edits, ad creative, copy updates, form fixes, deadline, team handoff, and budget in one message.",
      frameType: "email",
      senderName: "Olivia @ Harbor Dental",
      senderMeta: "Small agency client",
      subject: "Landing page and ad updates",
      timeLabel: "Today, 1:30 PM",
      message:
        "Can your team update the landing page hero, create 2 ad creatives, rewrite the CTA section, fix the lead form, and send everything before next Friday? Budget is around $1,200 for this batch. Please keep the website and ads under the same project.",
      attachments: ["ad-brief.pdf", "landing-page-notes.png"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Landing page hero update",
        "2 ad creatives",
        "CTA section rewrite",
        "Lead form fix",
        "Shared project note",
        "Deadline: next Friday",
        "Budget: $1,200",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "Harbor Dental", task: "Update landing page hero", deadline: "Next Friday", budget: "$1,200", priority: "High" },
      { client: "Harbor Dental", task: "Create 2 ad creatives", deadline: "Next Friday", budget: "$1,200", priority: "Medium" },
      { client: "Harbor Dental", task: "Rewrite CTA section", deadline: "Next Friday", budget: "$1,200", priority: "Medium" },
      { client: "Harbor Dental", task: "Fix lead form", deadline: "Next Friday", budget: "$1,200", priority: "High" },
    ],
    productProofTitle: "Keep small agency work visible across clients.",
    productProofDescription:
      "Text2Task gives small teams a focused workspace for client requests, resources, deadlines, budgets, priorities, and delivery status without the weight of an enterprise CRM.",
    productProofImage: "/landing/New-Task-CRM.png",
    productProofImageAlt:
      "Text2Task Task CRM showing organized client projects for small agency work.",
    productProofBullets: [
      "Turn multi-service client requests into clear project tasks.",
      "Keep budgets, deadlines, and source notes connected to the client.",
      "Track delivery without losing work across channels.",
    ],
    workflowTitle: "From client request to organized agency delivery.",
    workflowDescription:
      "Paste incoming requests, review the output, and save the project tasks your team needs to deliver.",
    workflowSteps: [
      { title: "Capture incoming work", description: "Paste messages or upload screenshots from clients." },
      { title: "Extract project tasks", description: "Text2Task turns messy requests into organized tasks." },
      { title: "Track delivery", description: "Manage deadlines, budgets, status, priority, and client context." },
    ],
    benefitsTitle: "Built for how small agency work actually arrives.",
    benefitsDescription:
      "Text2Task helps small agencies organize client requests, screenshots, deadlines, budgets, project notes, and delivery tasks across active clients.",
    benefits: [
      { title: "Organize multiple clients", description: "Keep client work from getting buried across different channels." },
      { title: "Track revenue-connected tasks", description: "Capture budgets and amounts attached to client work." },
      { title: "Improve delivery visibility", description: "See what needs attention before deadlines are missed." },
      { title: "Stay lighter than enterprise CRM", description: "Use a focused tool for turning messy requests into structured tasks." },
    ],
    commonTasksTitle: "Common agency tasks Text2Task can help organize",
    specificTasks: [
      "Landing page edits",
      "Ad creative requests",
      "CTA rewrites",
      "Lead form fixes",
      "Campaign updates",
      "Design deliverables",
      "Website maintenance",
      "Content requests",
      "Delivery checklists",
      "Monthly client batches",
    ],
    faqTitle: "Questions about using Text2Task for Small Agencies",
    faq: [
      { question: "Can Text2Task work for small agencies?", answer: "Yes. Text2Task is useful for small service teams that receive client work through messages, notes, and screenshots." },
      { question: "Is it a full enterprise CRM?", answer: "No. Text2Task is intentionally lightweight and focused on task extraction and client work organization." },
      { question: "Can we export task data?", answer: "CSV export is available on the Pro plan." },
      { question: "Can we use it before project management tools?", answer: "Yes. Text2Task can act as the capture layer before work moves into another system." },
    ],
    relatedUseCases: ["web-designers", "wordpress-freelancers", "virtual-assistants"],
    finalCtaEyebrow: "Try Text2Task for small agency work",
    finalCtaTitle: "Turn your next client request into clean agency tasks.",
    finalCtaDescription:
      "Paste a real client message or upload a screenshot. Review the AI output, edit if needed, and save structured agency tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-gmail-web-designers.png",
      heroImageAlt:
        "Gmail-style client request used as a small agency intake visual for multi-service client work.",
      heroEmail: {
        senderName: "Olivia Grant",
        senderEmail: "olivia@harbordental.com",
        subject: "Landing page and ad updates",
        timeLabel: "Today, 1:30 PM",
        body: [
          "Can your team update the landing page hero, create 2 ad creatives, rewrite the CTA section, and fix the lead form?",
          "Please send everything before next Friday. Budget is around $1,200 for this batch.",
          "Please keep the website and ad work under the same project so we can review it together.",
        ],
        attachments: ["ad-brief.pdf", "landing-page-notes.png"],
      },
      aiSummaryTitle: "Text2Task finds the actual agency work",
      aiSummaryItems: [
        "Landing page hero update",
        "2 ad creatives",
        "CTA section rewrite",
        "Lead form fix",
        "Shared project note",
        "Deadline: next Friday",
        "Budget: $1,200",
      ],
      transformationTitle: "Messy agency request to clean delivery plan.",
      transformationDescription:
        "Instead of manually splitting a multi-service request between website, creative, and form tasks, Text2Task extracts the work into a reviewable project plan.",
      transformationInputs: ["Website edits and ad creative", "CTA copy and form fix", "Deadline, budget, and project note"],
      transformationOutputs: ["Structured agency tasks", "Editable delivery plan", "Client context, deadline, and budget"],
      transformationValue: "Your team keeps control of delivery while the messy intake is already organized.",
      flowSteps: [
        {
          title: "Client request reaches the team",
          description:
            "Website edits, content notes, design changes, deadlines, budgets, files, and client context arrive in one messy message.",
        },
        {
          title: "AI creates an agency task plan",
          description:
            "Text2Task separates the request into clear work items that can be reviewed, assigned, tracked, and managed.",
        },
        {
          title: "Team reviews and saves",
          description:
            "Review the plan, adjust details, and keep client work organized before handing it to the right person.",
        },
      ],
      proofTitle: "Real product flow for small agency delivery.",
      proofDescription:
        "Use Text2Task to manage client projects, keep resources attached, and track tasks across small service teams.",
      proofImages: [
        { src: "/landing/New-Task-CRM.png", alt: "Text2Task CRM view for small agency client work.", label: "Task CRM" },
        { src: "/landing/text2task-project-resources.png", alt: "Text2Task project resources view for agency files, links, and notes.", label: "Project resources" },
      ],
      manageTitle: "What small agencies can organize",
      manageDescription:
        "A focused workspace for multi-client requests, website edits, creative tasks, content notes, files, deadlines, budgets, and project context.",
      manageItems: [
        "Landing page edits",
        "Ad creative requests",
        "CTA rewrites",
        "Lead form fixes",
        "Campaign updates",
        "Website maintenance",
        "Content requests",
        "Delivery checklists",
      ],
    },
  } satisfies UseCase;
