# Embed Builder Guide

## Overview
The Embed Builder is a powerful feature that allows you to create rich, interactive embedded messages for your Discord server. These embeds can be used for announcements, rules, welcome messages, and more.

## Basic Usage
To create a simple embed, use the `/embed` command with the following options:

```
/embed title: Your Title description: Your Description
```

### Optional Parameters
- `color` - Hex color code (e.g., #FF0000 for red) or color name (e.g., RED, BLUE)
- `image` - URL of a large image to display in the embed
- `thumbnail` - URL of a small image to display in the corner of the embed
- `footer` - Text to display at the bottom of the embed
- `save` - Name to save this embed as a template
- `use_nitro_emoji` - Whether to use emojis from all servers the bot is in (default: true)
- `use_builder` - Set to true to open the advanced embed builder interface

## Advanced Embed Builder
For more control over your embeds, use the advanced embed builder:

```
/embed use_builder: true
```

Or directly:

```
/embedbuilder
```

The advanced builder provides an interactive interface to customize:
- Title and description
- Color
- Images (thumbnail and main image)
- Author information
- Footer text and icon
- Fields (up to 25 different sections)
- Timestamps

## Using Emoji and Stickers
You can use various emoji formats in your embeds:

- Standard Discord emoji codes like `:smile:` or `:heart:`
- Custom server emojis using `:emoji_name:`
- Animated stickers using `{sticker:name}` or `[sticker:name]`
- Emojis from any server the bot is in (with Nitro support)

## Saving and Using Templates
### Saving a Template

You can save embed designs as templates for future use:

1. Using the simple embed command:
   ```
   /embed title: My Title description: My Description save: template_name
   ```

2. Using the embed builder:
   - Create your embed using the builder interface
   - Click the "Save Template" button
   - Enter a name for your template

### Using Templates
To use a saved template:

```
/embedtemplate load: template_name
```

This will open the embed builder with your saved template loaded, allowing you to make any needed adjustments before sending.

### Built-in Templates
The bot comes with several built-in templates:
- `announcement` - For server announcements
- `rules` - For server rules
- `welcome` - For welcoming new members
- `giveaway` - For hosting giveaways
- `info` - For general information
- `blank` - A blank template to start from scratch

Example:
```
/embedtemplate load: announcement
```

## Managing Templates
To manage your templates:

- List all templates: `/embedtemplate list`
- Delete a template: `/embedtemplate delete: template_name`
- Make a template public: `/embedtemplate share: template_name public: true`
- Browse public templates: `/embedtemplate explore`

## Pro Tips
1. Use fields for organizing information into sections
2. Combine normal and inline fields for more complex layouts
3. Use different colors to differentiate embed types
4. Save your commonly used designs as templates
5. Use the preview button before sending to make sure everything looks right

## Example Uses
- Server rules
- Welcome messages
- Event announcements
- Staff information
- Help guides
- Server status updates
- Poll results
- Giveaway announcements