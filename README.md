# JobTracker: Automated Application Scraper

### 🤖 Project Overview
**JobTracker** is a browser automation tool built with **Google Apps Script**. It streamlines the job hunt by parsing LinkedIn job URLs and automatically extracting metadata (Salary, Location, Company, Title) into a centralized Google Sheet, eliminating manual data entry.

### ⚡ How It Works
1. **Input:** User pastes a LinkedIn URL into the tracking sheet.
2. **Processing:** The script fetches the HTML, parses the DOM using Regex, and sanitizes the data.
3. **Output:** The sheet is automatically populated with structured data.

### 🧩 Key Capabilities
* **Regex Pattern Matching:** Intelligently identifies salary ranges (e.g., "$120k - $150k") and remote status.
* **DOM Parsing:** Extracts hidden metadata from LinkedIn's HTML structure.
* **Error Handling:** Flags invalid URLs or expired job postings automatically.

### 🛠️ Tech Stack
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Google Apps Script](https://img.shields.io/badge/Google_Apps_Script-4285F4?style=flat-square&logo=google-apps-script&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=flat-square&logo=google-sheets&logoColor=white)
