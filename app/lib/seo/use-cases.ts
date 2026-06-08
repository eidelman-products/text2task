export type UseCaseFaq = {
  question: string;
  answer: string;
};

export type UseCaseExampleTask = {
  client: string;
  task: string;
  deadline: string;
  budget: string;
  priority: "Low" | "Medium" | "High";
};

export type UseCaseScenarioFrameType = "email" | "chat" | "note";

export type UseCaseScenario = {
  title: string;
  description: string;
  frameType: UseCaseScenarioFrameType;
  senderName: string;
  senderMeta: string;
  subject?: string;
  timeLabel: string;
  message: string;
  attachments?: string[];
  outcomeTitle: string;
  outcomeBullets: string[];
};

export type UseCaseV5EmailFrame = {
  senderName: string;
  senderEmail: string;
  subject: string;
  timeLabel: string;
  body: string[];
  attachments: string[];
};

export type UseCaseV5ProofImage = {
  src: string;
  alt: string;
  label: string;
};

export type UseCaseV5FlowStep = {
  title: string;
  description: string;
};

export type UseCaseV5Content = {
  heroEmail: UseCaseV5EmailFrame;
  heroImage: string;
  heroImageAlt: string;
  aiSummaryTitle: string;
  aiSummaryItems: string[];
  transformationTitle: string;
  transformationDescription: string;
  transformationInputs: string[];
  transformationOutputs: string[];
  transformationValue: string;
  flowSteps?: UseCaseV5FlowStep[];
  proofTitle: string;
  proofDescription: string;
  proofImages: UseCaseV5ProofImage[];
  manageTitle?: string;
  manageDescription?: string;
  manageItems: string[];
};

export type UseCasePageData = {
  slug: string;
  audienceLabel: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  badge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  problemTitle: string;
  problemDescription: string;
  beforeMessage: string;
  scenario: UseCaseScenario;
  extractedFields: string[];
  exampleTasks: UseCaseExampleTask[];
  productProofTitle: string;
  productProofDescription: string;
  productProofImage: string;
  productProofImageAlt: string;
  productProofBullets: string[];
  workflowTitle: string;
  workflowDescription: string;
  workflowSteps: {
    title: string;
    description: string;
  }[];
  benefitsTitle: string;
  benefitsDescription: string;
  benefits: {
    title: string;
    description: string;
  }[];
  commonTasksTitle: string;
  specificTasks: string[];
  faqTitle: string;
  faq: UseCaseFaq[];
  relatedUseCases: string[];
  finalCtaEyebrow: string;
  finalCtaTitle: string;
  finalCtaDescription: string;
  finalCtaPrimary: string;
  finalCtaSecondary: string;
  v5?: UseCaseV5Content;
};

const extractedFields = [
  "Client name",
  "Task title",
  "Deadline",
  "Budget",
  "Priority",
  "Client notes",
  "Source message",
];

export const useCases: UseCasePageData[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

export function getAllUseCases() {
  return useCases;
}

export function getUseCaseBySlug(slug: string) {
  return useCases.find((useCase) => useCase.slug === slug);
}

export function getRelatedUseCases(slugs: string[]) {
  return slugs
    .map((slug) => getUseCaseBySlug(slug))
    .filter((useCase): useCase is UseCasePageData => Boolean(useCase));
}

export function getUseCaseSlugs() {
  return useCases.map((useCase) => useCase.slug);
}
