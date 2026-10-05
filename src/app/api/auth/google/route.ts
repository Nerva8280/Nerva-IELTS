import { createSession, emailAllowed, verifyGoogleCredential } from "@/lib/session";

export async function POST(req: Request) {
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return Response.json({ error: "Thiếu thông tin đăng nhập" }, { status: 400 });
  try {
    const user = await verifyGoogleCredential(credential);
    if (!emailAllowed(user.email)) return Response.json({ error: `Tài khoản ${user.email} không được phép dùng app này` }, { status: 403 });
    await createSession(user);
    return Response.json({ user });
  } catch (e) {
    console.error("google login failed", e);
    return Response.json({ error: "Không xác thực được tài khoản Google" }, { status: 401 });
  }
}
