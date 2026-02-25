/**
 * Server-side HTML → PDF renderer using Puppeteer + headless Chromium.
 * Produces pixel-perfect, print-quality PDF documents.
 *
 * In production (Docker), uses system-installed Chromium via PUPPETEER_EXECUTABLE_PATH.
 * Locally, falls back to any installed Chrome/Chromium.
 */

let puppeteerCore: typeof import('puppeteer-core') | null = null;

async function getPuppeteer() {
  if (!puppeteerCore) {
    puppeteerCore = await import('puppeteer-core');
  }
  return puppeteerCore;
}

function getChromiumPath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'linux') {
    return '/usr/bin/chromium';
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--single-process',
  '--no-zygote',
];

export async function renderHTMLtoPDF(html: string): Promise<Buffer> {
  const puppeteer = await getPuppeteer();
  const browser = await puppeteer.default.launch({
    executablePath: getChromiumPath(),
    headless: true,
    args: LAUNCH_ARGS,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
