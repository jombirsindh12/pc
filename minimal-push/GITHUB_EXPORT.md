# GitHub Export Instructions

## GitHub रिपॉजिटरी में डिस्कॉर्ड बॉट एक्सपोर्ट करने की प्रक्रिया

### 1. GitHub पर नई रिपॉजिटरी बनाएं

1. अपने GitHub अकाउंट में लॉगिन करें
2. नई रिपॉजिटरी बनाने के लिए, इस लिंक पर जाएं: https://github.com/new
3. रिपॉजिटरी का नाम दें (जैसे `phantom-guard-bot`)
4. वैकल्पिक रूप से एक विवरण जोड़ें
5. रिपॉजिटरी को प्राइवेट या पब्लिक चुनें
6. **महत्वपूर्ण**: "README.md, .gitignore, या लाइसेंस के साथ इनिशियलाइज़ न करें"
7. "Create repository" पर क्लिक करें

### 2. अपने कोड को GitHub रिपॉजिटरी से जोड़ें

निम्न कमांड को Replit के "Shell" या अपने कंप्यूटर के टर्मिनल में चलाएं:

```bash
# GitHub रिपॉजिटरी को रिमोट के रूप में जोड़ें
git remote add origin https://github.com/आपका-यूजरनेम/phantom-guard-bot.git

# मुख्य ब्रांच का नाम सेट करें (GitHub मानक)
git branch -M main

# GitHub पर कोड पुश करें
git push -u origin main
```

**नोट**: `आपका-यूजरनेम` को अपने वास्तविक GitHub यूजरनेम से बदलें और `phantom-guard-bot` को अपनी रिपॉजिटरी के नाम से बदलें।

### 3. GitHub Credentials बनाएं

अगर git आपसे यूजरनेम/पासवर्ड मांगता है:

- अपना GitHub यूजरनेम दें
- अपने पासवर्ड के बजाय, GitHub Personal Access Token का उपयोग करें
  - Token बनाने के लिए: https://github.com/settings/tokens/new पर जाएं
  - "Note" में "Phantom Guard Bot" या कोई अन्य पहचान दें
  - "repo" पूरे एक्सेस को चेक करें
  - "Generate token" पर क्लिक करें
  - उत्पन्न Token को सुरक्षित रखें और यहां प्रयोग करें

### 4. वेरिफिकेशन

- GitHub पर जाकर अपनी रिपॉजिटरी की जाँच करें
- आपके सभी फाइल्स दिखने चाहिए

### 5. भविष्य में अपडेट

फ्यूचर अपडेट के लिए:

```bash
# चेंजेज ऐड करें
git add .

# कमिट करें
git commit -m "अपडेट का विवरण दें"

# पुश करें
git push
```

## सामान्य GitHub कमांड

```bash
# स्टेटस देखें
git status

# सभी चेंजेज देखें
git diff

# अपडेट प्राप्त करें
git pull origin main
```