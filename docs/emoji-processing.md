# Emoji Processing System Documentation

## Overview

The emoji processing system is designed to automatically detect and fix malformed emoji patterns in Discord messages. It addresses issues like doubled emoji prefixes (`<a<a:emoji:id>` instead of `<a:emoji:id>`) and other common formatting errors.

## Features

1. **Automatic Emoji Fixing**: Automatically detects and corrects malformed emoji formats in user messages
2. **Custom Pattern Support**: Configurable patterns stored in the database for easy updates
3. **Performance Optimization**: Uses quick fixes for common patterns and full processing for complex cases
4. **Emoji Usage Statistics**: Tracks emoji usage across servers for analytics
5. **Sticker Support**: Handles special sticker formats like `{sticker:name}`

## How It Works

### Message Processing Pipeline

1. When a message is received, the system checks for malformed emoji patterns
2. If detected, the bot deletes the original message and resends a corrected version
3. The system uses pattern matching from the database to identify common formatting issues
4. Usage statistics are tracked for further analysis

### Pattern Types

The system supports two types of patterns:

1. **Simple String Replacements**: Direct text substitutions (faster performance)
2. **Regular Expressions**: For more complex pattern matching (more powerful but slower)

Patterns are stored in the database with priority levels, allowing the most common issues to be fixed first.

## Commands

The bot provides several commands for working with emojis:

### `/emoji`

Main command with multiple subcommands:

- **gallery**: View emoji categories and available emojis
- **convert**: Convert text containing emoji codes to rendered emojis
- **categories**: List all available emoji categories
- **search**: Search for specific emojis by name
- **test**: Test if an emoji code renders correctly

### `/emojifixer`

Dedicated command for fixing malformed emoji patterns:

- **text**: The text containing emojis to fix
- **private**: Option to show results only to the user

## Database Schema

Emoji processing uses two main tables:

### emojiPatterns

Stores patterns for fixing malformed emojis:

- `id`: Unique identifier
- `pattern`: The text pattern to match
- `replacement`: The text to replace it with
- `description`: Human-readable description
- `isRegex`: Whether to treat as regex or simple string replacement
- `priority`: Order to apply fixes (lower numbers first)
- `isEnabled`: Toggle to enable/disable pattern

### emojiStats

Tracks emoji usage statistics:

- `id`: Unique identifier
- `serverId`: Discord server ID
- `emojiId`: Discord emoji ID
- `emojiName`: Name of the emoji
- `emojiFormat`: Format type (unicode, custom, animated)
- `useCount`: Number of times used
- `lastUsed`: Timestamp of last usage

## Technical Implementation

The system is built with a focus on performance and flexibility:

1. **Caching**: Pattern definitions are cached to reduce database queries
2. **Prioritization**: Patterns are applied in order of priority
3. **Error Handling**: Robust error handling to prevent disruption of the bot's functionality
4. **Asynchronous Processing**: Statistics tracking happens in the background

## Default Patterns

The following default patterns are included:

1. `<a<a:` → `<a:` (Fix double animated emoji prefix)
2. `<:<:` → `<:` (Fix double regular emoji prefix)
3. `>id>` → `>` (Fix trailing ID text in emoji)

## Adding New Patterns

New patterns can be added to the database using the `addPattern` function in the emojiProcessor module. For example:

```javascript
const emojiProcessor = require('./utils/emojiProcessor');

// Add a new pattern
await emojiProcessor.addPattern({
  pattern: "<a<a:", 
  replacement: "<a:",
  description: "Fix double animated emoji prefix",
  isRegex: false,
  priority: 1,
  isEnabled: true
});
```

## Future Enhancements

Planned improvements to the emoji processing system:

1. Admin command to add/remove patterns through Discord
2. Emoji usage visualization and analytics
3. Server-specific pattern configurations
4. Automatic pattern learning based on common user mistakes