export async function GET() {
  return Response.redirect(new URL("/api/auth/google", "https://inboxshaper.com"));
}
