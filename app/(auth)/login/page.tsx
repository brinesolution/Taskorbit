import { AuthSetupNotice } from "@/features/auth/components/auth-setup-notice";
import { LoginForm } from "@/features/auth/components/login-form";
import { getAuthSetupStatus } from "@/lib/auth-config";
import { requireUnAuth } from "@/lib/auth-utils";

const Page = async () => {
  const authStatus = getAuthSetupStatus(process.env);

  if (!authStatus.ready) {
    return <AuthSetupNotice missing={authStatus.missing} />;
  }

  await requireUnAuth();

  return <LoginForm providers={authStatus.providers} />;
};

export default Page;
