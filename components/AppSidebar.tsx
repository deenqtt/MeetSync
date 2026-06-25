"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  Cctv,
  Home,
  LogOut,
  LayoutDashboard,
  Plus,
  ExternalLink,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { showToast } from "@/lib/toast-utils";

const TOKEN = { navy: "#2D3250", teal: "#32AEAC", orange: "#FA9464" } as const;

const MAIN_MENU = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Meetings", href: "/meetings", icon: CalendarClock },
];

const SYSTEM_MENU = [
  { title: "CCTV", href: "/security/surveillance-cctv", icon: Cctv },
  { title: "Home Assistant", href: "/devices/home-assistant", icon: Home },
];

function NavItem({
  item,
  pathname,
}: {
  item: { title: string; href: string; icon: React.ElementType };
  pathname: string;
}) {
  const active =
    item.href === "/"
      ? pathname === "/" || pathname.startsWith("/dashboard/")
      : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className={cn(
          "rounded-xl h-9 transition-all duration-150",
          active
            ? "!bg-[#2D3250]/8 !text-[#2D3250] !font-semibold dark:!bg-white/10 dark:!text-white"
            : "!text-gray-500 hover:!bg-gray-100 hover:!text-gray-800 dark:!text-white/50 dark:hover:!bg-white/5 dark:hover:!text-white/85"
        )}
      >
        <Link href={item.href}>
          <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-[#FA9464]" : "text-current")} />
          <span className="text-[13px]">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user?.username) setUsername(d.user.username); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      showToast.success("Logged out");
      router.replace("/login");
    } catch {
      showToast.error("Failed to log out");
    }
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${TOKEN.navy}, #3d4a72)` }}
          >
            <Image src="/icon-dark.svg" alt="Logo" width={16} height={16} className="invert" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden leading-tight">
            <p className="text-[14px] font-bold tracking-tight text-[#2D3250] dark:text-white">
              MeetSync
            </p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 font-medium -mt-0.5">
              Internal Tools
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 bg-gray-100 dark:bg-white/10" />

      {/* ── Content ───────────────────────────────────────────────────── */}
      <SidebarContent className="px-2 pt-3 gap-4">

        {/* Add Meeting — top CTA */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Add Meeting"
                  className="rounded-xl h-9 transition-all duration-150 !text-white hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${TOKEN.teal} 0%, #28928f 100%)` }}
                >
                  <a
                    href="https://meeting.iotech.my.id/#/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="text-[13px] font-semibold">Add Meeting</span>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50 group-data-[collapsible=icon]:hidden shrink-0" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-gray-100 dark:bg-white/10 -mx-0" />

        {/* Main nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {MAIN_MENU.map((item) => (
                <NavItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Systems */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-white/30 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Systems
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {SYSTEM_MENU.map((item) => (
                <NavItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer — user + logout ─────────────────────────────────────── */}
      <SidebarSeparator className="mx-3 bg-gray-100 dark:bg-white/10" />
      <SidebarFooter className="px-2 py-3 gap-1">
        {/* Current user */}
        {username && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold uppercase"
              style={{ background: `linear-gradient(135deg, ${TOKEN.navy}, #4a5580)` }}
            >
              {username.charAt(0)}
            </div>
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <p className="text-[12px] font-semibold text-gray-700 dark:text-white/80 truncate capitalize">
                {username}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-white/35 truncate">Signed in</p>
            </div>
          </div>
        )}

        {/* Logout */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Log out"
              className="rounded-xl h-9 !text-red-400 hover:!text-red-500 hover:!bg-red-50 dark:!text-red-400/70 dark:hover:!text-red-400 dark:hover:!bg-red-400/10 transition-all duration-150 border border-red-100/0 hover:border-red-100 dark:hover:border-red-400/15"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="text-[13px] font-medium">Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
