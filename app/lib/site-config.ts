export const SITE_ORIGIN = "https://www.text2task.com" as const;

export const SITE_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61588954785433",
  linkedin: "https://www.linkedin.com/company/text2task/",
} as const;

export const SITE_ORGANIZATION_SAME_AS = [
  SITE_SOCIAL_LINKS.facebook,
  SITE_SOCIAL_LINKS.linkedin,
] as const;

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_ORIGIN).toString();
}
