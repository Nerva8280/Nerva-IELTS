import { getSession } from "@/lib/session";
import { hasDb } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  return Response.json({
    user,
    config: {
      googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null,
      sync: hasDb(),
      push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && hasDb()),
    },
  });
}
