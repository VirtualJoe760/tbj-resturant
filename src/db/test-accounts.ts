import { restaurant } from "@/config/restaurant";

// The four test accounts seeded on every site (one per account type). Disabled on live sites
// unless the webmaster turns them on. See docs/13-accounts-roles.md.
export const TEST_PASSWORD = "password123";

export const TEST_ACCOUNTS = [
  { local: "admin", name: "Test Admin", role: "admin", landing: "/admin", label: "Admin", note: "Owner dashboard" },
  { local: "employee", name: "Alex M.", role: "employee", landing: "/staff", label: "Employee", note: "Alex · bartender" },
  { local: "kitchen", name: "Kitchen Tablet", role: "kitchen", landing: "/kitchen", label: "Kitchen", note: "Orders + 86 board" },
  { local: "customer", name: "Jamie Customer", role: "customer", landing: "/account", label: "Customer", note: "Order history" },
] as const;

export const testEmail = (local: string) => `${local}@${restaurant.domain}`;
