import { extractedFields, type UseCase } from "../types";

export const wordpressFreelancersUseCase = {
    slug: "wordpress-freelancers",
    audienceLabel: "WordPress Freelancers",
    title: "AI Task Manager for WordPress Freelancers",
    seoTitle: "AI Task Manager for WordPress Freelancers | Text2Task",
    metaDescription:
      "Text2Task helps WordPress freelancers organize messy client requests, plugin fixes, page edits, mobile issues, content updates, deadlines, and budgets into structured tasks.",
    badge: "Built for WordPress service work",
    heroTitle: "AI task manager for",
    heroHighlight: "WordPress freelancers",
    heroDescription:
      "WordPress clients rarely send one clean checklist. They mix plugin fixes, Elementor spacing, contact form bugs, homepage copy, SEO notes, cache issues, deadlines, and budgets inside one email. Text2Task turns that into organized work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "WordPress maintenance requests can get messy fast.",
    problemDescription:
      "One client message can include plugin updates, broken layouts, content edits, login issues, and urgent deadlines. Text2Task helps separate the real work into clear tasks.",
    beforeMessage:
      "Can you refresh the homepage copy, fix Elementor spacing on mobile, repair the contact form emails, update blog categories, replace footer details, and check SEO/cache? Budget around $620.",
    scenario: {
      title: "Scenario: WordPress fixes and content updates",
      description:
        "A maintenance email includes layout fixes, form delivery, content updates, plugin checks, SEO/cache notes, deadline, and budget.",
      frameType: "email",
      senderName: "Laura @ Pine & Paper Co",
      senderMeta: "WordPress maintenance client",
      subject: "WordPress fixes and content updates",
      timeLabel: "Today, 9:18 AM",
      message:
        "Please refresh the homepage copy and testimonials, fix Elementor spacing on mobile, repair the contact form email delivery, update blog category pages, replace the footer phone number and office hours, and check the SEO plugin and cache setup. Ready by early next week. Budget is around $620.",
      attachments: ["site-notes.pdf"],
      outcomeTitle: "Text2Task turns it into",
      outcomeBullets: [
        "Homepage copy refresh",
        "Elementor mobile spacing",
        "Contact form delivery fix",
        "Blog category updates",
        "Footer details replacement",
        "SEO/cache check",
        "Deadline: early next week",
        "Budget: $620",
      ],
    },
    extractedFields,
    exampleTasks: [
      { client: "Pine & Paper Co", task: "Refresh homepage copy and testimonials", deadline: "Early next week", budget: "$620", priority: "Medium" },
      { client: "Pine & Paper Co", task: "Fix Elementor spacing on mobile", deadline: "Early next week", budget: "$620", priority: "High" },
      { client: "Pine & Paper Co", task: "Repair contact form email delivery", deadline: "Early next week", budget: "$620", priority: "High" },
      { client: "Pine & Paper Co", task: "Update blog category pages", deadline: "Early next week", budget: "$620", priority: "Medium" },
    ],
    productProofTitle: "Track WordPress fixes in one client workspace.",
    productProofDescription:
      "Text2Task gives WordPress freelancers a clean CRM-style view for plugin updates, page edits, form bugs, mobile issues, priorities, and deadlines.",
    productProofImage: "/landing/New-Task-CRM.png",
    productProofImageAlt:
      "Text2Task Task CRM showing client projects, statuses, priorities, deadlines, and resources for WordPress maintenance work.",
    productProofBullets: [
      "Keep plugin fixes, content edits, and bugs grouped by client project.",
      "Use status, priority, and deadline fields to manage maintenance work.",
      "Open project resources when client notes or files need to stay attached.",
    ],
    workflowTitle: "From WordPress request to organized maintenance work.",
    workflowDescription:
      "Paste the WordPress request, review the output, and save the fixes you need to complete.",
    workflowSteps: [
      { title: "Capture maintenance notes", description: "Paste the client email, bug report, or screenshot." },
      { title: "Extract WordPress tasks", description: "Separate plugin, page, form, SEO, mobile, cache, and content work." },
      { title: "Track the job", description: "Save status, priority, budget, and deadline in one workspace." },
    ],
    benefitsTitle: "Built for how WordPress work actually arrives.",
    benefitsDescription:
      "Text2Task helps WordPress freelancers organize plugin fixes, page edits, bugs, deadlines, and notes from messy client messages.",
    benefits: [
      { title: "Organize maintenance work", description: "Track plugin updates, fixes, content changes, and support tasks without losing context." },
      { title: "Keep urgent fixes visible", description: "Use priority and deadlines to avoid missing time-sensitive client issues." },
      { title: "Turn chat into workflow", description: "Move from messy client messages to structured work in seconds." },
      { title: "Export when needed", description: "Pro users can export task and client data to CSV." },
    ],
    commonTasksTitle: "Common WordPress tasks Text2Task can help organize",
    specificTasks: [
      "Plugin updates",
      "Elementor spacing fixes",
      "Contact form bugs",
      "Homepage copy changes",
      "Mobile layout fixes",
      "Blog category updates",
      "Footer details",
      "SEO plugin checks",
      "Caching setup",
      "Client revision lists",
    ],
    faqTitle: "Questions about using Text2Task for WordPress Freelancers",
    faq: [
      { question: "Can Text2Task handle WordPress maintenance requests?", answer: "Yes. It can extract separate tasks from messages that include plugin updates, page edits, bugs, deadlines, and notes." },
      { question: "Does it connect directly to WordPress?", answer: "No. Text2Task does not need WordPress access. It helps organize the client request before or during your workflow." },
      { question: "Can I use it for multiple clients?", answer: "Yes. Text2Task is designed to organize tasks by client and keep each request trackable." },
      { question: "Can I export my task list?", answer: "CSV export is available for Pro users." },
    ],
    relatedUseCases: ["web-designers", "webflow-freelancers", "small-agencies"],
    finalCtaEyebrow: "Try Text2Task for WordPress work",
    finalCtaTitle: "Turn your next WordPress request into clean tasks.",
    finalCtaDescription:
      "Paste a real WordPress client message or upload a screenshot. Review the AI output, edit if needed, and save structured maintenance tasks to your workspace.",
    finalCtaPrimary: "Start free",
    finalCtaSecondary: "Back to home",
    v5: {
      heroImage: "/landing/text2task-client-gmail-wordpress-freelancers.png",
      heroImageAlt:
        "Gmail client email with WordPress fixes, Elementor spacing, contact form, blog category, footer, SEO, cache, deadline, and budget notes.",
      heroEmail: {
        senderName: "Laura Bennett",
        senderEmail: "laura@pineandpaper.co",
        subject: "WordPress fixes and content updates",
        timeLabel: "Jun 2, 2026, 9:18 AM",
        body: [
          "Could you help with a few WordPress fixes and content updates this week?",
          "Please refresh the homepage copy and testimonials, fix Elementor spacing on mobile, repair the contact form email delivery, update blog category pages, replace the footer phone number and office hours, and check the SEO plugin and caching setup.",
          "It would be great to have this ready by early next week. Budget is around $620.",
        ],
        attachments: ["site-notes.pdf"],
      },
      aiSummaryTitle: "Text2Task turns the maintenance email into tasks",
      aiSummaryItems: [
        "Homepage copy refresh",
        "Elementor mobile spacing",
        "Contact form email fix",
        "Blog category updates",
        "Footer phone and hours",
        "SEO/cache check",
        "Deadline: early next week",
        "Budget: $620",
      ],
      transformationTitle: "Messy WordPress request to clean maintenance plan.",
      transformationDescription:
        "Instead of manually separating bugs, content edits, plugin notes, and deadlines, Text2Task turns the client message into a reviewable maintenance plan.",
      transformationInputs: ["Plugin and page notes", "Mobile and form bugs", "SEO/cache checks and budget"],
      transformationOutputs: ["Structured maintenance tasks", "Editable project preview", "Deadline, budget, priority, and source notes"],
      transformationValue: "You keep control of the final task list while the messy maintenance intake is already organized.",
      flowSteps: [
        {
          title: "Client sends WordPress fixes",
          description:
            "Plugin issues, page edits, content updates, mobile bugs, access notes, and deadlines arrive together.",
        },
        {
          title: "AI separates maintenance tasks",
          description:
            "Text2Task turns the request into structured WordPress work with status, priority, deadline, and client context.",
        },
        {
          title: "Freelancer reviews and saves",
          description:
            "Check the suggested tasks, adjust the details, and keep the WordPress request organized before starting.",
        },
      ],
      proofTitle: "Real product flow for WordPress maintenance work.",
      proofDescription:
        "Use Text2Task to track fixes, keep project updates reviewable, and manage maintenance requests without losing client context.",
      proofImages: [
        { src: "/landing/New-Task-CRM.png", alt: "Text2Task CRM view for tracking client projects and WordPress maintenance work.", label: "Task CRM" },
        { src: "/landing/text2task-client-update-review.png", alt: "Text2Task client update review flow for analyzing new updates before saving changes.", label: "Client update review" },
      ],
      manageTitle: "What WordPress freelancers can manage",
      manageDescription:
        "A focused workspace for plugin fixes, page edits, mobile issues, content updates, client notes, deadlines, and maintenance requests.",
      manageItems: [
        "Plugin updates",
        "Elementor spacing fixes",
        "Contact form bugs",
        "Homepage copy changes",
        "Blog category updates",
        "Footer details",
        "SEO/cache checks",
        "Deadlines and budget",
      ],
    },
  } satisfies UseCase;
