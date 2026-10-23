import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

import { PAGINATION } from "@/config/constants";

export const EXECUTION_STATUSES = [
  "ALL",
  "RUNNING",
  "SUCCESS",
  "FAILED",
] as const;

export const executionsParams = {
  page: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),

  pageSize: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE_SIZE)
    .withOptions({ clearOnDefault: true }),

  search: parseAsString
    .withDefault("")
    .withOptions({ clearOnDefault: true }),

  status: parseAsStringEnum(EXECUTION_STATUSES)
    .withDefault("ALL")
    .withOptions({ clearOnDefault: true }),
};
