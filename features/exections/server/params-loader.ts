import { createLoader } from "nuqs/server";
import type { SearchParams } from "nuqs";

import { executionsParams } from "../params";
import { EXECUTION_STATUSES } from "../params";

const loadExecutionsParams = createLoader(executionsParams);

export const executionsParamsLoader = async (
  searchParams: Promise<SearchParams>
) => {
  const params = await loadExecutionsParams(searchParams);
  const status =
    EXECUTION_STATUSES.find((value) => value === params.status) ?? "ALL";

  return { ...params, status };
};
