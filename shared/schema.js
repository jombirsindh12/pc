/**
 * Database Schema Definition
 * 
 * This file defines the database schema for the Discord bot
 * using Drizzle ORM.
 */

const { pgTable, text, serial, integer, timestamp, primaryKey, boolean, jsonb } = require('drizzle-orm/pg-core');

// Invites table to track invite usage
const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  serverId: text('server_id').notNull(),
  inviteCode: text('invite_code').notNull(),
  inviterId: text('inviter_id').notNull(),
  inviterTag: text('inviter_tag'), // Discord tag of the inviter (username#discriminator)
  uses: integer('uses').notNull().default(0),
  maxUses: integer('max_uses'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at')
});

// Invite joins table to log when members join using invites
const inviteJoins = pgTable('invite_joins', {
  id: serial('id').primaryKey(),
  serverId: text('server_id').notNull(),
  memberId: text('member_id').notNull(),
  memberTag: text('member_tag'), // Discord tag of the member
  inviteCode: text('invite_code').notNull(),
  inviterId: text('inviter_id').notNull(),
  joinedAt: timestamp('joined_at').defaultNow()
});

// Server settings for invite tracking
const inviteSettings = pgTable('invite_settings', {
  serverId: text('server_id').primaryKey(),
  enabled: integer('enabled').notNull().default(1),
  logChannelId: text('log_channel_id'),
  updateChannelId: text('update_channel_id'),
  welcomeMessage: text('welcome_message'),
  showInviter: integer('show_inviter').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Embed templates table for storing custom embed designs
const embedTemplates = pgTable('embed_templates', {
  id: serial('id').primaryKey(),
  serverId: text('server_id').notNull(),
  name: text('name').notNull(),
  creatorId: text('creator_id').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  description: text('description'),
  embedData: jsonb('embed_data').notNull(), // JSON data of the embed structure
  uses: integer('uses').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Emoji usage statistics table
const emojiStats = pgTable('emoji_stats', {
  id: serial('id').primaryKey(),
  serverId: text('server_id').notNull(),
  emojiId: text('emoji_id'), // Discord emoji ID (null for Unicode emojis)
  emojiName: text('emoji_name').notNull(),
  emojiFormat: text('emoji_format').notNull(), // 'unicode', 'custom', 'animated'
  useCount: integer('use_count').notNull().default(0),
  lastUsed: timestamp('last_used').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});

// Table for storing emoji patterns for processing
const emojiPatterns = pgTable('emoji_patterns', {
  id: serial('id').primaryKey(),
  pattern: text('pattern').notNull(),
  replacement: text('replacement').notNull(),
  description: text('description'),
  isRegex: boolean('is_regex').notNull().default(false),
  priority: integer('priority').notNull().default(10),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
  invites,
  inviteJoins,
  inviteSettings,
  embedTemplates,
  emojiStats,
  emojiPatterns
};