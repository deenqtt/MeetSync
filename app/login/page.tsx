"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showToast } from "@/lib/toast-utils";
import { Loader2, CalendarCheck2, Cctv, Home } from "lucide-react";

const FEATURES = [
  {
    icon: CalendarCheck2,
    label: "Smart Meeting",
    desc: "Automated scheduling & AI recording",
    color: "text-[#FA9464]",
  },
  {
    icon: Cctv,
    label: "CCTV Surveillance",
    desc: "RTSP streaming & real-time detection",
    color: "text-[#32AEAC]",
  },
  {
    icon: Home,
    label: "Home Assistant",
    desc: "IoT device control & automation",
    color: "text-purple-400",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast.error("Login failed", data.message || "Invalid username or password");
        return;
      }
      showToast.success("Welcome back");
      router.replace(next);
      router.refresh();
    } catch {
      showToast.error("Login failed", "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen"
      style={{ fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif" }}
    >
      {/* ── LEFT PANEL ── */}
      <div className="relative hidden lg:flex lg:w-[58%] flex-col overflow-hidden">
        <Image
          src="/professional_business_meeting_in_a_modern_bright_office._a_diverse_group_of.png"
          alt="MeetSync workspace"
          fill
          className="object-cover object-center scale-105"
          priority
        />

        {/* gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, rgba(15,20,50,0.15) 0%, rgba(15,20,50,0.45) 40%, rgba(15,20,50,0.92) 75%, rgba(15,20,50,0.98) 100%)",
          }}
        />

        {/* noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Top: logo */}
        <div className="relative z-10 flex items-center gap-2.5 p-9">
          <Image src="/icon-dark.svg" alt="MeetSync" width={34} height={34} />
          <span className="text-[17px] font-bold tracking-tight text-white">MeetSync</span>
        </div>

        {/* Bottom: headline + features */}
        <div className="relative z-10 mt-auto p-9 pb-12 space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/75">
              Internal Platform
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-[2.6rem] font-extrabold leading-[1.1] text-white">
              One Platform,
              <br />
              <span className="text-[#FA9464]">Full Control.</span>
            </h1>
            <p className="max-w-[300px] text-[14px] leading-relaxed text-white/55">
              Integrated dashboard for smart building operations — meetings, security, and automation in one interface.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {FEATURES.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/90">{label}</p>
                  <p className="text-[12px] text-white/45">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#F7F7F5] px-8 py-14">

        {/* decorative blobs */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #FA9464 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #32AEAC 0%, transparent 70%)" }}
        />

        <div className="relative w-full max-w-[360px]">
          {/* mobile logo */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Image src="/icon-dark.svg" alt="MeetSync" width={36} height={36} />
            <span className="text-lg font-bold text-gray-900">MeetSync</span>
          </div>

          {/* form header */}
          <div className="mb-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#FA9464]">
              Internal Dashboard
            </p>
            <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-[13.5px] text-gray-500">
              Enter your credentials to continue.
            </p>
          </div>

          <div className="mb-7 h-px w-full bg-gray-200" />

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-[12.5px] font-semibold text-gray-600">
                Username
              </Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                className="h-11 rounded-xl border-gray-200 bg-white px-4 text-[14px] text-gray-900 shadow-sm placeholder:text-gray-300 focus-visible:ring-[#2D3250]/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12.5px] font-semibold text-gray-600">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11 rounded-xl border-gray-200 bg-white px-4 text-[14px] text-gray-900 shadow-sm placeholder:text-gray-300 focus-visible:ring-[#2D3250]/30"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-xl text-[14px] font-semibold tracking-wide transition-all"
              style={{
                background: loading
                  ? "#6b7280"
                  : "linear-gradient(135deg, #2D3250 0%, #3d4a72 100%)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(45,50,80,0.3)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign in to Dashboard"
              )}
            </Button>
          </form>

          <p className="mt-10 text-center text-[11.5px] text-gray-400">
            MeetSync &copy; 2026 &mdash; Restricted access, employees only
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
