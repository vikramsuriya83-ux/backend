import axios from "axios";
import { env } from "../config/env.js";

export const httpClient = axios.create({
  timeout: env.requestTimeoutMs,
  headers: {
    Accept: "application/json",
  },
});
