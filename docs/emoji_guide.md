# 👑 Phantom Guard Discord Bot - Emoji System Guide

## Enhanced Emoji System Overview

Phantom Guard Bot now features an advanced emoji system that allows you to use emojis in various contexts:

- Custom embeds with the `/embed` command
- Welcome messages
- Server announcements
- Ticket panels
- Auto-responses
- Bot messages

This guide explains how to use the enhanced emoji features effectively.

## Using Emojis in Your Bot Messages

### Standard Discord Emojis

You can use any standard Discord emoji by typing its code with colons:

```
:smile: :heart: :thumbsup: :warning: :tada:
```

These will automatically be converted to: 😄 ❤️ 👍 ⚠️ 🎉

### Server Custom Emojis

Use your server's custom emojis the same way:

```
:server_emoji:
```

The bot will automatically convert this to the appropriate custom emoji format for Discord.

### Animated Emojis / Stickers

You can use animated emojis with three different formats:

1. Standard format:
   ```
   :animated_emoji:
   ```

2. Sticker format:
   ```
   {sticker:animated_emoji}
   ```

3. Bracket format:
   ```
   [sticker:animated_emoji]
   ```

All three formats will be converted to the proper Discord animated emoji format.

### Discord Nitro Emojis (Cross-Server)

The bot has Nitro capabilities and can use emojis from any server it's in. Simply use the emoji code, and the bot will find and use the emoji even if it's from a different server.

## Emoji Commands

### View Emoji Gallery

Use the emoji gallery to see all available emojis:

```
/emoji action:gallery category:hearts
```

Categories include:
- Basic emoticons
- Hearts & Love
- Symbols
- Technical
- Gaming
- Security
- Animated
- Server emojis

### Convert Text with Emojis

Convert any text containing emoji codes to rendered emojis:

```
/emoji action:convert text:Hello! :smile: {sticker:party} :heart:
```

### Search for Emojis

Find specific emojis by searching:

```
/emoji action:search text:heart
```

### Test Emoji Rendering

Test if an emoji will render correctly:

```
/emoji action:test text::custom_emoji:
```

## Enhanced Embed Creation with Emojis

When creating embeds with `/embed`, you can use emojis in any part of the embed:

```
/embed title:":crown: Server Rules" description:"Please follow these rules:\n:one: Be respectful\n:two: No spamming\n:three: Have fun! :tada:"
```

To see what emojis are available, click the "Show Available Emojis" button after creating an embed.

## Emoji Categories

The bot organizes emojis into these categories:

1. **Basic Emoticons**: 😄 😆 😊 😃 etc.
2. **Hearts & Love**: ❤️ 💙 💚 💜 💛 etc.
3. **Common Symbols**: 👀 🔥 ✨ ⭐ etc.
4. **Technical**: ⚙️ 🔧 🛠️ 🛡️ etc.
5. **Gaming**: 🎮 🎲 ♟️ 🎯 etc.
6. **Security**: 🕵️ 🛡️ 🔒 🔑 etc.
7. **Animated**: Custom animated emojis
8. **Server Emojis**: Emojis from all servers the bot is in

## Troubleshooting Emoji Issues

If emojis aren't displaying correctly:

1. **Check the format**: Make sure you're using the correct format with colons (`:emoji:`)
2. **Verify the emoji name**: Ensure the emoji name is spelled correctly
3. **Try alternative formats**: For animated emojis, try `{sticker:name}` format
4. **Test with the emoji command**: Use `/emoji action:test text::emoji:` to test rendering
5. **Check emoji availability**: The emoji might not be available in your server

## Advanced Emoji Tips

- **Combine emojis with text**: `This is :fire: awesome!`
- **Use emojis in embed titles**: `:tada: Announcement`
- **Create categories in messages**: `:gear: Settings | :shield: Security`
- **Animated progress indicators**: Use `:loading:` for an animated loading indicator
- **Status indicators**: Use 🟢 🟡 🔴 for status levels

## Need Help?

If you need assistance with emojis, use the bot's help command:
```
/help emoji
```

For more detailed help, contact the bot developer or server administrators.

---

*This enhanced emoji system was designed to provide a seamless emoji experience across your Discord server. Enjoy using emojis in all bot features!*