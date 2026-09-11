### "https://aksharam.ai.studio/"
# Aksharam (അക്ഷരം) ✍️
### Modern Malayalam Typing, Document Editor & Translation Suite

**Aksharam** is a full-featured web application designed for fast, accurate Malayalam writing, typography, document management, and bilingual translation. It includes a built-in virtual Inscript keyboard layout, live typing conversion, cloud AI translation, OCR extraction, and document export capabilities.

---

## ✨ Features

- **Interactive Inscript Keyboard**: Visual layout supporting Inscript (മലയാളം ഇൻസ്ക്രിപ്റ്റ്), GIST, Panchari, Typewriter, and Phonetic mappings.
- **Rich Document Editor**: Custom font styling (Gayathri, Manjari, Noto Sans, Noto Serif), autosave, character/word counters, undo/redo, and find-and-replace.
- **Typing Guide & Conjuncts Directory**: Searchable reference of over 50+ Malayalam conjuncts (കൂട്ടക്ഷരങ്ങൾ), pure chillu letters (ൻ, ർ, ൽ, ൾ, ൺ, ൿ), and ZWJ/ZWNJ controls.
- **AI Translation & OCR**: Bilingual Malayalam ⇄ English translation and PDF/Image optical character recognition powered by Gemini.
- **Export Options**: Export to `.docx`, `.txt`, HTML, and formatted PDF print output.
- **Appearance**: Class-based Light mode, Dark mode, and System preference synchronization.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` or `pnpm` or `bun`

### 2. Installation
Extract the zip file, open your terminal in the project directory, and install dependencies:

```bash
npm install
```

### 3. Environment Setup (Optional for AI Translation & OCR)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Gemini API Key if you want to use the translation and OCR features:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 📦 How to Push to GitHub

If you want to push this repository to your GitHub account:

```bash
# 1. Initialize git (if not already initialized)
git init
git branch -M main

# 2. Add remote repository
git remote add origin https://github.com/binyaminmuhammed/aksharam.git

# 3. Add files and commit
git add .
git commit -m "Initial commit of Aksharam Malayalam Suite"

# 4. Push using your GitHub Personal Access Token or SSH
git push -u origin main
```
*Tip: If using HTTPS with a GitHub Personal Access Token (PAT), make sure the token has `repo` (classic) or `Contents: Read and write` (fine-grained) permissions enabled.*

---


