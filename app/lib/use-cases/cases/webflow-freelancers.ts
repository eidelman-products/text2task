import { extractedFields, type UseCase } from "../types";

export const webflowFreelancersUseCase = {
    slug: "webflow-freelancers",
    audienceLabel: "Webflow Freelancers",
    title: "AI Task Manager for Webflow Freelancers",
    seoTitle: "AI Task Manager for Webflow Freelancers | Text2Task",
    metaDescription:
      "Text2Task helps Webflow freelancers turn scattered client feedback, CMS layout notes, launch tweaks, form connections, images, deadlines, and budgets into organized tasks.",
    badge: "Built for Webflow projects",
    heroTitle: "AI task manager for",
    heroHighlight: "Webflow freelancers",
    heroDescription:
      "Webflow launches move fast. Clients send hero copy, CMS layout issues, mobile navigation fixes, form links, image swaps, FAQ requests, deadlines, and budgets across email and chat. Text2Task turns that into structured work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Webflow launch feedback often arrives in pieces.",
    problemDescription:
      "A client may send layout edits, CMS notes, mobile issues, image swaps, and launch requests across email, chat, and screenshots. Text2Task helps turn all of that into trackable tasks.",
    beforeMessage:
      "Can you update the hero and pricing copy, fix the CMS layout, improve mobile nav, connect CTA buttons to the form, replace images, and add FAQ before launch? First pass by Friday. Budget around $980.",
    scenario: {
      title: "Scenario: Webflow launch tweaks for Friday",
      description:
        "A launch email combines hero copy, CMS layout, mobile navigation, form connections, image swaps, FAQ, deadline, and budget before go-live.",
      frameType: "email",
      senderName: "Jason @ FlowHaus Studio",
      senderMeta: "Webflow launch client",
      subject: "Webflow launch tweaks for Friday",
      timeLabel: "Today, 11:06 AM",
      message:
        "Can you update the hero and pricing copy, fix the CMS collection page layout, improve the mobile navigation interaction, connect the CTA buttons to the correct form, replace team headshots and section images, and add a short FAQ section before launch? First pass by Friday. Budget is around $980.",
      attachments: ["launch-assets.zip"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Hero and pricing copy",
        "CMS layout fix",
        "Mobile navigation interaction",
        "CTA form connections",
        "Team image replacement",
        "FAQ section",
        "Deadline: Friday",
        "Budget: $980",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "FlowHaus Studio", task: "Update hero and pricing copy", deadline: "Friday", budget: "$980", priority: "High" },
      { client: "FlowHaus Studio", task: "Fix CMS collection layout", deadline: "Friday", budget: "$980", priority: "High" },
      { client: "FlowHaus Studio", task: "Connect CTA buttons to form", deadline: "Friday", budget: "$980", priority: "Medium" },
      { client: "FlowHaus Studio", task: "Add FAQ section before launch", deadline: "Friday", budget: "$980", priority: "Medium" },
    ],
    productProofTitle: "Turn Webflow launch feedback into reviewable tasks.",
    productProofDescription:
      "Text2Task helps Webflow freelancers structure page sections, responsive fixes, CMS notes, forms, images, FAQ requests, deadlines, and budgets before launch work gets messy.",
    productProofImage: "/landing/text2task-ai-project-preview.png",
    productProofImageAlt:
      "Text2Task project preview showing extracted page section tasks and project details for a Webflow launch workflow.",
    productProofBullets: [
      "Capture hero, CMS, form, FAQ, image, and responsive layout requests.",
      "Review launch tasks with deadline, budget, and priority before saving.",
      "Keep client feedback organized before moving back into Webflow.",
    ],
    workflowTitle: "From Webflow feedback to organized launch tasks.",
    workflowDescription:
      "Text2Task is designed as a fast capture layer for Webflow projects. Paste feedback, review the output, and save the launch tasks you need to finish.",
    workflowSteps: [
      { title: "Capture the feedback", description: "Paste Webflow feedback from email, chat, notes, or screenshots." },
      { title: "Extract launch tasks", description: "Text2Task identifies pages, sections, deadlines, budgets, and priorities." },
      { title: "Manage until delivery", description: "Save the work to your workspace and track progress until launch." },
    ],
    benefitsTitle: "Built for how Webflow feedback actually arrives.",
    benefitsDescription:
      "Text2Task helps Webflow freelancers organize scattered page edits, responsive fixes, CMS notes, launch requests, and client screenshots.",
    benefits: [
      { title: "Organize launch requests", description: "Keep pre-launch edits, bugs, and content updates in one clear list." },
      { title: "Capture design revisions", description: "Turn visual feedback and notes into structured tasks." },
      { title: "Keep budgets attached", description: "Extract project amounts and keep them connected to client work." },
      { title: "Avoid scattered feedback", description: "Stop losing Webflow requests across screenshots, email, and chat." },
    ],
    commonTasksTitle: "Common Webflow tasks Text2Task can help organize",
    specificTasks: [
      "Hero copy updates",
      "CMS layout fixes",
      "Mobile navigation",
      "CTA form connections",
      "Team image swaps",
      "FAQ sections",
      "Launch checklist items",
      "Tablet layout fixes",
      "Client screenshot feedback",
      "Deadlines and budget",
    ],
    faqTitle: "Questions about using Text2Task for Webflow Freelancers",
    faq: [
      { question: "Can Text2Task organize Webflow launch feedback?", answer: "Yes. It can extract tasks from client messages, launch notes, screenshots, and revision lists." },
      { question: "Does Text2Task integrate directly with Webflow?", answer: "No. It does not need Webflow access. It helps organize client requests before you manage the work." },
      { question: "Can I edit tasks before saving?", answer: "Yes. All extracted tasks can be reviewed and edited before saving." },
      { question: "Is there a free plan?", answer: "Yes. The free plan includes 30 total AI extracts." },
    ],
    relatedUseCases: ["web-designers", "wordpress-freelancers", "graphic-designers"],
    finalCtaEyebrow: "Try Text2Task for Webflow work",
    finalCtaTitle: "Turn your next Webflow request into clean tasks.",
    finalCtaDescription:
      "Paste a real Webflow client message or upload a screenshot. Review the AI output, edit if needed, and save structured launch tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-gmail-webflow-freelancers.png",
      heroImageAlt:
        "Gmail client email with Webflow launch tweaks for hero copy, CMS layout, mobile navigation, CTA forms, images, FAQ, deadline, and budget.",
      heroEmail: {
        senderName: "Jason Cole",
        senderEmail: "jason@flowhaus.studio",
        subject: "Webflow launch tweaks for Friday",
        timeLabel: "Jun 4, 2026, 11:06 AM",
        body: [
          "We are close to launch, but I have a few final Webflow tweaks before Friday.",
          "Please update the hero and pricing copy, fix the CMS collection page layout, improve the mobile navigation interaction, connect the CTA buttons to the correct form, replace team headshots and a few section images, and add a short FAQ section before launch.",
          "Can you send a first pass by Friday? Budget is around $980.",
        ],
        attachments: ["launch-assets.zip"],
      },
      aiSummaryTitle: "Text2Task finds the launch work",
      aiSummaryItems: [
        "Hero and pricing copy",
        "CMS collection layout",
        "Mobile navigation",
        "CTA form connections",
        "Team headshot updates",
        "FAQ section",
        "Deadline: Friday",
        "Budget: $980",
      ],
      transformationTitle: "Messy Webflow launch feedback to clean launch plan.",
      transformationDescription:
        "Instead of manually pulling apart launch notes, Text2Task extracts Webflow sections, responsive fixes, form connections, assets, deadline, and budget into a reviewable plan.",
      transformationInputs: ["Hero, CMS, mobile, form, images", "Launch assets and screenshots", "Deadline and budget"],
      transformationOutputs: ["Structured Webflow tasks", "Editable launch checklist", "Deadline, budget, priority, and source notes"],
      transformationValue: "You keep control of the final launch list while the messy feedback is already organized.",
      flowSteps: [
        {
          title: "Client sends Webflow changes",
          description:
            "CMS notes, layout fixes, launch tweaks, form changes, image updates, and deadlines arrive in one messy request.",
        },
        {
          title: "AI extracts Webflow tasks",
          description:
            "Text2Task turns scattered Webflow feedback into a clean list of page, CMS, design, and launch tasks.",
        },
        {
          title: "Review before updating Webflow",
          description:
            "Confirm the extracted work, keep source notes attached, and save a clear project plan before making changes.",
        },
      ],
      proofTitle: "Real product flow for Webflow launch work.",
      proofDescription:
        "Use Text2Task to review extracted launch tasks, upload screenshots, and keep page feedback connected to the project.",
      proofImages: [
        { src: "/landing/text2task-ai-project-preview.png", alt: "Text2Task AI project preview for website launch tasks.", label: "AI project preview" },
        { src: "/landing/text2task-upload-screenshot.png", alt: "Text2Task screenshot upload flow for extracting client feedback.", label: "Screenshot extraction" },
      ],
      manageTitle: "What Webflow freelancers can manage",
      manageDescription:
        "A focused workspace for CMS updates, page edits, launch notes, form connections, image swaps, responsive fixes, and client feedback.",
      manageItems: [
        "Hero copy updates",
        "CMS layout fixes",
        "Mobile navigation",
        "CTA form connections",
        "Team image swaps",
        "FAQ sections",
        "Launch checklist items",
        "Deadlines and budget",
      ],
    },
  } satisfies UseCase;
