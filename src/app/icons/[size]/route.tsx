import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "180" }, { size: "192" }, { size: "512" }];
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size) || 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1, #4338ca)",
          color: "white",
          fontSize: size * 0.36,
          fontWeight: 800,
          letterSpacing: -size * 0.01,
        }}
      >
        IC
      </div>
    ),
    { width: size, height: size },
  );
}
