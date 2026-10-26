"use client";

import Link from "next/link";

import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  AlertTriangleIcon,
  Loader2Icon,
  SearchIcon,
  PackageOpenIcon,
} from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type EntityHeaderProps = {
  title: string;
  description?: string;
  onNew?: () => void;
  newButtonLabel?: string;
  disabled?: boolean;
  isCreating?: boolean;
  actions?: React.ReactNode;
};

export const EntityHeader = ({
  title,
  description,
  onNew,
  newButtonLabel = "New",
  disabled,
  isCreating,
  actions,
}: EntityHeaderProps) => {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
          {title}
        </h1>

        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {(actions || onNew) && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
          {onNew && (
            <Button
              onClick={onNew}
              disabled={disabled || isCreating}
              className="rounded-xl border-0 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/30 hover:opacity-90"
            >
              {isCreating ? "Creating..." : `+ ${newButtonLabel}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

type EntityContainerProps = {
  children: React.ReactNode;
  header: React.ReactNode;
  search?: React.ReactNode;
  pagination?: React.ReactNode;
};

export const EntityContainer = ({
  children,
  header,
  search,
  pagination,
}: EntityContainerProps) => {
  return (
    <div className="flex flex-col gap-y-5 p-4 sm:gap-y-6 sm:p-6 lg:p-8">
      {header}
      {search}
      {children}
      {pagination}
    </div>
  );
};

interface EntitySearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const EntitySearch = ({
  value,
  onChange,
  placeholder = "Search",
}: EntitySearchProps) => {
  return (
    <div className="relative w-full sm:ml-auto sm:w-auto">
      <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

      <Input
        className="h-11 w-full rounded-xl border-border bg-input/40 pl-10 text-foreground shadow-sm shadow-black/10 transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-[min(100%,18rem)]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

interface StateViewProps {
  message?: string;
}

interface LoadingViewProps extends StateViewProps {
  entity?: string;
}

export const LoadingView = ({
  entity = "items",
  message,
}: LoadingViewProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-56 flex-1 flex-col items-center justify-center gap-y-3 rounded-2xl border border-border bg-card/60"
    >
      <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden="true" />

      <p className="text-sm text-muted-foreground">
        {message || `Loading ${entity}`}
      </p>
    </div>
  );
};

export const ErrorView = ({
  message,
  onRetry,
}: StateViewProps & { onRetry?: () => void }) => {
  return (
    <div
      role="alert"
      className="flex min-h-56 flex-1 flex-col items-center justify-center gap-y-3 rounded-2xl border border-destructive/25 bg-card/60 px-5 text-center"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon className="size-5" aria-hidden="true" />
      </span>
      {!!message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
};

interface EmptyViewProps extends StateViewProps {
  onNew?: () => void;
}

export const EmptyView = ({ message, onNew }: EmptyViewProps) => {
  return (
    <Empty className="min-h-[260px] rounded-2xl border border-dashed border-border bg-card/70 text-card-foreground shadow-sm sm:min-h-[300px]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageOpenIcon />
        </EmptyMedia>

        <EmptyTitle>No items</EmptyTitle>

        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>

      {onNew && (
        <EmptyContent>
          <Button
            onClick={onNew}
            className="taskorbit-button rounded-xl"
          >
            Add item
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
};

interface EntityListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => string | number;
  emptyView?: React.ReactNode;
  className?: string;
}

export function EntityList<T>({
  items,
  renderItem,
  getKey,
  emptyView,
  className,
}: EntityListProps<T>) {
  if (items.length === 0 && emptyView) {
    return <div>{emptyView}</div>;
  }

  return (
    <div className={cn("flex flex-col gap-y-4", className)}>
      {items.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

interface EntityItemProps {
  href: string;
  title: string;
  subtitle?: React.ReactNode;
  image?: React.ReactNode;
  actions?: React.ReactNode;
  isRemoving?: boolean;
  className?: string;
}

export const EntityItem = ({
  href,
  title,
  subtitle,
  image,
  actions,
  isRemoving,
  className,
}: EntityItemProps) => {
  return (
    <Card
      className={cn(
        "taskorbit-card flex-row items-center justify-between gap-3 p-4 sm:p-5",
        isRemoving && "opacity-60",
        className
      )}
    >
      <Link
        href={href}
        prefetch
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:gap-4"
      >
        {image}
        <div className="min-w-0">
          <CardTitle className="truncate text-base font-semibold text-card-foreground sm:text-lg">
            {title}
          </CardTitle>
          {subtitle && (
            <CardDescription className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {subtitle}
            </CardDescription>
          )}
        </div>
      </Link>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </Card>
  );
};
