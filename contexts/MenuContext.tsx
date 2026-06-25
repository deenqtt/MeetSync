"use client";

// No-RBAC stub for the standalone single-login app.
//
// The NexaBrick core MenuContext drives per-menu RBAC (canView/canEdit/...).
// This app has a single login and no permission model, so every check resolves
// to "allowed" and loading is always false. Ported pages that still import
// useMenu / useMenuItemPermissions keep working without edits.

export interface MenuItemPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function useMenuItemPermissions(_menuId?: string): MenuItemPermissions {
  return { canView: true, canCreate: true, canEdit: true, canDelete: true };
}

export function useMenu() {
  return { loading: false, menuItems: [] as unknown[] };
}
