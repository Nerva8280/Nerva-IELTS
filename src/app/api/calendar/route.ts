// Recurring study-time event as an .ics file. Served from a URL (not a blob download) so that
// iPhone/iPad open the native "Add to Calendar" sheet, including from the installed app.
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const time = /^\d\d:\d\d$/.test(q.get("t") ?? "") ? q.get("t")! : "20:30";
  const minutes = Math.min(120, Math.max(5, Number(q.get("m")) || 25));
  const days = (q.get("d") ?? "1,2,3,4,5,6")
    .split(",")
    .map(Number)
    .filter((d) => d >= 0 && d <= 6);
  const start = /^\d{8}$/.test(q.get("s") ?? "") ? q.get("s")! : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const origin = new URL(req.url).origin;
  const [h, m] = time.split(":");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IELTS Coach//VI",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:ielts-coach-study-${start}-${h}${m}@${new URL(origin).host}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    // floating local time: the event happens at this clock time wherever the device is
    `DTSTART:${start}T${h}${m}00`,
    `DURATION:PT${minutes}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${(days.length ? days : [1, 2, 3, 4, 5, 6]).map((d) => DAYS[d]).join(",")}`,
    "SUMMARY:📚 Học tiếng Anh – IELTS Coach",
    `DESCRIPTION:Mở app: ${origin}`,
    `URL:${origin}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Đến giờ học tiếng Anh!",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="ielts-coach.ics"',
      "cache-control": "no-store",
    },
  });
}
