import type { Locale } from "../config";

import { ca } from "./ca";
import { en } from "./en";
import { he } from "./he";
import type { Messages } from "./types";

export type { Messages };
export const MESSAGES: Record<Locale, Messages> = { ca, en, he };
