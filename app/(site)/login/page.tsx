import { PageHero } from "@/components/PageHero";
import { isDemo } from "@/config/restaurant";
import { socialEnabled } from "@/auth/auth";
import { TEST_ACCOUNTS, TEST_PASSWORD, testEmail } from "@/db/test-accounts";
import { LoginClient } from "./LoginClient";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Test accounts are listed only on demo sites (docs/13-accounts-roles.md).
  const tests = isDemo ? TEST_ACCOUNTS.map((a) => ({ email: testEmail(a.local), label: a.label, note: a.note })) : [];
  return (
    <>
      <PageHero page="account" title="Sign in">Customers, team members and owners all sign in here</PageHero>
      <LoginClient next={next} tests={tests} testPassword={isDemo ? TEST_PASSWORD : ""} social={socialEnabled} />
    </>
  );
}
