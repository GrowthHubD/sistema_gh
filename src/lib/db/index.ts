import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as users from "./schema/users";
import * as clients from "./schema/clients";
import * as contracts from "./schema/contracts";
import * as pipeline from "./schema/pipeline";
import * as financial from "./schema/financial";
import * as crm from "./schema/crm";
import * as kanban from "./schema/kanban";
import * as sdr from "./schema/sdr";
import * as blog from "./schema/blog";
import * as notifications from "./schema/notifications";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({
  client: sql,
  schema: {
    ...users,
    ...clients,
    ...contracts,
    ...pipeline,
    ...financial,
    ...crm,
    ...kanban,
    ...sdr,
    ...blog,
    ...notifications,
  },
});

export type Database = typeof db;
