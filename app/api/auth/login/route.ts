export async function GET(req: Request) {
  const url = new URL("/api/auth/google", req.url);
  return Response.redirect(url);
}
