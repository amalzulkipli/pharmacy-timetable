import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const { html, title, filename } = await request.json();

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    
    // Set viewport for initial measurement
    await page.setViewport({ width: 1400, height: 1000 });
    
    // Extract and clean the HTML content
    const cleanedHtml = html.replace(/<html[^>]*>|<\/html>|<head[^>]*>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/g, '');

    // Create the complete HTML with title header
    const htmlWithTitle = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title || 'Pharmacy Schedule'}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
              background: white;
            }
            .pdf-title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 20px;
              margin-top: 0;
            }
            .calendar-wrapper {
              width: 100%;
              overflow: visible;
            }
            /* Ensure calendar content is visible */
            #calendar-container {
              width: 100% !important;
              min-width: 100% !important;
              overflow: visible !important;
            }
            /* Minimal grid fixes for Puppeteer */
            .grid {
              display: grid !important;
            }
            .grid-cols-7 {
              grid-template-columns: repeat(7, 1fr) !important;
            }
            /* Ensure proper page breaks */
            .pdf-page {
              page-break-after: always;
              margin-bottom: 40px;
            }
            .pdf-page:last-child {
              page-break-after: auto;
            }
          </style>
        </head>
        <body>
          ${title ? `<h1 class="pdf-title">${title}</h1>` : ''}
          <div class="calendar-wrapper">
            ${cleanedHtml}
          </div>
        </body>
      </html>
    `;
    
    // Set the HTML content and wait for it to load
    await page.setContent(htmlWithTitle, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Get the actual content dimensions
    const dimensions = await page.evaluate(() => {
      const body = document.body;
      const calendar = document.querySelector('#calendar-container') || document.querySelector('.grid');
      
      return {
        bodyWidth: body.scrollWidth,
        bodyHeight: body.scrollHeight,
        calendarWidth: calendar ? calendar.scrollWidth : 0,
        windowInnerWidth: window.innerWidth
      };
    });

    console.log('📏 Page dimensions:', dimensions);

    console.log('📄 Using standard A4 landscape dimensions for paginated PDF');

    // Generate PDF with standard A4 landscape dimensions
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      scale: 0.9, // Optimal scale for 2-week view
      preferCSSPageSize: false, // Use format instead of CSS
    });

    await browser.close();

    // Return PDF with proper filename
    const pdfFilename = filename || 'pharmacy-schedule.pdf';
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' }, 
      { status: 500 }
    );
  }
} 