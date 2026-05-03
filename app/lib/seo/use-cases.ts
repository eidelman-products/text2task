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
  extractedFields: string[];
  exampleTasks: UseCaseExampleTask[];
  workflowSteps: {
    title: string;
    description: string;
  }[];
  benefits: {
    title: string;
    description: string;
  }[];
  specificTasks: string[];
  faq: UseCaseFaq[];
  relatedUseCases: string[];
};

export const useCases: UseCasePageData[] = [
  {
    slug: "web-designers",
    audienceLabel: "Web Designers",
    title: "AI Task Manager for Web Designers",
    seoTitle: "AI Task Manager for Web Designers | Text2Task",
    metaDescription:
      "Text2Task helps web designers turn messy client website requests, emails, notes, and screenshots into organized tasks with deadlines, budgets, priorities, and client details.",
    badge: "Built for freelance web designers",
    heroTitle: "AI task manager for",
    heroHighlight: "web designers",
    heroDescription:
      "Clients send website edits through email, WhatsApp, screenshots, and random notes. Text2Task extracts the real work — tasks, deadlines, budgets, client details, and notes — then organizes everything in one clean workspace.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Client website requests are rarely organized.",
    problemDescription:
      "A client may send homepage changes in one message, logo files in another, mobile issues in a screenshot, and a deadline somewhere in the middle. Text2Task helps you capture the real tasks before they disappear inside chat threads.",
    beforeMessage:
      "Hi, can you update the homepage, add a pricing section, fix the mobile menu, change the CTA button, and send the first draft by Friday? Budget is around $850. Also use the new logo I sent on WhatsApp.",
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
      {
        client: "Northline Studio",
        task: "Update homepage layout",
        deadline: "Friday",
        budget: "$850",
        priority: "High",
      },
      {
        client: "Northline Studio",
        task: "Add pricing section",
        deadline: "Friday",
        budget: "$850",
        priority: "Medium",
      },
      {
        client: "Northline Studio",
        task: "Fix mobile menu behavior",
        deadline: "Friday",
        budget: "$850",
        priority: "High",
      },
      {
        client: "Northline Studio",
        task: "Change CTA button copy",
        deadline: "Friday",
        budget: "$850",
        priority: "Medium",
      },
      {
        client: "Northline Studio",
        task: "Use new logo from WhatsApp",
        deadline: "Friday",
        budget: "$850",
        priority: "Low",
      },
    ],
    workflowSteps: [
      {
        title: "Paste or upload",
        description:
          "Paste a client message, email, project note, or upload a screenshot from your client conversation.",
      },
      {
        title: "Review the AI output",
        description:
          "Text2Task extracts structured tasks, but you stay in control. Review and edit everything before saving.",
      },
      {
        title: "Save to your workspace",
        description:
          "Keep client work organized with deadlines, budgets, priority, status, notes, and CSV export on Pro.",
      },
    ],
    benefits: [
      {
        title: "Capture every website request",
        description:
          "Turn scattered website edits, revision notes, screenshots, and client messages into trackable tasks.",
      },
      {
        title: "Reduce missed deadlines",
        description:
          "Extract due dates from messy messages and keep client work visible inside one workspace.",
      },
      {
        title: "Track budgets and client details",
        description:
          "Keep task amounts, emails, phone numbers, notes, and project details connected to the client.",
      },
      {
        title: "Stay lightweight",
        description:
          "Use Text2Task when a heavy CRM or project management setup feels too slow for quick freelance work.",
      },
    ],
    specificTasks: [
      "Homepage updates",
      "Landing page revisions",
      "Pricing section changes",
      "Mobile layout fixes",
      "Navigation menu bugs",
      "CTA button updates",
      "Logo replacement requests",
      "Website copy changes",
      "Client feedback from screenshots",
      "Pre-launch revision lists",
    ],
    faq: [
      {
        question: "Can Text2Task read screenshots from clients?",
        answer:
          "Yes. You can upload screenshots and review the extracted tasks before saving them to your workspace.",
      },
      {
        question: "Does Text2Task replace my project management tool?",
        answer:
          "Not necessarily. Text2Task is built to capture messy client requests and turn them into structured tasks. You can manage them inside Text2Task or export your data when needed.",
      },
      {
        question: "Can I edit the AI output before saving?",
        answer:
          "Yes. Every extracted task appears in an editable preview before it is saved.",
      },
      {
        question: "Is Text2Task only for web designers?",
        answer:
          "No. Text2Task is also useful for freelancers, designers, social media managers, video editors, virtual assistants, and small agencies.",
      },
      {
        question: "What is included in the free plan?",
        answer:
          "The free plan includes 30 total AI extracts so you can test Text2Task with real client messages before upgrading.",
      },
    ],
    relatedUseCases: [
      "wordpress-freelancers",
      "webflow-freelancers",
      "graphic-designers",
    ],
  },
  {
    slug: "wordpress-freelancers",
    audienceLabel: "WordPress Freelancers",
    title: "AI Task Manager for WordPress Freelancers",
    seoTitle: "AI Task Manager for WordPress Freelancers | Text2Task",
    metaDescription:
      "Text2Task helps WordPress freelancers organize messy client requests, plugin fixes, page edits, mobile issues, and revision notes into structured tasks.",
    badge: "Built for WordPress service work",
    heroTitle: "AI task manager for",
    heroHighlight: "WordPress freelancers",
    heroDescription:
      "WordPress clients often send scattered requests about plugins, pages, bugs, mobile fixes, content changes, and deadlines. Text2Task helps turn those messages into clear tasks you can track.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "WordPress maintenance requests can get messy fast.",
    problemDescription:
      "One client message can include plugin updates, broken layouts, content edits, login issues, and urgent deadlines. Text2Task helps separate the real work into clear tasks.",
    beforeMessage:
      "Can you update the plugins, fix the contact form, change the homepage banner, check why the mobile menu is broken, and finish it before Monday? Budget is $420.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "BrightLocal",
        task: "Update WordPress plugins",
        deadline: "Monday",
        budget: "$420",
        priority: "Medium",
      },
      {
        client: "BrightLocal",
        task: "Fix contact form issue",
        deadline: "Monday",
        budget: "$420",
        priority: "High",
      },
      {
        client: "BrightLocal",
        task: "Change homepage banner",
        deadline: "Monday",
        budget: "$420",
        priority: "Medium",
      },
      {
        client: "BrightLocal",
        task: "Repair mobile menu",
        deadline: "Monday",
        budget: "$420",
        priority: "High",
      },
    ],
    workflowSteps: [
      {
        title: "Paste client request",
        description:
          "Paste the WordPress request exactly as the client sent it.",
      },
      {
        title: "Review structured tasks",
        description:
          "Text2Task separates plugin work, page edits, bugs, deadlines, and budgets.",
      },
      {
        title: "Track the job",
        description:
          "Save everything to your workspace and manage progress from one place.",
      },
    ],
    benefits: [
      {
        title: "Organize maintenance work",
        description:
          "Track plugin updates, fixes, content changes, and support tasks without losing context.",
      },
      {
        title: "Keep urgent fixes visible",
        description:
          "Use priority and deadlines to avoid missing time-sensitive client issues.",
      },
      {
        title: "Turn chat into workflow",
        description:
          "Move from messy client messages to structured work in seconds.",
      },
      {
        title: "Export when needed",
        description:
          "Pro users can export task and client data to CSV.",
      },
    ],
    specificTasks: [
      "Plugin updates",
      "Theme fixes",
      "Contact form bugs",
      "Homepage edits",
      "Mobile layout fixes",
      "WooCommerce updates",
      "Content changes",
      "Speed optimization notes",
      "Security requests",
      "Client revision lists",
    ],
    faq: [
      {
        question: "Can Text2Task handle WordPress maintenance requests?",
        answer:
          "Yes. It can extract separate tasks from messages that include plugin updates, page edits, bugs, deadlines, and notes.",
      },
      {
        question: "Can I use it for multiple clients?",
        answer:
          "Yes. Text2Task is designed to organize tasks by client and keep each request trackable.",
      },
      {
        question: "Does it connect directly to WordPress?",
        answer:
          "No. Text2Task does not need WordPress access. It helps organize the client request before or during your workflow.",
      },
      {
        question: "Can I export my task list?",
        answer:
          "CSV export is available for Pro users.",
      },
    ],
    relatedUseCases: ["web-designers", "webflow-freelancers", "small-agencies"],
  },
  {
    slug: "webflow-freelancers",
    audienceLabel: "Webflow Freelancers",
    title: "AI Task Manager for Webflow Freelancers",
    seoTitle: "AI Task Manager for Webflow Freelancers | Text2Task",
    metaDescription:
      "Text2Task helps Webflow freelancers turn scattered client feedback, design revisions, page edits, and launch notes into organized tasks.",
    badge: "Built for Webflow projects",
    heroTitle: "AI task manager for",
    heroHighlight: "Webflow freelancers",
    heroDescription:
      "Webflow projects move fast. Clients send screenshots, revision notes, page edits, launch requests, and feedback across multiple channels. Text2Task turns that into structured work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Webflow feedback often arrives in pieces.",
    problemDescription:
      "A client may send layout edits, CMS notes, mobile issues, and launch requests across email, chat, and screenshots. Text2Task helps turn all of that into trackable tasks.",
    beforeMessage:
      "Please update the hero section, fix the tablet view, add the new testimonials, connect the form, and have it ready before launch on Thursday. Budget is $700.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "Orbit Studio",
        task: "Update hero section",
        deadline: "Thursday",
        budget: "$700",
        priority: "High",
      },
      {
        client: "Orbit Studio",
        task: "Fix tablet layout",
        deadline: "Thursday",
        budget: "$700",
        priority: "High",
      },
      {
        client: "Orbit Studio",
        task: "Add testimonials section",
        deadline: "Thursday",
        budget: "$700",
        priority: "Medium",
      },
      {
        client: "Orbit Studio",
        task: "Connect contact form",
        deadline: "Thursday",
        budget: "$700",
        priority: "High",
      },
    ],
    workflowSteps: [
      {
        title: "Capture the feedback",
        description:
          "Paste Webflow feedback from email, chat, notes, or screenshots.",
      },
      {
        title: "Extract launch tasks",
        description:
          "Text2Task identifies pages, sections, deadlines, budgets, and priorities.",
      },
      {
        title: "Manage until delivery",
        description:
          "Save the work to your workspace and track progress until launch.",
      },
    ],
    benefits: [
      {
        title: "Organize launch requests",
        description:
          "Keep pre-launch edits, bugs, and content updates in one clear list.",
      },
      {
        title: "Capture design revisions",
        description:
          "Turn visual feedback and notes into structured tasks.",
      },
      {
        title: "Keep budgets attached",
        description:
          "Extract project amounts and keep them connected to client work.",
      },
      {
        title: "Avoid scattered feedback",
        description:
          "Stop losing Webflow requests across screenshots, email, and chat.",
      },
    ],
    specificTasks: [
      "Hero section edits",
      "CMS updates",
      "Form connection",
      "Tablet layout fixes",
      "Mobile responsiveness",
      "Landing page revisions",
      "Client screenshot feedback",
      "Testimonials section updates",
      "Launch checklist items",
      "SEO metadata notes",
    ],
    faq: [
      {
        question: "Can Text2Task organize Webflow launch feedback?",
        answer:
          "Yes. It can extract tasks from client messages, launch notes, screenshots, and revision lists.",
      },
      {
        question: "Does Text2Task integrate directly with Webflow?",
        answer:
          "No. It does not need Webflow access. It helps organize client requests before you manage the work.",
      },
      {
        question: "Can I edit tasks before saving?",
        answer:
          "Yes. All extracted tasks can be reviewed and edited before saving.",
      },
      {
        question: "Is there a free plan?",
        answer:
          "Yes. The free plan includes 30 total AI extracts.",
      },
    ],
    relatedUseCases: ["web-designers", "wordpress-freelancers", "graphic-designers"],
  },
  {
    slug: "graphic-designers",
    audienceLabel: "Graphic Designers",
    title: "AI Task Manager for Graphic Designers",
    seoTitle: "AI Task Manager for Graphic Designers | Text2Task",
    metaDescription:
      "Text2Task helps graphic designers turn messy client design requests, revision notes, brand asset feedback, and screenshots into organized tasks.",
    badge: "Built for design requests",
    heroTitle: "AI task manager for",
    heroHighlight: "graphic designers",
    heroDescription:
      "Design clients send logo changes, banner edits, brand notes, social assets, screenshots, and revision lists. Text2Task turns those scattered requests into clear tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Design feedback often arrives as messy notes.",
    problemDescription:
      "A client may send five design changes in one message, attach screenshots, mention a deadline, and forget the final budget. Text2Task helps capture the details before they get lost.",
    beforeMessage:
      "Can you adjust the logo spacing, create 3 Instagram banners, update the brand colors, and send first drafts by Wednesday? Budget is $300. I also sent notes in the screenshot.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "Luma Brand",
        task: "Adjust logo spacing",
        deadline: "Wednesday",
        budget: "$300",
        priority: "High",
      },
      {
        client: "Luma Brand",
        task: "Create 3 Instagram banners",
        deadline: "Wednesday",
        budget: "$300",
        priority: "High",
      },
      {
        client: "Luma Brand",
        task: "Update brand colors",
        deadline: "Wednesday",
        budget: "$300",
        priority: "Medium",
      },
      {
        client: "Luma Brand",
        task: "Review screenshot notes",
        deadline: "Wednesday",
        budget: "$300",
        priority: "Medium",
      },
    ],
    workflowSteps: [
      {
        title: "Paste design feedback",
        description:
          "Use client messages, screenshots, revision notes, or design instructions.",
      },
      {
        title: "Review extracted tasks",
        description:
          "Text2Task extracts deliverables, deadlines, budget, and notes.",
      },
      {
        title: "Save and manage",
        description:
          "Keep each client’s design requests organized in one workspace.",
      },
    ],
    benefits: [
      {
        title: "Track design revisions",
        description:
          "Turn scattered feedback into clear tasks with priority and status.",
      },
      {
        title: "Keep deliverables visible",
        description:
          "Separate banners, logos, brand assets, and edits into individual tasks.",
      },
      {
        title: "Reduce missed notes",
        description:
          "Capture details from text and screenshots before they disappear.",
      },
      {
        title: "Work faster with clients",
        description:
          "Move from messy requests to structured work without building a heavy system.",
      },
    ],
    specificTasks: [
      "Logo revisions",
      "Banner design",
      "Social media assets",
      "Brand color updates",
      "Presentation graphics",
      "Ad creative changes",
      "Client screenshot notes",
      "Typography edits",
      "Packaging changes",
      "First draft deadlines",
    ],
    faq: [
      {
        question: "Can Text2Task extract design tasks from screenshots?",
        answer:
          "Yes. You can upload screenshots and review the extracted tasks before saving them.",
      },
      {
        question: "Can I use it for revision lists?",
        answer:
          "Yes. Text2Task is useful for turning revision notes into structured tasks.",
      },
      {
        question: "Can I track budgets?",
        answer:
          "Yes. Text2Task can extract amounts from client messages when they are included.",
      },
      {
        question: "Can I export my tasks?",
        answer:
          "CSV export is available on the Pro plan.",
      },
    ],
    relatedUseCases: ["web-designers", "social-media-managers", "video-editors"],
  },
  {
    slug: "social-media-managers",
    audienceLabel: "Social Media Managers",
    title: "AI Task Manager for Social Media Managers",
    seoTitle: "AI Task Manager for Social Media Managers | Text2Task",
    metaDescription:
      "Text2Task helps social media managers organize client content requests, campaign notes, post ideas, approval comments, deadlines, and budgets into structured tasks.",
    badge: "Built for client content work",
    heroTitle: "AI task manager for",
    heroHighlight: "social media managers",
    heroDescription:
      "Clients send post ideas, campaign changes, content approvals, ad notes, and deadlines across chat and email. Text2Task turns those messy requests into clear tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Content requests come from everywhere.",
    problemDescription:
      "A client might send post ideas in WhatsApp, ad changes by email, and approval comments in screenshots. Text2Task helps organize the work before it becomes chaos.",
    beforeMessage:
      "Please prepare 5 Instagram posts, update the Facebook ad copy, schedule the holiday campaign, and send captions by next Tuesday. Budget is $600 for this batch.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "Urban Cafe",
        task: "Prepare 5 Instagram posts",
        deadline: "Next Tuesday",
        budget: "$600",
        priority: "High",
      },
      {
        client: "Urban Cafe",
        task: "Update Facebook ad copy",
        deadline: "Next Tuesday",
        budget: "$600",
        priority: "Medium",
      },
      {
        client: "Urban Cafe",
        task: "Schedule holiday campaign",
        deadline: "Next Tuesday",
        budget: "$600",
        priority: "High",
      },
      {
        client: "Urban Cafe",
        task: "Write post captions",
        deadline: "Next Tuesday",
        budget: "$600",
        priority: "Medium",
      },
    ],
    workflowSteps: [
      {
        title: "Paste client content notes",
        description:
          "Use messages, campaign notes, screenshots, or email requests.",
      },
      {
        title: "Extract content tasks",
        description:
          "Turn posts, captions, ad edits, deadlines, and budgets into structured tasks.",
      },
      {
        title: "Manage the workload",
        description:
          "Track what needs to be created, approved, scheduled, or delivered.",
      },
    ],
    benefits: [
      {
        title: "Organize content batches",
        description:
          "Break client requests into posts, captions, ads, approvals, and campaign tasks.",
      },
      {
        title: "Track deadlines clearly",
        description:
          "Keep campaign deadlines visible before they become urgent.",
      },
      {
        title: "Save client notes",
        description:
          "Keep instructions, screenshots, and source messages connected to each task.",
      },
      {
        title: "Reduce manual cleanup",
        description:
          "Spend less time rewriting messy messages into task lists.",
      },
    ],
    specificTasks: [
      "Instagram post batches",
      "Caption writing",
      "Ad copy changes",
      "Campaign scheduling",
      "Holiday content plans",
      "Client approval notes",
      "Creative revision requests",
      "Hashtag updates",
      "Short-form video ideas",
      "Monthly content batches",
    ],
    faq: [
      {
        question: "Can Text2Task organize social media content requests?",
        answer:
          "Yes. It can extract content tasks, deadlines, budgets, and notes from messy client messages.",
      },
      {
        question: "Can I use screenshots?",
        answer:
          "Yes. Text2Task supports screenshot-based extraction.",
      },
      {
        question: "Can I manage multiple clients?",
        answer:
          "Yes. Tasks are organized with client details so you can manage work across clients.",
      },
      {
        question: "Is it a full social media scheduler?",
        answer:
          "No. Text2Task is focused on extracting and organizing tasks. It does not publish posts directly.",
      },
    ],
    relatedUseCases: ["graphic-designers", "video-editors", "virtual-assistants"],
  },
  {
    slug: "video-editors",
    audienceLabel: "Video Editors",
    title: "AI Task Manager for Video Editors",
    seoTitle: "AI Task Manager for Video Editors | Text2Task",
    metaDescription:
      "Text2Task helps video editors turn messy client revision notes, timestamps, delivery deadlines, and feedback screenshots into organized tasks.",
    badge: "Built for video revision work",
    heroTitle: "AI task manager for",
    heroHighlight: "video editors",
    heroDescription:
      "Video clients send revision notes, timestamps, delivery deadlines, file instructions, and feedback across chat and email. Text2Task helps turn those notes into trackable tasks.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Video revision notes are easy to lose.",
    problemDescription:
      "When feedback arrives as long messages, screenshots, or mixed notes, it becomes hard to track what was requested, what was fixed, and what still needs delivery.",
    beforeMessage:
      "Please cut the intro shorter, add captions to the first 30 seconds, replace the music, fix the color on scene 3, and send the final version by Friday. Budget is $500.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "FrameLab",
        task: "Cut intro shorter",
        deadline: "Friday",
        budget: "$500",
        priority: "High",
      },
      {
        client: "FrameLab",
        task: "Add captions to first 30 seconds",
        deadline: "Friday",
        budget: "$500",
        priority: "Medium",
      },
      {
        client: "FrameLab",
        task: "Replace background music",
        deadline: "Friday",
        budget: "$500",
        priority: "Medium",
      },
      {
        client: "FrameLab",
        task: "Fix color on scene 3",
        deadline: "Friday",
        budget: "$500",
        priority: "High",
      },
    ],
    workflowSteps: [
      {
        title: "Paste revision notes",
        description:
          "Use feedback from chat, email, screenshots, or client review notes.",
      },
      {
        title: "Extract editing tasks",
        description:
          "Turn revisions, deadlines, budgets, and client instructions into clean tasks.",
      },
      {
        title: "Track until final delivery",
        description:
          "Manage the work until the client receives the final version.",
      },
    ],
    benefits: [
      {
        title: "Organize revision rounds",
        description:
          "Keep each requested video change visible and trackable.",
      },
      {
        title: "Capture delivery deadlines",
        description:
          "Extract due dates and keep urgent edits from getting buried.",
      },
      {
        title: "Keep notes connected",
        description:
          "Save client instructions and source messages with each task.",
      },
      {
        title: "Avoid manual rewriting",
        description:
          "Turn messy feedback into a task list faster.",
      },
    ],
    specificTasks: [
      "Intro cuts",
      "Caption updates",
      "Music replacement",
      "Color correction notes",
      "Scene revisions",
      "Export requests",
      "Thumbnail notes",
      "Client timestamp feedback",
      "Final delivery tasks",
      "Revision rounds",
    ],
    faq: [
      {
        question: "Can Text2Task extract video revision tasks?",
        answer:
          "Yes. It can turn client revision notes into structured tasks with deadlines and priorities.",
      },
      {
        question: "Can it understand timestamps?",
        answer:
          "Text2Task can capture timestamp-style notes when they appear in the client message, but you should always review the output before saving.",
      },
      {
        question: "Does Text2Task edit videos?",
        answer:
          "No. It organizes the work. You still complete the editing in your editing software.",
      },
      {
        question: "Can I use it for client screenshots?",
        answer:
          "Yes. Screenshot extraction is supported.",
      },
    ],
    relatedUseCases: ["social-media-managers", "graphic-designers", "small-agencies"],
  },
  {
    slug: "virtual-assistants",
    audienceLabel: "Virtual Assistants",
    title: "AI Task Manager for Virtual Assistants",
    seoTitle: "AI Task Manager for Virtual Assistants | Text2Task",
    metaDescription:
      "Text2Task helps virtual assistants turn client messages, admin requests, follow-ups, deadlines, and notes into organized tasks.",
    badge: "Built for assistant workflows",
    heroTitle: "AI task manager for",
    heroHighlight: "virtual assistants",
    heroDescription:
      "Virtual assistants receive admin work, scheduling requests, follow-ups, research tasks, and client notes in messy messages. Text2Task helps organize the work quickly.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Assistant tasks often arrive as mixed instructions.",
    problemDescription:
      "One message can include scheduling, follow-up emails, research, document updates, and deadlines. Text2Task separates the work into clear tasks.",
    beforeMessage:
      "Please follow up with the supplier, update the client spreadsheet, book the meeting for Thursday, and research 5 venue options by tomorrow. Budget is $180.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "Admin Client",
        task: "Follow up with supplier",
        deadline: "Tomorrow",
        budget: "$180",
        priority: "High",
      },
      {
        client: "Admin Client",
        task: "Update client spreadsheet",
        deadline: "Tomorrow",
        budget: "$180",
        priority: "Medium",
      },
      {
        client: "Admin Client",
        task: "Book meeting for Thursday",
        deadline: "Tomorrow",
        budget: "$180",
        priority: "High",
      },
      {
        client: "Admin Client",
        task: "Research 5 venue options",
        deadline: "Tomorrow",
        budget: "$180",
        priority: "Medium",
      },
    ],
    workflowSteps: [
      {
        title: "Paste client instructions",
        description:
          "Use admin requests, notes, emails, or screenshots from clients.",
      },
      {
        title: "Extract clear tasks",
        description:
          "Text2Task separates mixed instructions into structured tasks.",
      },
      {
        title: "Manage and complete",
        description:
          "Track status, priority, deadlines, and client details.",
      },
    ],
    benefits: [
      {
        title: "Separate mixed requests",
        description:
          "Turn one long message into multiple clear tasks.",
      },
      {
        title: "Track deadlines",
        description:
          "Keep urgent admin tasks visible.",
      },
      {
        title: "Keep client details organized",
        description:
          "Save notes, contact information, and task details in one workspace.",
      },
      {
        title: "Work faster",
        description:
          "Spend less time copying client instructions into task lists.",
      },
    ],
    specificTasks: [
      "Follow-up emails",
      "Scheduling",
      "Research tasks",
      "Spreadsheet updates",
      "Document cleanup",
      "Supplier coordination",
      "Client reminders",
      "Meeting preparation",
      "Travel planning notes",
      "Admin checklists",
    ],
    faq: [
      {
        question: "Can Text2Task help virtual assistants organize client messages?",
        answer:
          "Yes. It is designed to turn messy client instructions into structured tasks.",
      },
      {
        question: "Can I edit tasks after extraction?",
        answer:
          "Yes. You can review and edit the AI output before saving.",
      },
      {
        question: "Can I track multiple clients?",
        answer:
          "Yes. Text2Task stores tasks with client details.",
      },
      {
        question: "Does it send emails or book meetings automatically?",
        answer:
          "No. Text2Task organizes the work. You still control execution.",
      },
    ],
    relatedUseCases: ["small-agencies", "social-media-managers", "web-designers"],
  },
  {
    slug: "small-agencies",
    audienceLabel: "Small Agencies",
    title: "AI Task Manager for Small Agencies",
    seoTitle: "AI Task Manager for Small Agencies | Text2Task",
    metaDescription:
      "Text2Task helps small agencies organize messy client requests, screenshots, deadlines, budgets, and project notes into structured tasks.",
    badge: "Built for small service teams",
    heroTitle: "AI task manager for",
    heroHighlight: "small agencies",
    heroDescription:
      "Small agencies handle multiple clients, messages, edits, budgets, and deadlines at once. Text2Task helps turn incoming client requests into organized work.",
    primaryCta: "Try Text2Task",
    secondaryCta: "See the example",
    problemTitle: "Small teams can lose work inside client messages.",
    problemDescription:
      "When requests arrive through email, chat, screenshots, and notes, it becomes hard to know what needs to be done, by when, and for which client.",
    beforeMessage:
      "For the Acme project, please update the landing page, prepare 3 ads, fix the contact form, and send everything before next Friday. Budget is $1,200 for this round.",
    extractedFields: [
      "Client name",
      "Task title",
      "Deadline",
      "Budget",
      "Priority",
      "Client notes",
      "Source message",
    ],
    exampleTasks: [
      {
        client: "Acme",
        task: "Update landing page",
        deadline: "Next Friday",
        budget: "$1,200",
        priority: "High",
      },
      {
        client: "Acme",
        task: "Prepare 3 ads",
        deadline: "Next Friday",
        budget: "$1,200",
        priority: "Medium",
      },
      {
        client: "Acme",
        task: "Fix contact form",
        deadline: "Next Friday",
        budget: "$1,200",
        priority: "High",
      },
      {
        client: "Acme",
        task: "Deliver final work",
        deadline: "Next Friday",
        budget: "$1,200",
        priority: "High",
      },
    ],
    workflowSteps: [
      {
        title: "Capture incoming work",
        description:
          "Paste messages or upload screenshots from clients.",
      },
      {
        title: "Extract project tasks",
        description:
          "Text2Task turns messy requests into organized tasks.",
      },
      {
        title: "Track delivery",
        description:
          "Manage deadlines, budgets, status, priority, and client context.",
      },
    ],
    benefits: [
      {
        title: "Organize multiple clients",
        description:
          "Keep client work from getting buried across different channels.",
      },
      {
        title: "Track revenue-connected tasks",
        description:
          "Capture budgets and amounts attached to client work.",
      },
      {
        title: "Improve delivery visibility",
        description:
          "See what needs attention before deadlines are missed.",
      },
      {
        title: "Stay lighter than enterprise CRM",
        description:
          "Use a focused tool for turning messy requests into structured tasks.",
      },
    ],
    specificTasks: [
      "Landing page edits",
      "Ad creative requests",
      "Client revision lists",
      "Form fixes",
      "Campaign updates",
      "Design deliverables",
      "Website maintenance",
      "Content requests",
      "Delivery checklists",
      "Monthly client batches",
    ],
    faq: [
      {
        question: "Can Text2Task work for small agencies?",
        answer:
          "Yes. Text2Task is useful for small service teams that receive client work through messages, notes, and screenshots.",
      },
      {
        question: "Is it a full enterprise CRM?",
        answer:
          "No. Text2Task is intentionally lightweight and focused on task extraction and client work organization.",
      },
      {
        question: "Can we export task data?",
        answer:
          "CSV export is available on the Pro plan.",
      },
      {
        question: "Can we use it before project management tools?",
        answer:
          "Yes. Text2Task can act as the capture layer before work moves into another system.",
      },
    ],
    relatedUseCases: ["web-designers", "wordpress-freelancers", "virtual-assistants"],
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