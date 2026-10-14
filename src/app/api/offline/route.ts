import { fullTests, grammar, listening, pronunciation, reading, shadowing, speaking, voaListening, writing } from "@/content";

export const dynamic = "force-static";

/** Every page and data file to save for offline use (Settings → Học offline). */
export async function GET() {
  const pages = [
    "/",
    "/vocab",
    "/practice",
    "/shadowing",
    "/settings",
    "/talk",
    "/dictation",
    "/notebook",
    "/progress",
    "/roadmap",
    "/mock",
    ...grammar.map((x) => `/grammar/${x.id}`),
    ...reading.map((x) => `/reading/${x.id}`),
    ...[...listening, ...voaListening].map((x) => `/listening/${x.id}`),
    ...writing.map((x) => `/writing/${x.id}`),
    ...speaking.map((x) => `/speaking/${x.id}`),
    ...shadowing.map((x) => `/shadowing/${x.id}`),
    ...pronunciation.map((x) => `/pronunciation/${x.id}`),
    ...fullTests.map((x) => `/mock/full/${x.id}`),
  ];
  const data = ["/api/content/vocab", "/api/content/dictation", "/audio/hidden.json", "/manifest.webmanifest", "/icons/180", "/icons/192", "/icons/512"];
  return Response.json({ pages, data });
}
