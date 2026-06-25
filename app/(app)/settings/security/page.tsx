import { EmailTwoFactorSettings } from "@/components/settings/email-two-factor-settings";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";

export default function SecurityPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1100px] space-y-6 p-4 md:p-6">
      <TwoFactorSettings />
      <EmailTwoFactorSettings />
    </main>
  );
}
