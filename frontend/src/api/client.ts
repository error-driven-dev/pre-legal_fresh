import createClient from "openapi-fetch";
import type { paths } from "./schema";

/** Typed client for the backend API. Same-origin: FastAPI serves both the API and the frontend. */
export const api = createClient<paths>({ baseUrl: "" });
