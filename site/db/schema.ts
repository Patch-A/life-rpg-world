import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const saves = sqliteTable('saves', { userId: text('user_id').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const photos = sqliteTable('photos', {
 id: text('id').primaryKey(), userId: text('user_id').notNull(),
 objectKey: text('object_key').notNull(), contentType: text('content_type').notNull(),
 size: integer('size').notNull(), createdAt: text('created_at').notNull(), deletedAt: text('deleted_at'),
}, table => [index('photos_user_id_idx').on(table.userId)]);
export const agentRuns=sqliteTable('agent_runs',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),date:text('date').notNull(),goalId:text('goal_id').notNull(),status:text('status').notNull(),result:text('result').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('agent_runs_user_date_idx').on(t.userId,t.date),index('agent_runs_date_idx').on(t.date),index('agent_runs_created_idx').on(t.createdAt)]);
export const feedback=sqliteTable('feedback',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),date:text('date').notNull(),category:text('category').notNull(),helpful:text('helpful').notNull(),step:text('step').notNull(),message:text('message').notNull(),version:text('version').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('feedback_user_date_idx').on(t.userId,t.date),index('feedback_created_idx').on(t.createdAt)]);
