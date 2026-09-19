import { handleFetchResource } from "../server/handlers";

export const maxDuration = 60;

export default {
  async fetch(request: Request): Promise<Response> {
    return handleFetchResource(request);
  },
};
