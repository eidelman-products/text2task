export const SITE_ORIGIN = "https://www.text2task.com" as const;
export const SITE_BRAND_NAME = "Text2Task" as const;
export const SITE_CANONICAL_LOGO_PATH = "/text2task-logo.png" as const;
export const SITE_CANONICAL_DESCRIPTION =
  "Text2Task turns client messages, emails, WhatsApp messages, notes, and supported screenshots into reviewable projects and tasks for freelancers, small agencies, and client-service teams." as const;

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_ORIGIN).toString();
}

export const SITE_CANONICAL_URL = absoluteUrl("/");
export const SITE_CANONICAL_LOGO_URL = absoluteUrl(SITE_CANONICAL_LOGO_PATH);

export const SITE_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61588954785433",
  linkedin: "https://www.linkedin.com/company/text2task/",
} as const;

export const SITE_ORGANIZATION_SAME_AS = [
  SITE_SOCIAL_LINKS.facebook,
  SITE_SOCIAL_LINKS.linkedin,
] as const;
