import "server-only";
import webpush from "web-push";

let configured = false;

export function pushConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPush(sub: webpush.PushSubscription, payload: { title: string; body: string; url?: string }) {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return webpush.sendNotification(sub, JSON.stringify(payload));
}

/** Local date, weekday and minutes-after-midnight in an IANA timezone. */
export function localNow(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: wd, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
