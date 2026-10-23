import { createLoader } from "nuqs/server";
import type { SearchParams } from "nuqs";

import { executionsParams } from "../params";
import { normalizeExecutionStatus } from "../params";

const loadExecutionsParams = createLoader(executionsParams);

export const executionsParamsLoader = async (
  searchParams: Promise<SearchParams>
) => {
  const params = await loadExecutionsParams(searchParams);
  const status = normalizeExecutionStatus(params.status);

  return { ...params, status };
};
