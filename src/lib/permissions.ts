import { db } from "./db";
import { modulePermission } from "./db/schema/users";
import { eq, and } from "drizzle-orm";
import type { SystemModule, PermissionAction, UserRole } from "@/types";
import { DEFAULT_PERMISSIONS } from "@/types";

/**
 * Check if a user has permission to perform an action on a module.
 * Partners always have full access.
 * For others, checks the module_permission table first,
 * then falls back to DEFAULT_PERMISSIONS.
 */
export async function checkPermission(
  userId: string,
  userRole: UserRole,
  module: SystemModule,
  action: PermissionAction = "view"
): Promise<boolean> {
  // Partners always have full access
  if (userRole === "partner") return true;

  // Check explicit permission in database
  const [permission] = await db
    .select()
    .from(modulePermission)
    .where(
      and(
        eq(modulePermission.userId, userId),
        eq(modulePermission.module, module)
      )
    )
    .limit(1);

  if (permission) {
    switch (action) {
      case "view":
        return permission.canView;
      case "edit":
        return permission.canEdit;
      case "delete":
        return permission.canDelete;
      default:
        return false;
    }
  }

  // Fall back to default permissions for the role
  const defaults = DEFAULT_PERMISSIONS[userRole];
  if (!defaults) return false;

  const hasModuleAccess = defaults.modules.includes(module);
  if (!hasModuleAccess) return false;

  switch (action) {
    case "view":
      return true;
    case "edit":
      return defaults.canEdit;
    case "delete":
      return defaults.canDelete;
    default:
      return false;
  }
}

/**
 * Get all accessible modules for a user.
 */
export async function getUserModules(
  userId: string,
  userRole: UserRole
): Promise<SystemModule[]> {
  if (userRole === "partner") {
    return DEFAULT_PERMISSIONS.partner.modules;
  }

  // Check for explicit permissions
  const permissions = await db
    .select()
    .from(modulePermission)
    .where(
      and(
        eq(modulePermission.userId, userId),
        eq(modulePermission.canView, true)
      )
    );

  if (permissions.length > 0) {
    return permissions.map((p) => p.module as SystemModule);
  }

  // Fall back to defaults
  return DEFAULT_PERMISSIONS[userRole]?.modules ?? [];
}
