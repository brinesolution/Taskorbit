"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "react-error-boundary";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  KeyRoundIcon,
  SearchXIcon,
  Trash2Icon,
} from "lucide-react";

import {
  EntityContainer,
  EntityHeader,
  EntityItem,
  EntityList,
  EntitySearch,
  LoadingView,
} from "@/features/workflows/components/entity-components";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  useSuspenseCredentials,
  useRemoveCredential,
} from "../hooks/use-credentials";

import { useCredentialsParams } from "../hooks/use-credentials-params";

type Credential = {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
};

type CredentialsResult = {
  items: Credential[];
  total: number;
  totalPages: number;
};

export const CredentialsSearch = () => {
  const [params, setParams] = useCredentialsParams();

  return (
    <EntitySearch
      value={params.search}
      onChange={(search: string) =>
        setParams({
          ...params,
          search,
          page: 1,
        })
      }
      placeholder="Search credentials"
    />
  );
};

export const CredentialsList = () => {
  const credentials = useSuspenseCredentials();
  const data = credentials.data as unknown as CredentialsResult;

  return (
    <EntityList
      items={data.items}
      getKey={(credential: Credential) => credential.id}
      renderItem={(credential: Credential) => (
        <CredentialItem data={credential} />
      )}
      emptyView={<CredentialsEmpty />}
    />
  );
};

export const CredentialsHeader = ({
  disabled,
}: {
  disabled?: boolean;
}) => {
  const router = useRouter();

  return (
    <EntityHeader
      title="Credentials"
      description="Create and manage your credentials"
      onNew={() => router.push("/credentials/new")}
      newButtonLabel="New credential"
      disabled={disabled}
      isCreating={false}
    />
  );
};

export const CredentialsContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <EntityContainer
      header={<CredentialsHeader />}
      search={<CredentialsSearch />}
    >
      {children}
    </EntityContainer>
  );
};

export const CredentialsLoading = () => {
  return <LoadingView message="Loading credentials..." />;
};

export const CredentialsError = ({ onRetry }: { onRetry: () => void }) => {
  return (
    <div
      role="alert"
      className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/25 bg-card/60 px-5 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">
        Credentials could not load. Refresh and try again.
      </p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
};

export const CredentialsErrorBoundary = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary
        onReset={reset}
        fallbackRender={({ resetErrorBoundary }) => (
          <CredentialsError onRetry={resetErrorBoundary} />
        )}
      >
        {children}
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);

export const CredentialsEmpty = () => {
  const router = useRouter();
  const [params, setParams] = useCredentialsParams();
  const isSearching = Boolean(params.search.trim());

  if (isSearching) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 text-center">
        <SearchXIcon className="mb-3 size-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-medium text-foreground">No matching credentials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Try another name or clear your search.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => setParams({ search: "", page: 1 })}
        >
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <KeyRoundIcon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-medium text-foreground">No credentials yet</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Connect a service once, then reuse its secure credential across your workflows.
      </p>
      <Button
        className="taskorbit-button mt-5"
        onClick={() => router.push("/credentials/new")}
      >
        Create credential
      </Button>
    </div>
  );
};

const CredentialDeleteAction = ({
  credential,
}: {
  credential: Credential;
}) => {
  const [open, setOpen] = useState(false);
  const removeCredential = useRemoveCredential();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={`Delete ${credential.name}`}
        title="Delete credential"
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Trash2Icon className="size-4" aria-hidden="true" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this credential?</AlertDialogTitle>
          <AlertDialogDescription>
            “{credential.name}” will be removed from your account. Workflows that use it will need another credential before they can run.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeCredential.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removeCredential.isPending}
            onClick={() => {
              removeCredential.mutate({ id: credential.id });
              setOpen(false);
            }}
          >
            {removeCredential.isPending ? "Deleting…" : "Delete credential"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const CredentialItem = ({
  data,
}: {
  data: Credential;
}) => {
  return (
    <EntityItem
      title={data.name}
      subtitle={data.type}
      href={`/credentials/${data.id}`}
      image={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:size-11">
          <KeyRoundIcon className="size-5" aria-hidden="true" />
        </span>
      }
      actions={<CredentialDeleteAction credential={data} />}
    />
  );
};
