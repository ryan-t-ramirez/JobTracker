// Column mapping
const COLS = {
  DATE_APPLIED: 1,
  COMPANY: 2,
  JOB_TITLE: 3,
  STATUS: 4,
  SALARY: 5,
  LOCATION: 6,
  JOB_LINK: 7,
};

/**
 * Validates salary format and reasonable ranges
 */
function isValidSalary(salaryStr) {
  if (!salaryStr || typeof salaryStr !== 'string') return false;
  
  const numbers = salaryStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return false;

  const isHourly = /\/hr|per hour|hourly/i.test(salaryStr);
  const isKFormat = /\$\d+K/i.test(salaryStr);

  if (isHourly) {
    const rate = parseInt(numbers[0]);
    return rate >= 10 && rate <= 200;
  } else {
    let minSalary = isKFormat ? parseInt(numbers[0]) * 1000 : parseInt(numbers[0]);
    return minSalary >= 25000 && minSalary <= 500000;
  }
}

/**
 * Basic URL validation
 */
function isValidURL(urlString) {
  return urlString.startsWith('http://') || urlString.startsWith('https://');
}

/**
 * Creates custom menu on spreadsheet open
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Job Scraper')
      .addItem('Process New Links', 'processLinks')
      .addToUi();
}

/**
 * Main processing function - loops through rows and processes new URLs
 */
function processLinks() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const url = row[COLS.JOB_LINK - 1];
    const dateApplied = row[COLS.DATE_APPLIED - 1];

    // Process if URL exists and no date applied (indicating new entry)
    if (url && url.toString().trim() && !dateApplied) {
      const rowIndex = i + 2;
      const urlString = url.toString().trim();
      
      if (!isValidURL(urlString)) {
        handleError(sheet, rowIndex, 'Invalid URL format');
        continue;
      }

      if (urlString.includes("linkedin.com/jobs/view")) {
        scrapeLinkedIn(sheet, rowIndex, urlString);
      } else {
        handleManualEntry(sheet, rowIndex, urlString);
      }
    }
  }
}

/**
 * Handles non-LinkedIn URLs that require manual entry
 */
function handleManualEntry(sheet, row, url) {
  // Extract company name from domain
  const domain = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
  const domainName = domain ? domain[1] : '';
  
  let companyGuess = '';
  if (domainName) {
    companyGuess = domainName
      .replace(/\.(com|org|net|io|co).*$/, '')
      .replace(/jobs\.|careers\./, '')
      .replace(/[-_]/g, ' ')
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Set basic fields
  sheet.getRange(row, COLS.DATE_APPLIED).setValue(new Date());
  sheet.getRange(row, COLS.STATUS).setValue('Applied');
  
  if (companyGuess) {
    sheet.getRange(row, COLS.COMPANY).setValue(companyGuess + ' (verify)');
  }
  
  // Highlight for manual completion
  sheet.getRange(row, 1, 1, 7).setBackground('#FFF2CC');
}

/**
 * Scrapes LinkedIn job postings
 */
function scrapeLinkedIn(sheet, row, url) {
  try {
    const response = UrlFetchApp.fetch(url, { 
      'muteHttpExceptions': true,
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.getResponseCode() >= 400) {
      handleError(sheet, row, `HTTP ${response.getResponseCode()}`);
      return;
    }
    
    const content = response.getContentText();
    
    // Check for common LinkedIn error conditions
    if (content.includes('Page not found') || 
        content.includes('This job is no longer available') ||
        content.includes('authwall')) {
      handleError(sheet, row, 'LinkedIn access blocked');
      return;
    }

    // Extract job data
    const jobTitle = extractJobTitle(content);
    const company = extractCompany(content);
    const location = extractLocation(content);
    const salary = extractSalary(content);

    // Write to spreadsheet
    sheet.getRange(row, COLS.DATE_APPLIED).setValue(new Date());
    sheet.getRange(row, COLS.COMPANY).setValue(company);
    sheet.getRange(row, COLS.JOB_TITLE).setValue(jobTitle);
    sheet.getRange(row, COLS.STATUS).setValue('Applied');
    sheet.getRange(row, COLS.SALARY).setValue(salary);
    sheet.getRange(row, COLS.LOCATION).setValue(location);

  } catch (error) {
    handleError(sheet, row, 'Scraping error: ' + error.message);
  }
}

/**
 * Extract job title from LinkedIn HTML
 */
function extractJobTitle(content) {
  const regex = /<h1.*?class=".*?top-card-layout__title.*?">(.*?)<\/h1>/;
  const match = content.match(regex);
  return match && match[1] ? match[1].trim() : 'Not Found';
}

/**
 * Extract company name with fallback methods
 */
function extractCompany(content) {
  // Try multiple patterns in order of reliability
  const patterns = [
    /<div class="top-card-layout__entity-info">([\s\S]*?)<\/div>/,
    /<a.*?class=".*?topcard__org-name-link.*?">([\s\S]*?)<\/a>/,
    /<a.*?><span class=".*?topcard__flavor--primary.*?">(.*?)<\/span><\/a>/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      let company = match[1];
      // For first pattern, extract link text
      if (pattern === patterns[0]) {
        const linkMatch = company.match(/<a.*?>(.*?)<\/a>/);
        if (linkMatch && linkMatch[1]) {
          company = linkMatch[1];
        }
      }
      company = company.replace(/<[^>]*>/g, '').trim();
      if (company) return company;
    }
  }
  return 'Not Found';
}

/**
 * Extract location with remote detection
 */
function extractLocation(content) {
  // Check for remote first
  if (/Remote/i.test(content)) {
    return 'Remote';
  }
  
  // Look for physical location
  const patterns = [
    /<span class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([^<]+)<\/span>/,
    /<span class="[^"]*job-insight-view__text[^"]*"[^>]*>([^<]+)<\/span>/,
    /<span class="[^"]*job-insight-view__text[^"]*"[^>]*>([^<]+)<\/span>/,
    /([A-Za-z\s]+,\s*[A-Z]{2}(?:\s*\d{5})?)/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim().replace(/\s+/g, ' ');
      if (location.length > 2 && /[A-Za-z]/.test(location)) {
        return location;
      }
    }
  }
  return 'Not Listed';
}

/**
 * Extract salary information
 */
function extractSalary(content) {
  const patterns = [
    /\$[\d,]+\s*-\s*\$[\d,]+\s*(?:\/yr|per year|annually)?/gi,
    /\$\d+K\s*-\s*\$\d+K/gi,
    /\$[\d,]+\s*(?:\/yr|per year|annually)/gi,
    /\$[\d,]+\s*-\s*\$[\d,]+\s*(?:\/hr|per hour|hourly)/gi
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[0] && isValidSalary(match[0])) {
      return match[0].trim();
    }
  }
  return 'Not Listed';
}

/**
 * Generic error handler
 */
function handleError(sheet, row, errorMessage) {
  sheet.getRange(row, 1, 1, 7).setBackground('#FFE6E6');
  sheet.getRange(row, COLS.COMPANY).setValue('❌ ERROR');
  sheet.getRange(row, COLS.JOB_TITLE).setValue(errorMessage);
  sheet.getRange(row, COLS.STATUS).setValue('ERROR');
}
