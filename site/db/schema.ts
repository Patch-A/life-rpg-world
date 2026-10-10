import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const saves = sqliteTable('saves', { userId: text('user_id').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const photos = sqliteTable('photos', {
 id: text('id').primaryKey(), userId: text('user_id').notNull(),
 objectKey: text('object_key').notNull(), contentType: text('content_type').notNull(),
 size: integer('size').notNull(), createdAt: text('created_at').notNull(), deletedAt: text('deleted_at'),
}, table => [index('photos_user_id_idx').on(table.userId)]);
