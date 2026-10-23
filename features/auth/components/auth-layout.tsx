import Link from "next/link";
import Image from "next/image";

export const AuthLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">

        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium text-zinc-100"
        >
          <Image
            src="/logos/logo.svg"
            alt="TaskOrbit"
            width={30}
            height={30}
          />

          <span className="text-xl font-bold">
            TaskOrbit
          </span>
        </Link>

        {children}
      </div>
    </div>
  );
};
