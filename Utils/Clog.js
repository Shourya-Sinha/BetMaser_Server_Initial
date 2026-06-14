// Colorful Console Log Utility
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const CLOG = {
  info: (message, value = '') => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`, value);
  },
  
  success: (message, value = '') => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`, value);
  },
  
  error: (message, value = '') => {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`, value);
  },
  
  warn: (message, value = '') => {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`, value);
  },
  
  debug: (message, value = '') => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${message}`, value);
    }
  },
  
  api: (method, url, status) => {
    const color = status >= 400 ? colors.red : status >= 300 ? colors.yellow : colors.green;
    console.log(
      `${color}[API]${colors.reset} ${method} ${url} - Status: ${status}`
    );
  },
  
  table: (data) => {
    if (process.env.NODE_ENV === 'development') {
      console.table(data);
    }
  },
  
  divider: () => {
    console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  }
};

export default CLOG;