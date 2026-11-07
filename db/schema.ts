import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const tickets = sqliteTable('tickets', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),customer:text('customer').notNull(),contact:text('contact').notNull(),device:text('device').notNull(),description:text('description').notNull(),status:text('status').notNull().default('new'),priority:text('priority').notNull().default('normal'),assignee:text('assignee').notNull().default(''),source:text('source').notNull().default('phone'),due:text('due').notNull().default(''),amount:integer('amount').notNull().default(0),created:text('created').notNull(),updated:text('updated').notNull(),version:integer('version').notNull().default(1),
},t=>[index('tickets_owner').on(t.owner)]);
export const events = sqliteTable('events', {
 id:text('id').primaryKey(),ticketId:text('ticket_id').notNull().references(()=>tickets.id,{onDelete:'cascade'}),owner:text('owner').notNull(),time:text('time').notNull(),message:text('message').notNull(),
},t=>[index('events_ticket').on(t.ticketId)]);
