# GitHub सेंसिटिव डेटा प्रोटेक्शन एरर समाधान

GitHub ने हमारे पुश को ब्लॉक कर दिया है क्योंकि हमने पिछले कमिट्स में सेंसिटिव डेटा (Discord टोकन आदि) शामिल कर दिया था। इस समस्या का समाधान करने के लिए निम्नलिखित चरणों का पालन करें:

## विकल्प 1: GitHub सिक्योरिटी यूआरएल का उपयोग करें

GitHub ने हमें एक लिंक प्रदान किया है जिससे हम इस सेंसिटिव डेटा को अनब्लॉक कर सकते हैं:
```
https://github.com/jombirsindh12/pc/security/secret-scanning/unblock-secret/2w1MXJhO5sRRhi8DAe5QoKodEay
```

1. इस लिंक पर जाएं
2. "I understand the risk" चुनें
3. अपने टोकन को अनब्लॉक करें

इसके बाद आप सामान्य रूप से पुश कर सकेंगे।

## विकल्प 2: नए कोड के लिए एक नया रिपॉजिटरी बनाएं

यदि आप विकल्प 1 पर भरोसा नहीं करते, तो आप एक नया गिटहब रिपॉजिटरी बना सकते हैं और सिर्फ वर्तमान कोड को वहां पुश कर सकते हैं:

1. GitHub पर एक नया रिपॉजिटरी बनाएं (उदाहरण के लिए "phantom-guard-bot")
2. अपने वर्तमान प्रोजेक्ट फोल्डर में निम्न कमांड्स चलाएं:

```bash
# .git फोल्डर हटाएं ताकि हम एक नए रिपॉजिटरी से शुरू कर सकें
rm -rf .git

# नया .git रिपॉजिटरी इनिशियलाइज़ करें
git init

# सभी फाइल्स को एड करें, लेकिन .env और .env.production को छोड़ दें
git add --all
git reset -- .env .env.production

# पहला कमिट बनाएं
git commit -m "Initial commit for Phantom Guard Bot"

# नए रिपॉजिटरी को रिमोट के रूप में जोड़ें (URL अपने नए रिपॉजिटरी से बदलें)
git remote add origin https://github.com/जोमबिरसिंह12/phantom-guard-bot.git

# कोड पुश करें
git branch -M main
git push -u origin main
```

## विकल्प 3: सिर्फ नई फाइल्स पुश करें

आप मौजूदा रिपॉजिटरी को बनाए रख सकते हैं और सिर्फ विशिष्ट फाइल्स को पुश कर सकते हैं:

1. `.env.production` और सेंसिटिव फाइल्स को `.gitignore` में जोड़ें
2. विशेष रूप से केवल नई फाइल्स को एड और कमिट करें:

```bash
git add setup-env.js DEPLOY.md setup-render.js render.yaml
git commit -m "Add deployment tools and guides"
git push origin main
```

यदि यह अभी भी काम नहीं करता, तो GitHub इश्यू मैन्युअली रिज़ॉल्व करने के लिए विकल्प 1 का उपयोग करें।

## Render डिप्लॉयमेंट के लिए

कोड को GitHub पर पुश करने की परवाह किए बिना, Render पर अपना बॉट डिप्लॉय करने के लिए:

1. Render.com पर अपना अकाउंट बनाएं
2. "New + Web Service" चुनें 
3. "Build and deploy from a Git repository" चुनें
4. अपने GitHub रिपॉजिटरी को कनेक्ट करें
5. निम्नलिखित सेटिंग्स कॉन्फ़िगर करें:
   - Name: phantom-guard-bot
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node index.js`
   
6. "Advanced" अनुभाग में, निम्नलिखित एन्वायरनमेंट वेरिएबल जोड़ें:
   - DISCORD_TOKEN: आपका Discord बॉट टोकन
   - BOT_OWNER_ID: आपकी Discord यूजर ID
   - YOUTUBE_API_KEY: आपकी YouTube API की
   - PORT: 6870
   - NODE_ENV: production

7. "Create Web Service" क्लिक करें