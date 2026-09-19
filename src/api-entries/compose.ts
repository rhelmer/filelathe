import { handleCompose } from "../server/handlers";

export const maxDuration = 300;

export default {
  async fetch(request: Request): Promise<Response> {
    return handleCompose(request);
  },
};
