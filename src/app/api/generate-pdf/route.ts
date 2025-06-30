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
    
    // Set wider viewport to accommodate full calendar width
    await page.setViewport({ width: 1800, height: 1200 });
    
    // Use the complete HTML as-is (DOM capture approach) with enhanced CSS for proper grid layout
    const completeHTML = html.replace(
      '</head>',
      `
        <style>
          /* CRITICAL: Force full-width layout without collapse */
          body {
            width: 100% !important;
            overflow-x: visible !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          
          /* PDF page structure */
          .pdf-page {
            page-break-after: always;
            margin-bottom: 40px;
            width: 100% !important;
          }
          .pdf-page:last-child {
            page-break-after: auto;
          }
          
          /* CRITICAL: Fix Grid Layout Collapse */
          .grid {
            display: grid !important;
            width: 100% !important;
            grid-template-columns: repeat(7, 1fr) !important;
          }
          .grid-cols-7 {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            width: 100% !important;
          }
          
          /* Remove all width constraints that cause layout collapse */
          .min-w-\\[1400px\\], 
          .min-w-\\[4200px\\],
          [class*="min-w-"] {
            min-width: auto !important;
            width: 100% !important;
          }
          
          /* Force grid children to fill available space equally */
          .grid > div {
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            overflow: visible !important;
          }
          
          /* Remove container constraints that cause horizontal collapse */
          #calendar-container {
            width: 100% !important;
            max-width: 100% !important;
            min-width: auto !important;
            overflow: visible !important;
          }
          
          /* Disable horizontal scrolling */
          .overflow-x-auto {
            overflow-x: visible !important;
          }
          
          /* Ensure calendar containers use full width */
          .bg-white.rounded-lg.shadow-md {
            width: 100% !important;
          }
        </style>
      </head>`
    );
    
    // Set the HTML content and wait for it to load
    await page.setContent(completeHTML, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Add DOM manipulation to split calendar by weeks for multi-page PDF
    const manipulationResult = await page.evaluate(() => {
      const calendar = document.querySelector('#calendar-container .grid');
      if (!calendar) return { error: 'Calendar not found' };

      // Get all day cells (skip the first 7 header cells)
      const allCells = Array.from(calendar.children);
      const headerCells = allCells.slice(0, 7); // Mon-Sun headers
      const dayCells = allCells.slice(7); // Actual day cells

      // DIAGNOSTIC: Log calendar structure
      const diagnostics = {
        totalCells: allCells.length,
        headerCells: headerCells.length,
        dayCells: dayCells.length,
        headerTexts: headerCells.map(h => h.textContent),
        firstFewDayCells: dayCells.slice(0, 5).map(cell => ({
          text: cell.textContent?.substring(0, 50) + '...',
          classes: cell.className
        })),
        expectedDaysForMonth: 'Should be around 35-42 for full month'
      };

      // Group day cells by weeks (14 days = 2 weeks per page)
      const cellsPerPage = 14; // 2 weeks
      const pages: Element[][] = [];
      
      for (let i = 0; i < dayCells.length; i += cellsPerPage) {
        pages.push(dayCells.slice(i, i + cellsPerPage));
      }

      // DIAGNOSTIC: Log pagination details
      const paginationInfo = {
        totalPages: pages.length,
        cellsPerPage: cellsPerPage,
        pagesBreakdown: pages.map((page, index) => ({
          pageIndex: index,
          cellsInPage: page.length,
          firstCell: page[0]?.textContent?.substring(0, 20) + '...',
          lastCell: page[page.length - 1]?.textContent?.substring(0, 20) + '...'
        }))
      };

      // Clear the calendar and create separate page structure
      const originalCalendarParent = calendar.parentElement;
      if (!originalCalendarParent) return { error: 'Calendar parent not found' };
      calendar.remove();
      
      pages.forEach((pageCells, pageIndex) => {
        // Create page container
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        pageDiv.style.pageBreakAfter = pageIndex === pages.length - 1 ? 'auto' : 'always';
        pageDiv.style.marginBottom = '40px';

        // Create calendar container for this page
        const pageCalendarContainer = document.createElement('div');
        pageCalendarContainer.className = 'overflow-x-auto bg-white rounded-lg shadow-md';
        pageCalendarContainer.id = pageIndex === 0 ? 'calendar-container' : `calendar-container-${pageIndex}`;

        // Create grid for this page
        const pageGrid = document.createElement('div');
        pageGrid.className = 'grid grid-cols-7 min-w-[1400px]';
        
        // Add headers to each page
        headerCells.forEach(header => {
          pageGrid.appendChild(header.cloneNode(true));
        });
        
        // Add day cells for this page
        pageCells.forEach(cell => {
          pageGrid.appendChild(cell);
        });

        // Assemble: pageDiv > pageCalendarContainer > pageGrid > cells
        pageCalendarContainer.appendChild(pageGrid);
        pageDiv.appendChild(pageCalendarContainer);
        originalCalendarParent.appendChild(pageDiv);
      });

      return {
        success: true,
        diagnostics,
        paginationInfo
      };
    });

        // Generate PDF with standard A4 landscape dimensions

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