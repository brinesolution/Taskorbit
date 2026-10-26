import { notFound } from "next/navigation";

import prisma from "@/lib/db";
import { CredentialForm } from "@/features/credentials/components/credential";
import { requireAuth } from "@/lib/auth-utils";

type Props = {
  params: Promise<{
    credentialId: string;
  }>;
};

const Page = async ({ params }: Props) => {
  const { credentialId } = await params;
  const session = await requireAuth();

  const credential = await prisma.credential.findUnique({
    where: {
      id: credentialId,
      userId: session.user.id,
    },
  });

  if (!credential) {
    notFound();
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-y-6">
        <CredentialForm
          initialData={{
            id: credential.id,
            name: credential.name,
            type: credential.type as
              | "OPENAI"
              | "ANTHROPIC"
              | "GEMINI"
              | "DISCORD"
              | "WHATSAPP"
              | "STRIPE",
            hasValue: Boolean(credential.value),
          }}
        />
      </div>
    </div>
  );
};

export default Page;
